import request from "supertest";
import { createApp } from "@/app";
import { signUpUser } from "../helpers/auth";

const app = createApp();

type User = Awaited<ReturnType<typeof signUpUser>>;

const auth = (user: User) => ({ Authorization: `Bearer ${user.accessToken}` });

async function circleWithPendingMember() {
  const admin = await signUpUser(app);
  const joiner = await signUpUser(app);
  const circle = await request(app).post("/circles").set(auth(admin)).send({ name: "Release Family" }).expect(201);
  const invite = await request(app).post(`/circles/${circle.body.id}/invites`).set(auth(admin)).expect(201);
  const accept = await request(app)
    .post("/circles/invites/accept")
    .set(auth(joiner))
    .send({ code: invite.body.code })
    .expect(200);
  return { admin, joiner, circleId: circle.body.id as string, membershipId: accept.body.membership.id as string };
}

describe("Join requests (FR-ONB-02)", () => {
  it("lists pending requests for the Admin only, and the joiner sees it under /circles/mine", async () => {
    const { admin, joiner, circleId, membershipId } = await circleWithPendingMember();

    const pending = await request(app).get(`/circles/${circleId}/pending-memberships`).set(auth(admin)).expect(200);
    expect(pending.body.map((m: { id: string }) => m.id)).toEqual([membershipId]);
    expect(pending.body[0].user).toEqual(
      expect.objectContaining({ id: joiner.userId, phone: joiner.phone })
    );
    expect(pending.body[0].user.email).toBeUndefined();

    await request(app).get(`/circles/${circleId}/pending-memberships`).set(auth(joiner)).expect(403);

    const mine = await request(app).get("/circles/mine").set(auth(joiner)).expect(200);
    expect(mine.body).toEqual([
      expect.objectContaining({ circleId, status: "PENDING_APPROVAL", circle: { id: circleId, name: "Release Family" } }),
    ]);
  });

  it("decline removes the request and the joiner can be invited again", async () => {
    const { admin, joiner, circleId, membershipId } = await circleWithPendingMember();

    const declined = await request(app)
      .post(`/circles/${circleId}/memberships/${membershipId}/decline`)
      .set(auth(admin))
      .expect(200);
    expect(declined.body.status).toBe("REMOVED");
    expect((await request(app).get("/circles/mine").set(auth(joiner))).body).toEqual([]);

    // Re-joining revives the old row instead of hitting the unique constraint.
    const invite = await request(app).post(`/circles/${circleId}/invites`).set(auth(admin)).expect(201);
    const again = await request(app)
      .post("/circles/invites/accept")
      .set(auth(joiner))
      .send({ code: invite.body.code })
      .expect(200);
    expect(again.body.membership.status).toBe("PENDING_APPROVAL");
  });

  it("members list exposes only what Circle members may see", async () => {
    const { admin, circleId } = await circleWithPendingMember();
    const members = await request(app).get(`/circles/${circleId}/members`).set(auth(admin)).expect(200);
    expect(Object.keys(members.body[0].user).sort()).toEqual(["avatarUrl", "id", "name", "phone"]);
  });
});

describe("Location privacy", () => {
  it("won't reveal the location of someone outside the Circle", async () => {
    const { admin, circleId } = await circleWithPendingMember();
    const stranger = await signUpUser(app);
    await request(app).post("/location/ping").set(auth(stranger)).send({ lat: 6.5, lng: 3.4 }).expect(202);

    await request(app)
      .get(`/location/circles/${circleId}/members/${stranger.userId}`)
      .set(auth(admin))
      .expect(404);
  });
});

describe("Account deletion (Play Store)", () => {
  it("erases personal data, frees the phone number and hands the Circle to another member", async () => {
    const { admin, joiner, circleId, membershipId } = await circleWithPendingMember();
    await request(app).post(`/circles/${circleId}/memberships/${membershipId}/approve`).set(auth(admin)).expect(200);
    await request(app).patch("/users/me").set(auth(admin)).send({ name: "Admin Person" }).expect(200);

    await request(app).delete("/users/me").set(auth(admin)).expect(204);

    const members = await request(app).get(`/circles/${circleId}/members`).set(auth(joiner)).expect(200);
    expect(members.body).toHaveLength(1);
    expect(members.body[0]).toEqual(expect.objectContaining({ userId: joiner.userId, role: "ADMIN" }));

    // Old refresh token no longer works; the phone can sign up as a brand-new account.
    await request(app).post("/auth/refresh").send({ refreshToken: admin.refreshToken }).expect(401);
    const reborn = await signUpUser(app, admin.phone);
    expect(reborn.userId).not.toBe(admin.userId);
  });
});

describe("Public legal pages", () => {
  it("serves the privacy policy and account deletion pages", async () => {
    const privacy = await request(app).get("/privacy").expect(200);
    expect(privacy.text).toContain("Abo Privacy Policy");
    const deletion = await request(app).get("/delete-account").expect(200);
    expect(deletion.text).toContain("Delete your Abo account");
  });
});
