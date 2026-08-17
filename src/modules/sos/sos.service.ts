import { ForbiddenError, NotFoundError, TooManyRequestsError } from "@/common/errors/app-error";
import { decryptField } from "@/common/utils/encryption";
import { prisma } from "@/db/prisma.client";
import { circlesRepository } from "@/modules/circles/circles.repository";
import { locationRepository } from "@/modules/location/location.repository";
import { enqueueSosNotification } from "@/modules/sos/sos.queue";
import { sosRepository } from "@/modules/sos/sos.repository";
import { emitToCircle } from "@/realtime/socket.server";
import { SocketEvents, type SosAcknowledgedPayload, type SosTriggeredPayload } from "@/realtime/events";

const DUPLICATE_TRIGGER_WINDOW_MS = 15_000;

async function requireActiveAdmin(circleId: string, userId: string) {
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership || membership.status !== "ACTIVE" || membership.role !== "ADMIN") {
    throw new ForbiddenError("Only Circle Admins can view the SOS log");
  }
}

export const sosService = {
  /**
   * FR-SOS-01/02: trigger requires the client to have completed the 3s hold; this
   * only debounces accidental duplicate triggers. Broadcasts location, battery,
   * and medical info snapshot to the full Trusted Circle within 5s, with retries.
   */
  async trigger(userId: string, circleId: string) {
    const recent = await sosRepository.findRecentActiveTrigger(userId, DUPLICATE_TRIGGER_WINDOW_MS);
    if (recent) {
      throw new TooManyRequestsError("An SOS was already triggered moments ago");
    }

    const membership = await circlesRepository.findMembership(circleId, userId);
    if (!membership || membership.status !== "ACTIVE") {
      throw new ForbiddenError("You are not a member of this Circle");
    }

    const [user, latestLocation] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      locationRepository.getLatestLocationForUser(userId),
    ]);

    const payloadSnapshot = {
      location: latestLocation ? { lat: latestLocation.lat, lng: latestLocation.lng } : null,
      batteryPct: latestLocation?.batteryPct ?? null,
      medicalInfo: user.medicalInfoEncrypted ? decryptField(user.medicalInfoEncrypted) : null,
      emergencyContacts: user.emergencyContacts,
    };

    const members = await circlesRepository.listActiveMemberships(circleId);
    const memberIds = members.map((m) => m.userId).filter((id) => id !== userId);

    const event = await sosRepository.createSosEvent(userId, circleId, payloadSnapshot, memberIds);

    // Foreground members get this instantly over the socket.
    const socketPayload: SosTriggeredPayload = {
      sosEventId: event.id,
      userId,
      triggeredAt: event.triggeredAt.toISOString(),
      location: payloadSnapshot.location ?? { lat: 0, lng: 0 },
      batteryPct: payloadSnapshot.batteryPct ?? undefined,
    };
    emitToCircle(circleId, SocketEvents.SosTriggered, socketPayload);

    // Background/closed-app members get a guaranteed push via the dedicated queue.
    for (const memberId of memberIds) {
      await enqueueSosNotification({ sosEventId: event.id, memberId, triggeredByName: user.name ?? "A Circle member" });
    }

    return event;
  },

  async acknowledge(sosEventId: string, memberId: string) {
    const event = await sosRepository.findEventById(sosEventId);
    if (!event) throw new NotFoundError("SOS event not found");

    const updated = await sosRepository.acknowledge(sosEventId, memberId);
    const payload: SosAcknowledgedPayload = {
      sosEventId,
      memberId,
      acknowledgedAt: updated.acknowledgedAt!.toISOString(),
    };
    emitToCircle(event.circleId, SocketEvents.SosAcknowledged, payload);
    return updated;
  },

  async resolve(sosEventId: string, actorId: string) {
    const event = await sosRepository.findEventById(sosEventId);
    if (!event) throw new NotFoundError("SOS event not found");
    await requireActiveAdmin(event.circleId, actorId);
    return sosRepository.resolve(sosEventId);
  },

  /** FR-SOS-03: immutable log, visible to Circle Admins. */
  async getLog(sosEventId: string, requesterId: string) {
    const event = await sosRepository.findEventById(sosEventId);
    if (!event) throw new NotFoundError("SOS event not found");
    await requireActiveAdmin(event.circleId, requesterId);
    return sosRepository.getLog(sosEventId);
  },
};
