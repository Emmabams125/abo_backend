import { randomUUID } from "node:crypto";
import { Prisma, type CommunityAlertKind } from "@prisma/client";
import { prisma } from "@/db/prisma.client";

export interface NearbyAlert {
  id: string;
  authorId: string;
  kind: CommunityAlertKind;
  title: string;
  description: string | null;
  placeLabel: string;
  createdAt: Date;
  distanceMeters: number;
}

/** All raw PostGIS SQL is isolated here — nothing above this layer touches geometry directly. */
export const communityRepository = {
  async createAlert(
    authorId: string,
    kind: CommunityAlertKind,
    title: string,
    placeLabel: string,
    lat: number,
    lng: number,
    expiresAt: Date,
    description?: string
  ) {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "community_alerts"
        (id, "authorId", "kind", "title", "description", "placeLabel", "expiresAt", "createdAt", "location")
      VALUES (
        ${id},
        ${authorId},
        ${kind}::"CommunityAlertKind",
        ${title},
        ${description ?? null},
        ${placeLabel},
        ${expiresAt},
        now(),
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      )
    `;
    return id;
  },

  /**
   * Never returns the alert's exact coordinates — only distance from the
   * requester's point — so a viewer can't derive another user's precise
   * location from an alert they didn't post.
   */
  listNearby(lat: number, lng: number, radiusM: number, kind?: CommunityAlertKind): Promise<NearbyAlert[]> {
    const kindFilter = kind ? Prisma.sql`AND "kind" = ${kind}::"CommunityAlertKind"` : Prisma.empty;
    return prisma.$queryRaw<NearbyAlert[]>`
      SELECT
        id,
        "authorId",
        "kind",
        "title",
        "description",
        "placeLabel",
        "createdAt",
        ST_Distance("location", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) AS "distanceMeters"
      FROM "community_alerts"
      WHERE "status" = 'ACTIVE'
        AND "expiresAt" > now()
        AND ST_DWithin("location", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusM})
        ${kindFilter}
      ORDER BY "createdAt" DESC
    `;
  },

  findById(alertId: string) {
    return prisma.communityAlert.findUnique({ where: { id: alertId } });
  },

  markResolved(alertId: string) {
    return prisma.communityAlert.update({
      where: { id: alertId },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  },
};
