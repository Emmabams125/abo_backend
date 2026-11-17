import type { CommunityAlertKind, MediaType } from "@prisma/client";
import { env } from "@/config/env";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/common/errors/app-error";
import { prisma } from "@/db/prisma.client";
import { emailSupport } from "@/notifications/support-mail";
import { communityRepository } from "@/modules/community/community.repository";

function computeExpiresAt(kind: CommunityAlertKind) {
  const ttlMs =
    kind === "HAZARD"
      ? env.COMMUNITY_HAZARD_TTL_HOURS * 3_600_000
      : env.COMMUNITY_ALERT_TTL_DAYS * 86_400_000;
  return new Date(Date.now() + ttlMs);
}

/** Distinct user reports that take a post down for everyone pending review. */
export const AUTO_HIDE_REPORTS = 3;

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
      mediaUrl?: string;
      mediaType?: MediaType;
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
      input.description,
      input.mediaUrl,
      input.mediaType
    );
    return { id, expiresAt, ...input };
  },

  /** Cross-circle by design — any authenticated user can see alerts near their own point. */
  listNearby(viewerId: string, query: { lat: number; lng: number; radiusM: number; kind?: CommunityAlertKind }) {
    return communityRepository.listNearby(query.lat, query.lng, query.radiusM, query.kind, viewerId);
  },

  /**
   * A user flags a post. The reporter stops seeing it at once; at
   * AUTO_HIDE_REPORTS distinct reports it's hidden for everyone. Each report
   * is emailed to the support inbox for review (see scripts/moderate.ts).
   */
  async reportAlert(alertId: string, reporterId: string, reason: string, details?: string) {
    const alert = await communityRepository.findById(alertId);
    if (!alert) throw new NotFoundError("Alert not found");
    if (alert.authorId === reporterId) throw new BadRequestError("You can't report your own post");

    const existing = await prisma.communityReport.findUnique({
      where: { alertId_reporterId: { alertId, reporterId } },
    });
    if (!existing) {
      await prisma.communityReport.create({ data: { alertId, reporterId, reason, details: details || null } });
    }

    const reports = await prisma.communityReport.count({ where: { alertId } });
    let hidden = alert.status === "HIDDEN";
    if (!hidden && reports >= AUTO_HIDE_REPORTS) {
      await prisma.communityAlert.update({ where: { id: alertId }, data: { status: "HIDDEN" } });
      hidden = true;
    }

    if (!existing) {
      await emailSupport(
        `Community report (${reason})${hidden ? " – post hidden" : ""}: ${alert.title}`,
        [
          `A Community post was reported in Abo.`,
          ``,
          `Post: ${alert.title}`,
          `Kind: ${alert.kind}`,
          `Place: ${alert.placeLabel}`,
          alert.description ? `Description: ${alert.description}` : null,
          alert.mediaUrl ? `Media: ${alert.mediaUrl}` : null,
          `Post ID: ${alert.id}`,
          `Author user ID: ${alert.authorId}`,
          ``,
          `Reason: ${reason}`,
          details ? `Reporter's note: ${details}` : null,
          `Total reports: ${reports}${hidden ? " (hidden from everyone)" : ` (hidden automatically at ${AUTO_HIDE_REPORTS})`}`,
          ``,
          `Review on the server: npx tsx scripts/moderate.ts show ${alert.id}`,
          `Hide:    npx tsx scripts/moderate.ts hide ${alert.id}`,
          `Restore: npx tsx scripts/moderate.ts restore ${alert.id}`,
        ]
          .filter((l) => l !== null)
          .join("\n")
      );
    }
    return { reported: true, hidden };
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
