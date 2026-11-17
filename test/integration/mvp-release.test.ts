import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/db/prisma.client";
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

describe("Push device registration", () => {
  it("moves a push token to whoever is signed in on that phone, and never edits another user's device", async () => {
    const first = await signUpUser(app);
    const second = await signUpUser(app);
    const token = `fcm-token-${Date.now()}`;

    const firstDevice = await request(app)
      .post("/devices")
      .set(auth(first))
      .send({ platform: "ANDROID", pushToken: token })
      .expect(201);

    // Second account signs in on the same phone and claims the first one's device id.
    const secondDevice = await request(app)
      .post("/devices")
      .set(auth(second))
      .send({ deviceId: firstDevice.body.id, platform: "ANDROID", pushToken: token })
      .expect(201);

    expect(secondDevice.body.id).not.toBe(firstDevice.body.id);
    expect(secondDevice.body.userId).toBe(second.userId);

    const firstDevices = await request(app).get("/devices").set(auth(first)).expect(200);
    expect(firstDevices.body).toEqual([expect.objectContaining({ id: firstDevice.body.id, pushToken: null })]);
  });
});

describe("SOS details for Circle members", () => {
  it("lets members open an SOS and see who responded; the sender can resolve it", async () => {
    const { admin, joiner, circleId, membershipId } = await circleWithPendingMember();
    await request(app).post(`/circles/${circleId}/memberships/${membershipId}/approve`).set(auth(admin)).expect(200);
    await request(app).post("/location/ping").set(auth(joiner)).send({ lat: 6.45, lng: 3.39 }).expect(202);

    const sos = await request(app).post("/sos/trigger").set(auth(joiner)).send({ circleId }).expect(201);

    const active = await request(app).get(`/sos/circles/${circleId}/active`).set(auth(admin)).expect(200);
    expect(active.body.map((e: { id: string }) => e.id)).toContain(sos.body.id);

    await request(app).post(`/sos/${sos.body.id}/acknowledge`).set(auth(admin)).expect(200);
    const details = await request(app).get(`/sos/${sos.body.id}`).set(auth(admin)).expect(200);
    expect(details.body).toEqual(
      expect.objectContaining({
        status: "ACTIVE",
        location: { lat: 6.45, lng: 3.39 },
        videoUrl: null,
        sender: expect.objectContaining({ id: joiner.userId }),
        responders: [expect.objectContaining({ userId: admin.userId })],
      })
    );
    expect(details.body.sender.email).toBeUndefined();

    const outsider = await signUpUser(app);
    await request(app).get(`/sos/${sos.body.id}`).set(auth(outsider)).expect(403);

    await request(app).post(`/sos/${sos.body.id}/resolve`).set(auth(joiner)).expect(200);
    const after = await request(app).get(`/sos/circles/${circleId}/active`).set(auth(admin)).expect(200);
    expect(after.body.map((e: { id: string }) => e.id)).not.toContain(sos.body.id);
  });
});

