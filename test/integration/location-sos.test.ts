import request from "supertest";
import { createApp } from "@/app";
import { signUpUser } from "../helpers/auth";

const app = createApp();

async function createCircleWithSecondMember(adminToken: string, memberToken: string, memberPhone: string) {
  const circle = await request(app)
    .post("/circles")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Geo Test Family" })
    .expect(201);

  const invite = await request(app)
    .post(`/circles/${circle.body.id}/invites`)
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(201);

  const accept = await request(app)
    .post("/circles/invites/accept")
    .set("Authorization", `Bearer ${memberToken}`)
    .send({ code: invite.body.code })
    .expect(200);

  await request(app)
    .post(`/circles/${circle.body.id}/memberships/${accept.body.membership.id}/approve`)
    .set("Authorization", `Bearer ${adminToken}`)
    .expect(200);

  void memberPhone;
  return circle.body.id as string;
}

describe("Location & Safe Places — FR-LOC-01/02", () => {
  it("detects a Safe Place arrival when a ping lands inside the radius", async () => {
    const admin = await signUpUser(app);
    const member = await signUpUser(app);
    const circleId = await createCircleWithSecondMember(admin.accessToken, member.accessToken, member.phone);

    await request(app)
      .post(`/location/circles/${circleId}/safe-places`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "Office", lat: 6.5, lng: 3.4, radiusM: 100 })
      .expect(201);

    await request(app)
      .post("/location/ping")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ lat: 6.5, lng: 3.4, accuracy: 5, batteryPct: 90 })
      .expect(202);

    const dashboard = await request(app)
      .get(`/home/circles/${circleId}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    const adminStatus = dashboard.body.members.find((m: { userId: string }) => m.userId === admin.userId);
    expect(adminStatus.status).toBe("AT_SAFE_PLACE");
    expect(adminStatus.placeLabel).toBe("Office");
  });

  it("rejects a location ping/safe place radius outside 50-500m", async () => {
    const admin = await signUpUser(app);
    const circle = await request(app)
      .post("/circles")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "Radius Test" })
      .expect(201);

    await request(app)
      .post(`/location/circles/${circle.body.id}/safe-places`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "Too small", lat: 6.5, lng: 3.4, radiusM: 10 })
      .expect(400);
  });
});

describe("SOS — FR-SOS-01/02", () => {
  it("triggers an SOS, snapshots location/battery, and creates a notification for every other active member", async () => {
    const admin = await signUpUser(app);
    const member = await signUpUser(app);
    const circleId = await createCircleWithSecondMember(admin.accessToken, member.accessToken, member.phone);

    await request(app)
      .post("/location/ping")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ lat: 6.5, lng: 3.4, accuracy: 5, batteryPct: 42 })
      .expect(202);

    const sos = await request(app)
      .post("/sos/trigger")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ circleId })
      .expect(201);

    expect(sos.body.payloadSnapshot.batteryPct).toBe(42);
    expect(sos.body.status).toBe("ACTIVE");

    const log = await request(app)
      .get(`/sos/${sos.body.id}/log`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .expect(200);

    expect(log.body.notifications).toHaveLength(1);
    expect(log.body.notifications[0].memberId).toBe(member.userId);
  });

  it("debounces a duplicate SOS trigger from the same user in quick succession", async () => {
    const admin = await signUpUser(app);
    const circle = await request(app)
      .post("/circles")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "Debounce Test" })
      .expect(201);

    await request(app)
      .post("/sos/trigger")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ circleId: circle.body.id })
      .expect(201);

    const second = await request(app)
      .post("/sos/trigger")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ circleId: circle.body.id });

    expect(second.status).toBe(429);
  });

  it("only lets Circle Admins view the SOS log", async () => {
    const admin = await signUpUser(app);
    const member = await signUpUser(app);
    const circleId = await createCircleWithSecondMember(admin.accessToken, member.accessToken, member.phone);

    const sos = await request(app)
      .post("/sos/trigger")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ circleId })
      .expect(201);

    await request(app)
      .get(`/sos/${sos.body.id}/log`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .expect(403);
  });

  it("only lets the triggering user attach a video to their own SOS event", async () => {
    const admin = await signUpUser(app);
    const member = await signUpUser(app);
    const circleId = await createCircleWithSecondMember(admin.accessToken, member.accessToken, member.phone);

    const sos = await request(app)
      .post("/sos/trigger")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ circleId })
      .expect(201);

    await request(app)
      .patch(`/sos/${sos.body.id}/video`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ videoPath: `${member.userId}/some-video.mp4` })
      .expect(403);

    const attached = await request(app)
      .patch(`/sos/${sos.body.id}/video`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ videoPath: `${admin.userId}/some-video.mp4` })
      .expect(200);

    expect(attached.body.videoUrl).toBe(`${admin.userId}/some-video.mp4`);
  });
});
