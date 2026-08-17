import { ForbiddenError } from "@/common/errors/app-error";
import { prisma } from "@/db/prisma.client";
import { circlesRepository } from "@/modules/circles/circles.repository";
import { locationRepository } from "@/modules/location/location.repository";

export type SafetyStatus = "SAFE" | "AT_SAFE_PLACE" | "DRIVING" | "SOS";

export interface MemberStatus {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  status: SafetyStatus;
  placeLabel: string | null;
  lastUpdatedAt: string | null;
  batteryPct: number | null;
}

async function requireActiveMembership(circleId: string, userId: string) {
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new ForbiddenError("You are not a member of this Circle");
  }
}

async function resolveMemberStatus(circleId: string, userId: string): Promise<MemberStatus> {
  const [membership, activeSos, location] = await Promise.all([
    circlesRepository.findMembership(circleId, userId),
    prisma.sOSEvent.findFirst({ where: { circleId, userId, status: "ACTIVE" } }),
    locationRepository.getLatestLocationForUser(userId),
  ]);

  const user = membership ? await prisma.user.findUnique({ where: { id: membership.userId } }) : null;

  let status: SafetyStatus = "SAFE";
  let placeLabel: string | null = null;

  if (activeSos) {
    status = "SOS";
  } else if (location) {
    const safePlaces = await locationRepository.checkSafePlacesForPoint(circleId, location.lat, location.lng);
    const insidePlace = safePlaces.find((p) => p.isInside);
    if (insidePlace) {
      status = "AT_SAFE_PLACE";
      placeLabel = insidePlace.name;
    }
    // Driving status depends on the (Should-have, not-yet-built) Driving Insights module —
    // defaults to SAFE/AT_SAFE_PLACE until that module exists.
  }

  return {
    userId,
    name: user?.name ?? null,
    avatarUrl: user?.avatarUrl ?? null,
    role: membership?.role ?? "ADULT",
    status,
    placeLabel,
    lastUpdatedAt: location?.recordedAt?.toISOString() ?? null,
    batteryPct: location?.batteryPct ?? null,
  };
}

export const homeService = {
  /** FR-HOME-01/02: circle-wide safety summary + per-member status. */
  async getDashboard(circleId: string, requesterId: string) {
    await requireActiveMembership(circleId, requesterId);

    const memberships = await circlesRepository.listActiveMemberships(circleId);
    const members = await Promise.all(memberships.map((m) => resolveMemberStatus(circleId, m.userId)));

    const allSafe = members.every((m) => m.status === "SAFE" || m.status === "AT_SAFE_PLACE");

    return {
      circleId,
      allSafe,
      members,
      // FR-HOME-04: Community Board is Could-have and not yet built in this phase —
      // returns an empty list rather than fabricating data, so the client can render
      // the section as "nothing nearby" instead of erroring.
      missingNearby: [] as unknown[],
    };
  },
};
