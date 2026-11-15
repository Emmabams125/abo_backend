import { ForbiddenError } from "@/common/errors/app-error";
import { prisma } from "@/db/prisma.client";
import { circlesRepository } from "@/modules/circles/circles.repository";
import { sosRepository } from "@/modules/sos/sos.repository";

/** What Circle members may see of each other in the feed. */
const person = { select: { id: true, name: true, avatarUrl: true } } as const;

export type ActivityType = "CHECK_IN" | "SOS" | "SAFE_PLACE_ARRIVAL" | "SAFE_PLACE_DEPARTURE" | "MEMBER_JOINED";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  occurredAt: Date;
  user: { id: string; name: string | null; avatarUrl: string | null };
  placeName?: string;
  sosEventId?: string;
  sosStatus?: string;
}

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The Circle's recent activity — check-ins, SOS alerts, Safe Place arrivals
 * and departures, and people joining — merged newest first. Optionally for
 * one member (their profile screen).
 */
export async function listCircleActivity(
  circleId: string,
  requesterId: string,
  options: { userId?: string; limit?: number } = {}
): Promise<ActivityItem[]> {
  const membership = await circlesRepository.findMembership(circleId, requesterId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new ForbiddenError("You are not a member of this Circle");
  }

  await sosRepository.expireStale(circleId);
  const since = new Date(Date.now() - WINDOW_MS);
  const limit = Math.min(options.limit ?? 50, 100);
  const userFilter = options.userId ? { userId: options.userId } : {};

  const [checkIns, sosEvents, placeEvents, joins] = await Promise.all([
    prisma.checkIn.findMany({
      where: { circleId, createdAt: { gte: since }, ...userFilter },
      include: { user: person },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.sOSEvent.findMany({
      where: { circleId, triggeredAt: { gte: since }, ...userFilter },
      include: { user: person },
      orderBy: { triggeredAt: "desc" },
      take: limit,
    }),
    prisma.safePlaceEvent.findMany({
      where: { safePlace: { circleId }, occurredAt: { gte: since }, ...userFilter },
      include: { user: person, safePlace: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
      take: limit,
    }),
    prisma.circleMembership.findMany({
      where: { circleId, status: "ACTIVE", joinedAt: { gte: since }, ...userFilter },
      include: { user: person },
      orderBy: { joinedAt: "desc" },
      take: limit,
    }),
  ]);

  const items: ActivityItem[] = [
    ...checkIns.map((c) => ({ id: `check-in:${c.id}`, type: "CHECK_IN" as const, occurredAt: c.createdAt, user: c.user })),
    ...sosEvents.map((s) => ({
      id: `sos:${s.id}`,
      type: "SOS" as const,
      occurredAt: s.triggeredAt,
      user: s.user,
      sosEventId: s.id,
      sosStatus: s.status,
    })),
    ...placeEvents.map((e) => ({
      id: `place:${e.id}`,
      type: e.type === "ARRIVAL" ? ("SAFE_PLACE_ARRIVAL" as const) : ("SAFE_PLACE_DEPARTURE" as const),
      occurredAt: e.occurredAt,
      user: e.user,
      placeName: e.safePlace.name,
    })),
    ...joins.map((m) => ({ id: `joined:${m.id}`, type: "MEMBER_JOINED" as const, occurredAt: m.joinedAt, user: m.user })),
  ];

  return items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit);
}
