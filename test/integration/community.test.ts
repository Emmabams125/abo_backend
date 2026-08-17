import request from "supertest";
import { createApp } from "@/app";
import { prisma } from "@/db/prisma.client";
import { signUpUser } from "../helpers/auth";

const app = createApp();

// Lagos Island as the "near" cluster, Abuja (~750km away) as "far".
const NEAR_LAT = 6.5244;
const NEAR_LNG = 3.3792;
const FAR_LAT = 9.0765;
const FAR_LNG = 7.3986;

describe("Community alerts", () => {
  it("surfaces a newly posted alert to a nearby user but not a far-away one", async () => {
    const author = await signUpUser(app);
    const nearbyViewer = await signUpUser(app);
    const farViewer = await signUpUser(app);

    const created = await request(app)
      .post("/community")
      .set("Authorization", `Bearer ${author.accessToken}`)
      .send({
        kind: "LOST_ITEM",
        title: "Lost Dog — Bruno",
        placeLabel: "Ikoyi",
        lat: NEAR_LAT,
        lng: NEAR_LNG,
      })
      .expect(201);

    const nearbyResult = await request(app)
      .get("/community/nearby")
      .set("Authorization", `Bearer ${nearbyViewer.accessToken}`)
      .query({ lat: NEAR_LAT + 0.01, lng: NEAR_LNG + 0.01 })
      .expect(200);

    expect(nearbyResult.body.some((a: { id: string }) => a.id === created.body.id)).toBe(true);
    const found = nearbyResult.body.find((a: { id: string }) => a.id === created.body.id);
    expect(found.placeLabel).toBe("Ikoyi");
    expect(found).not.toHaveProperty("lat");
    expect(found).not.toHaveProperty("lng");

    const farResult = await request(app)
      .get("/community/nearby")
      .set("Authorization", `Bearer ${farViewer.accessToken}`)
      .query({ lat: FAR_LAT, lng: FAR_LNG })
      .expect(200);

    expect(farResult.body.some((a: { id: string }) => a.id === created.body.id)).toBe(false);
  });

  it("filters by kind", async () => {
    const author = await signUpUser(app);
    const viewer = await signUpUser(app);

    const hazard = await request(app)
      .post("/community")
      .set("Authorization", `Bearer ${author.accessToken}`)
      .send({ kind: "HAZARD", title: "Road Hazard - Flooding", placeLabel: "Lekki", lat: NEAR_LAT, lng: NEAR_LNG })
      .expect(201);

    const result = await request(app)
      .get("/community/nearby")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .query({ lat: NEAR_LAT, lng: NEAR_LNG, kind: "MISSING" })
      .expect(200);

    expect(result.body.some((a: { id: string }) => a.id === hazard.body.id)).toBe(false);
  });

  it("lets only the original poster resolve their alert", async () => {
    const author = await signUpUser(app);
    const stranger = await signUpUser(app);

    const created = await request(app)
      .post("/community")
      .set("Authorization", `Bearer ${author.accessToken}`)
      .send({ kind: "MISSING", title: "Missing Child Alert", placeLabel: "Victoria Island", lat: NEAR_LAT, lng: NEAR_LNG })
      .expect(201);

    await request(app)
      .patch(`/community/${created.body.id}/resolve`)
      .set("Authorization", `Bearer ${stranger.accessToken}`)
      .expect(403);

    await request(app)
      .patch(`/community/${created.body.id}/resolve`)
      .set("Authorization", `Bearer ${author.accessToken}`)
      .expect(200);
  });

  it("excludes an expired alert from nearby results", async () => {
    const author = await signUpUser(app);
    const viewer = await signUpUser(app);

    const created = await request(app)
      .post("/community")
      .set("Authorization", `Bearer ${author.accessToken}`)
      .send({ kind: "HAZARD", title: "Expired Hazard", placeLabel: "Ikoyi", lat: NEAR_LAT, lng: NEAR_LNG })
      .expect(201);

    await prisma.communityAlert.update({
      where: { id: created.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await request(app)
      .get("/community/nearby")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .query({ lat: NEAR_LAT, lng: NEAR_LNG })
      .expect(200);

    expect(result.body.some((a: { id: string }) => a.id === created.body.id)).toBe(false);
  });
});
