import type { CommunityAlertKind } from "@prisma/client";
import { env } from "@/config/env";
import { ForbiddenError, NotFoundError } from "@/common/errors/app-error";
import { communityRepository } from "@/modules/community/community.repository";

function computeExpiresAt(kind: CommunityAlertKind) {
  const ttlMs =
    kind === "HAZARD"
      ? env.COMMUNITY_HAZARD_TTL_HOURS * 3_600_000
      : env.COMMUNITY_ALERT_TTL_DAYS * 86_400_000;
  return new Date(Date.now() + ttlMs);
}

export const communityService = {
  async createAlert(
    authorId: string,
    input: {
      kind: CommunityAlertKind;
      title: string;
      description?: string;
      placeLabel: string;
      lat: number;
      lng: number;
    }
  ) {
    const expiresAt = computeExpiresAt(input.kind);
    const id = await communityRepository.createAlert(
      authorId,
      input.kind,
      input.title,
      input.placeLabel,
      input.lat,
      input.lng,
      expiresAt,
      input.description
    );
    return { id, expiresAt, ...input };
  },

  /** Cross-circle by design — any authenticated user can see alerts near their own point. */
  listNearby(query: { lat: number; lng: number; radiusM: number; kind?: CommunityAlertKind }) {
    return communityRepository.listNearby(query.lat, query.lng, query.radiusM, query.kind);
  },

  async resolveAlert(alertId: string, userId: string) {
    const alert = await communityRepository.findById(alertId);
    if (!alert) throw new NotFoundError("Alert not found");
    if (alert.authorId !== userId) {
      throw new ForbiddenError("Only the original poster can resolve this alert");
    }
    return communityRepository.markResolved(alertId);
  },
};
