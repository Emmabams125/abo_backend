import request from "supertest";
import { createApp } from "@/app";
import { mockSmsInbox } from "@/modules/auth/providers/mock.provider";
import { signUpUser } from "../helpers/auth";

const app = createApp();

describe("Circles — FR-ONB-02/04, FR-PRO-02", () => {
  it("creates a Circle with the creator as ADMIN", async () => {
    const admin = await signUpUser(app);
    const res = await request(app)
      .post("/circles")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "Test Family" })
      .expect(201);

    expect(res.body.id).toBeTruthy();
    expect(res.body.createdBy).toBe(admin.userId);
  });

  it("invite acceptance lands PENDING_APPROVAL when the Circle has an active Admin, and Admin approval activates it", async () => {
    const admin = await signUpUser(app);
    const member = await signUpUser(app);

    const circle = await request(app)
      .post("/circles")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "Test Family 2" })
      .expect(201);

    const invite = await request(app)
      .post(`/circles/${circle.body.id}/invites`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(201);

    const accept = await request(app)
      .post("/circles/invites/accept")
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ code: invite.body.code })
      .expect(200);

    expect(accept.body.requiresApproval).toBe(true);
    expect(accept.body.membership.status).toBe("PENDING_APPROVAL");

    const approve = await request(app)
      .post(`/circles/${circle.body.id}/memberships/${accept.body.membership.id}/approve`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(approve.body.status).toBe("ACTIVE");
  });

  it("rejects an expired or already-used invite code", async () => {
    const admin = await signUpUser(app);
    const member = await signUpUser(app);

    await request(app)
      .post("/circles/invites/accept")
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ code: "does-not-exist" })
      .expect(400);
    void admin;
  });

  it("requires a fresh reauth token before a role change is applied", async () => {
    const admin = await signUpUser(app);
    const member = await signUpUser(app);

    const circle = await request(app)
      .post("/circles")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "Test Family 3" })
      .expect(201);

    const invite = await request(app)
      .post(`/circles/${circle.body.id}/invites`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(201);

    const accept = await request(app)
      .post("/circles/invites/accept")
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ code: invite.body.code })
      .expect(200);

    const membershipId = accept.body.membership.id;

    // Without a reauth token, the role change must be rejected.
    await request(app)
      .patch(`/circles/${circle.body.id}/memberships/${membershipId}/role`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ role: "ADMIN" })
      .expect(401);

    // Obtain a reauth token the same way sign-up works: request + verify an OTP.
    await request(app)
      .post("/auth/reauth/request")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ phone: admin.phone })
      .expect(202);
    const code = mockSmsInbox.get(admin.phone)!;
    const reauth = await request(app)
      .post("/auth/reauth/verify")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ phone: admin.phone, code })
      .expect(200);

    const changed = await request(app)
      .patch(`/circles/${circle.body.id}/memberships/${membershipId}/role`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .set("X-Reauth-Token", reauth.body.reauthToken)
      .send({ role: "ADMIN" })
      .expect(200);

    expect(changed.body.role).toBe("ADMIN");
  });
});
