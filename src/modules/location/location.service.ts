import { BadRequestError, ForbiddenError, NotFoundError } from "@/common/errors/app-error";
import { env } from "@/config/env";
import { circlesRepository } from "@/modules/circles/circles.repository";
import { locationRepository } from "@/modules/location/location.repository";
import { safePlaceEventsRepository } from "@/modules/location/safe-place-events.repository";
import { enqueuePush } from "@/queues/push.queue";
import { emitToCircle } from "@/realtime/socket.server";
import {
  SocketEvents,
  type LocationUpdatedPayload,
  type SafePlaceEventPayload,
} from "@/realtime/events";
import { prisma } from "@/db/prisma.client";

async function requireActiveMembership(circleId: string, userId: string) {
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new ForbiddenError("You are not a member of this Circle");
  }
  return membership;
}

async function recordSafePlaceTransition(
  circleId: string,
  safePlaceId: string,
  safePlaceName: string,
  userId: string,
  type: "ARRIVAL" | "DEPARTURE"
) {
  await safePlaceEventsRepository.createEvent(safePlaceId, userId, type);

  const occurredAt = new Date().toISOString();
  const payload: SafePlaceEventPayload = { safePlaceId, safePlaceName, userId, type, occurredAt };
  emitToCircle(circleId, SocketEvents.SafePlaceEvent, payload);

  const members = await circlesRepository.listActiveMemberships(circleId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const verb = type === "ARRIVAL" ? "arrived at" : "left";

  for (const member of members) {
    if (member.userId === userId) continue;
    await enqueuePush({
      userId: member.userId,
      message: {
        title: "Abo",
        body: `${user?.name ?? "A Circle member"} ${verb} ${safePlaceName}`,
        data: { type: "safe-place-event", safePlaceId, userId },
      },
    });
  }
}

/** FR-LOC-02: detects arrival/departure transitions and notifies the Circle. */
async function evaluateSafePlaces(circleId: string, userId: string, lat: number, lng: number) {
  const safePlaces = await locationRepository.checkSafePlacesForPoint(circleId, lat, lng);

  for (const place of safePlaces) {
    const lastType = await safePlaceEventsRepository.getLastEventType(place.id, userId);
    const wasInside = lastType === "ARRIVAL";

    if (place.isInside && !wasInside) {
      await recordSafePlaceTransition(circleId, place.id, place.name, userId, "ARRIVAL");
    } else if (!place.isInside && wasInside) {
      await recordSafePlaceTransition(circleId, place.id, place.name, userId, "DEPARTURE");
    }
  }
}

export const locationService = {
  /** FR-LOC-01: accepts a location ping and evaluates Safe Place transitions for every Circle the user is in. */
  async recordPing(userId: string, lat: number, lng: number, accuracy?: number, batteryPct?: number) {
    await locationRepository.insertPing(userId, lat, lng, accuracy, batteryPct);

    const circleIds = await circlesRepository.listActiveCircleIdsForUser(userId);
    const recordedAt = new Date().toISOString();

    for (const circleId of circleIds) {
      const payload: LocationUpdatedPayload = { userId, lat, lng, accuracy, batteryPct, recordedAt };
      emitToCircle(circleId, SocketEvents.LocationUpdated, payload);

      await evaluateSafePlaces(circleId, userId, lat, lng);
    }
  },

  async getLatestLocation(userId: string, requesterId: string, circleId: string) {
    await requireActiveMembership(circleId, requesterId);
    return locationRepository.getLatestLocationForUser(userId);
  },

  /** FR-LOC-03: history respects the Circle's configured retention window (default 7d, max 30d). */
  async getLocationHistory(userId: string, requesterId: string, circleId: string) {
    await requireActiveMembership(circleId, requesterId);
    const retention = await prisma.locationRetentionSetting.findUnique({ where: { circleId } });
    const retentionDays = retention?.retentionDays ?? env.LOCATION_RETENTION_DEFAULT_DAYS;
    const since = new Date(Date.now() - retentionDays * 86_400_000);
    return locationRepository.getLocationHistory(userId, since);
  },

  async updateRetentionSetting(circleId: string, actorId: string, retentionDays: number) {
    const membership = await requireActiveMembership(circleId, actorId);
    if (membership.role !== "ADMIN") throw new ForbiddenError("Only Circle Admins can change this setting");
    if (retentionDays < 1 || retentionDays > env.LOCATION_RETENTION_MAX_DAYS) {
      throw new BadRequestError(`Retention must be between 1 and ${env.LOCATION_RETENTION_MAX_DAYS} days`);
    }
    return prisma.locationRetentionSetting.upsert({
      where: { circleId },
      update: { retentionDays },
      create: { circleId, retentionDays },
    });
  },

  // ── Safe Places ──────────────────────────────────────────────

  /** FR-LOC-02: radius configurable 50m–500m. */
  async createSafePlace(circleId: string, actorId: string, name: string, lat: number, lng: number, radiusM: number) {
    await requireActiveMembership(circleId, actorId);
    if (radiusM < 50 || radiusM > 500) {
      throw new BadRequestError("Safe Place radius must be between 50 and 500 meters");
    }
    const id = await locationRepository.createSafePlace(circleId, name, lat, lng, radiusM, actorId);
    return { id, circleId, name, lat, lng, radiusM };
  },

  async listSafePlaces(circleId: string, requesterId: string) {
    await requireActiveMembership(circleId, requesterId);
    return locationRepository.listSafePlacesForCircle(circleId);
  },

  async deleteSafePlace(circleId: string, safePlaceId: string, actorId: string) {
    const membership = await requireActiveMembership(circleId, actorId);
    if (membership.role !== "ADMIN") throw new ForbiddenError("Only Circle Admins can remove Safe Places");
    const [existing] = await prisma.safePlace.findMany({ where: { id: safePlaceId, circleId } });
    if (!existing) throw new NotFoundError("Safe Place not found");
    await locationRepository.deleteSafePlace(safePlaceId);
  },
};