describe("Closing an SOS", () => {
  it("lets any Circle member close it, and expires one nobody closed after 24h", async () => {
    const { admin, joiner, circleId, membershipId } = await circleWithPendingMember();
    await request(app).post(`/circles/${circleId}/memberships/${membershipId}/approve`).set(auth(admin)).expect(200);

    // The admin sends one; a plain member closes it.
    const first = await request(app).post("/sos/trigger").set(auth(admin)).send({ circleId }).expect(201);
    await request(app).post(`/sos/${first.body.id}/resolve`).set(auth(joiner)).expect(200);
    const outsider = await signUpUser(app);
    await request(app).post(`/sos/${first.body.id}/resolve`).set(auth(outsider)).expect(403);

    // One left open for over a day stops counting as SOS everywhere.
    const stale = await request(app).post("/sos/trigger").set(auth(joiner)).send({ circleId }).expect(201);
    await prisma.sOSEvent.update({
      where: { id: stale.body.id },
      data: { triggeredAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    const dashboard = await request(app).get(`/home/circles/${circleId}`).set(auth(admin)).expect(200);
    const status = dashboard.body.members.find((m: { userId: string }) => m.userId === joiner.userId)?.status;
    expect(status).not.toBe("SOS");
    const event = await prisma.sOSEvent.findUnique({ where: { id: stale.body.id } });
    expect(event?.status).toBe("RESOLVED");
  });
});

describe("Circle activity feed", () => {
  it("merges check-ins, SOS and joins newest first, per member on request, members only", async () => {
    const { admin, joiner, circleId, membershipId } = await circleWithPendingMember();
    await request(app).post(`/circles/${circleId}/memberships/${membershipId}/approve`).set(auth(admin)).expect(200);
    await request(app).post("/reassurance/check-in").set(auth(admin)).send({ circleId });
    await request(app).post("/location/ping").set(auth(joiner)).send({ lat: 6.5, lng: 3.4 }).expect(202);
    await request(app).post("/sos/trigger").set(auth(joiner)).send({ circleId }).expect(201);

    const feed = await request(app).get(`/circles/${circleId}/activity`).set(auth(admin)).expect(200);
    const types = feed.body.map((i: { type: string }) => i.type);
    expect(types[0]).toBe("SOS");
    expect(types).toEqual(expect.arrayContaining(["MEMBER_JOINED"]));
    expect(feed.body[0].user).toEqual({ id: joiner.userId, name: null, avatarUrl: null });

    const mine = await request(app).get(`/circles/${circleId}/activity?userId=${joiner.userId}`).set(auth(admin)).expect(200);
    expect(mine.body.every((i: { user: { id: string } }) => i.user.id === joiner.userId)).toBe(true);

    const outsider = await signUpUser(app);
    await request(app).get(`/circles/${circleId}/activity`).set(auth(outsider)).expect(403);
  });
});

describe("Push notifications for Circle events", () => {
  /** Titles of the pushes queued for one user (no worker runs in tests). */
  async function pushesFor(userId: string): Promise<string[]> {
    const { pushQueue } = await import("@/queues/push.queue");
    const jobs = await pushQueue.getJobs(["waiting", "delayed", "active", "completed", "failed", "prioritized"]);
    return jobs.filter((j) => j?.data.userId === userId).map((j) => j.data.message.title);
  }

  it("join request, approval, responder, SOS closed and low battery each reach the right people", async () => {
    const { admin, joiner, circleId, membershipId } = await circleWithPendingMember();
    await request(app).patch("/users/me").set(auth(joiner)).send({ name: "Tunde" });

    // 3. Join request -> Admin; approval -> joiner.
    expect(await pushesFor(admin.userId)).toEqual(expect.arrayContaining([expect.stringContaining("wants to join")]));
    await request(app).post(`/circles/${circleId}/memberships/${membershipId}/approve`).set(auth(admin)).expect(200);
    expect(await pushesFor(joiner.userId)).toEqual(expect.arrayContaining([expect.stringContaining("You're in!")]));

    // 1. Responder -> SOS sender, once even if tapped twice.
    const sos = await request(app).post("/sos/trigger").set(auth(admin)).send({ circleId }).expect(201);
    await request(app).post(`/sos/${sos.body.id}/acknowledge`).set(auth(joiner)).expect(200);
    await request(app).post(`/sos/${sos.body.id}/acknowledge`).set(auth(joiner)).expect(200);
    const responding = (await pushesFor(admin.userId)).filter((t) => t.includes("is responding to your SOS"));
    expect(responding).toEqual(["Tunde is responding to your SOS"]);

    // 2. Closed -> everyone except whoever closed it.
    await request(app).post(`/sos/${sos.body.id}/resolve`).set(auth(admin)).expect(200);
    expect(await pushesFor(joiner.userId)).toEqual(expect.arrayContaining([expect.stringContaining("is safe now")]));
    expect((await pushesFor(admin.userId)).some((t) => t.includes("is safe now"))).toBe(false);

    // 4. Low battery -> the Circle, once a day.
    await request(app).post("/location/ping").set(auth(joiner)).send({ lat: 6.5, lng: 3.4, batteryPct: 9 }).expect(202);
    await request(app).post("/location/ping").set(auth(joiner)).send({ lat: 6.5, lng: 3.4, batteryPct: 8 }).expect(202);
    const battery = (await pushesFor(admin.userId)).filter((t) => t.includes("phone is at"));
    expect(battery).toEqual(["🔋 Tunde's phone is at 9%"]);
  });
});

describe("Community moderation (Play UGC policy)", () => {
  const spot = { lat: 7.3775, lng: 3.947 };
  const nearby = (user: User) =>
    request(app).get("/community/nearby").query({ ...spot, radiusM: 5000 }).set(auth(user)).expect(200);
  const ids = (res: request.Response) => res.body.map((a: { id: string }) => a.id);

  it("report hides a post for the reporter, 3 reports hide it for everyone, and blocking hides an author", async () => {
    const author = await signUpUser(app);
    const [r1, r2, r3, viewer] = await Promise.all([signUpUser(app), signUpUser(app), signUpUser(app), signUpUser(app)]);
    const post = await request(app)
      .post("/community")
      .set(auth(author))
      .send({ kind: "HAZARD", title: "Fallen tree on the road", placeLabel: "Ring Road", ...spot })
      .expect(201);

    expect(ids(await nearby(r1))).toContain(post.body.id);
    await request(app).post(`/community/${post.body.id}/report`).set(auth(author)).send({ reason: "SPAM" }).expect(400);

    // One report: gone for that reporter only.
    const first = await request(app)
      .post(`/community/${post.body.id}/report`)
      .set(auth(r1))
      .send({ reason: "FALSE_INFORMATION", details: "No tree there" })
      .expect(200);
    expect(first.body).toEqual({ reported: true, hidden: false });
    expect(ids(await nearby(r1))).not.toContain(post.body.id);
    expect(ids(await nearby(viewer))).toContain(post.body.id);

    // Reporting twice doesn't count twice.
    await request(app).post(`/community/${post.body.id}/report`).set(auth(r1)).send({ reason: "SPAM" }).expect(200);
    await request(app).post(`/community/${post.body.id}/report`).set(auth(r2)).send({ reason: "SPAM" }).expect(200);
    expect(ids(await nearby(viewer))).toContain(post.body.id);
    const third = await request(app).post(`/community/${post.body.id}/report`).set(auth(r3)).send({ reason: "ABUSIVE" }).expect(200);
    expect(third.body.hidden).toBe(true);
    expect(ids(await nearby(viewer))).not.toContain(post.body.id);

    // Blocking hides everything that author posts; unblocking brings it back.
    const second = await request(app)
      .post("/community")
      .set(auth(author))
      .send({ kind: "LOST_ITEM", title: "Lost blue bag", placeLabel: "Bodija", ...spot })
      .expect(201);
    expect(ids(await nearby(viewer))).toContain(second.body.id);
    await request(app).post(`/users/${author.userId}/block`).set(auth(viewer)).send({ label: "Lost blue bag" }).expect(200);
    expect(ids(await nearby(viewer))).not.toContain(second.body.id);
    const blocks = await request(app).get("/users/me/blocks").set(auth(viewer)).expect(200);
    expect(blocks.body).toEqual([{ userId: author.userId, label: "Lost blue bag", blockedAt: expect.any(String) }]);
    await request(app).delete(`/users/${author.userId}/block`).set(auth(viewer)).expect(200);
    expect(ids(await nearby(viewer))).toContain(second.body.id);

    await request(app).post(`/users/${viewer.userId}/block`).set(auth(viewer)).expect(400);
  });

  it("serves the Community guidelines page", async () => {
    const page = await request(app).get("/community-guidelines").expect(200);
    expect(page.text).toContain("Community guidelines");
  });
});
