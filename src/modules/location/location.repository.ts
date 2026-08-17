import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma.client";

export interface LatestLocation {
  userId: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  batteryPct: number | null;
  recordedAt: Date;
}

export interface SafePlaceWithDistance {
  id: string;
  circleId: string;
  name: string;
  radiusM: number;
  lat: number;
  lng: number;
  distanceMeters: number;
  isInside: boolean;
}

/** All raw PostGIS SQL is isolated here — nothing above this layer touches geometry directly. */
export const locationRepository = {
  async insertPing(userId: string, lat: number, lng: number, accuracy?: number, batteryPct?: number) {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "location_pings" (id, "userId", "accuracy", "batteryPct", "recordedAt", "location")
      VALUES (
        ${id},
        ${userId},
        ${accuracy ?? null},
        ${batteryPct ?? null},
        now(),
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      )
    `;
    return id;
  },

  async getLatestLocationForUser(userId: string): Promise<LatestLocation | null> {
    const rows = await prisma.$queryRaw<LatestLocation[]>`
      SELECT
        "userId",
        ST_Y("location"::geometry) AS lat,
        ST_X("location"::geometry) AS lng,
        "accuracy",
        "batteryPct",
        "recordedAt"
      FROM "location_pings"
      WHERE "userId" = ${userId}
      ORDER BY "recordedAt" DESC
      LIMIT 1
    `;
    return rows[0] ?? null;
  },

  async getLatestLocationsForUsers(userIds: string[]): Promise<LatestLocation[]> {
    if (userIds.length === 0) return [];
    return prisma.$queryRaw<LatestLocation[]>`
      SELECT DISTINCT ON ("userId")
        "userId",
        ST_Y("location"::geometry) AS lat,
        ST_X("location"::geometry) AS lng,
        "accuracy",
        "batteryPct",
        "recordedAt"
      FROM "location_pings"
      WHERE "userId" IN (${Prisma.join(userIds)})
      ORDER BY "userId", "recordedAt" DESC
    `;
  },

  async getLocationHistory(userId: string, since: Date) {
    return prisma.$queryRaw<LatestLocation[]>`
      SELECT
        "userId",
        ST_Y("location"::geometry) AS lat,
        ST_X("location"::geometry) AS lng,
        "accuracy",
        "batteryPct",
        "recordedAt"
      FROM "location_pings"
      WHERE "userId" = ${userId} AND "recordedAt" >= ${since}
      ORDER BY "recordedAt" DESC
    `;
  },

  async purgeExpiredPings(userId: string, before: Date) {
    await prisma.$executeRaw`
      DELETE FROM "location_pings" WHERE "userId" = ${userId} AND "recordedAt" < ${before}
    `;
  },

  // ── Safe Places ──────────────────────────────────────────────

  async createSafePlace(
    circleId: string,
    name: string,
    lat: number,
    lng: number,
    radiusM: number,
    createdBy: string
  ) {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "safe_places" (id, "circleId", "name", "radiusM", "createdBy", "createdAt", "location")
      VALUES (
        ${id},
        ${circleId},
        ${name},
        ${radiusM},
        ${createdBy},
        now(),
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      )
    `;
    return id;
  },

  async listSafePlacesForCircle(circleId: string) {
    return prisma.$queryRaw<
      Array<{ id: string; circleId: string; name: string; radiusM: number; lat: number; lng: number }>
    >`
      SELECT id, "circleId", name, "radiusM", ST_Y("location"::geometry) AS lat, ST_X("location"::geometry) AS lng
      FROM "safe_places"
      WHERE "circleId" = ${circleId}
    `;
  },

  async deleteSafePlace(safePlaceId: string) {
    await prisma.safePlace.delete({ where: { id: safePlaceId } });
  },

  /** For a given point, returns every Safe Place in the circle with its distance and inside/outside state. */
  async checkSafePlacesForPoint(circleId: string, lat: number, lng: number): Promise<SafePlaceWithDistance[]> {
    return prisma.$queryRaw<SafePlaceWithDistance[]>`
      SELECT
        id,
        "circleId",
        name,
        "radiusM",
        ST_Y("location"::geometry) AS lat,
        ST_X("location"::geometry) AS lng,
        ST_Distance("location", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS "distanceMeters",
        ST_DWithin("location", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, "radiusM") AS "isInside"
      FROM "safe_places"
      WHERE "circleId" = ${circleId}
    `;
  },
};
