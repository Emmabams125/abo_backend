import { ForbiddenError, NotFoundError, TooManyRequestsError } from "@/common/errors/app-error";
import { decryptField } from "@/common/utils/encryption";
import { prisma } from "@/db/prisma.client";
import { circlesRepository } from "@/modules/circles/circles.repository";
import { locationRepository } from "@/modules/location/location.repository";
import { enqueueSosNotification } from "@/modules/sos/sos.queue";
import { SOS_ACTIVE_WINDOW_MS, sosRepository } from "@/modules/sos/sos.repository";
import { emitToCircle } from "@/realtime/socket.server";
import { SocketEvents, type SosAcknowledgedPayload, type SosTriggeredPayload } from "@/realtime/events";
import { createReadUrl } from "@/storage/supabase-storage";

const SOS_VIDEO_BUCKET = "sos-videos";

const DUPLICATE_TRIGGER_WINDOW_MS = 15_000;

async function requireActiveMember(circleId: string, userId: string) {
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new ForbiddenError("You are not a member of this Circle");
  }
  return membership;
}

/** Tell open SOS screens in the Circle to refetch. */
function notifySosUpdated(circleId: string, sosEventId: string) {
  emitToCircle(circleId, SocketEvents.SosUpdated, { sosEventId });
}

interface SosSnapshot {
  location?: { lat: number; lng: number } | null;
  batteryPct?: number | null;
  medicalInfo?: string | null;
  emergencyContacts?: unknown;
}

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
    notifySosUpdated(event.circleId, sosEventId);
    return updated;
  },

  /** The person who sent the SOS ("I'm safe now") or a Circle Admin can close it. */
  async resolve(sosEventId: string, actorId: string) {
    const event = await sosRepository.findEventById(sosEventId);
    if (!event) throw new NotFoundError("SOS event not found");
    // Anyone in the Circle can close it (e.g. they found them and they're
    // fine) — otherwise an SOS the sender can't close stays red for everyone.
    if (event.userId !== actorId) await requireActiveMember(event.circleId, actorId);
    const resolved = await sosRepository.resolve(sosEventId);
    notifySosUpdated(event.circleId, sosEventId);
    return resolved;
  },

  /**
   * What a Circle member sees when they open an SOS (from the alert or a push):
   * who, when, where, battery, the safety info they chose to share, who has
   * responded, and the video (a short-lived signed link, never stored public).
   */
  async getDetails(sosEventId: string, requesterId: string) {
    const event = await sosRepository.getLog(sosEventId);
    if (!event) throw new NotFoundError("SOS event not found");
    await requireActiveMember(event.circleId, requesterId);
    const snapshot = (event.payloadSnapshot ?? {}) as SosSnapshot;

    return {
      id: event.id,
      circleId: event.circleId,
      status: event.status,
      triggeredAt: event.triggeredAt,
      sender: event.user,
      location: snapshot.location ?? null,
      batteryPct: snapshot.batteryPct ?? null,
      medicalInfo: snapshot.medicalInfo ?? null,
      emergencyContacts: snapshot.emergencyContacts ?? null,
      videoUrl: event.videoUrl ? await createReadUrl(SOS_VIDEO_BUCKET, event.videoUrl) : null,
      responders: event.notifications
        .filter((n) => n.acknowledgedAt)
        .map((n) => ({ userId: n.memberId, name: n.member.name, acknowledgedAt: n.acknowledgedAt })),
    };
  },

  /** Unresolved SOS events in the last 24h, so a missed alert still shows on Home. */
  async listActive(circleId: string, requesterId: string) {
    await requireActiveMember(circleId, requesterId);
    await sosRepository.expireStale(circleId);
    const events = await sosRepository.listActiveForCircle(circleId, SOS_ACTIVE_WINDOW_MS);
    return events.map((e) => ({ id: e.id, triggeredAt: e.triggeredAt, sender: e.user }));
  },

  /** FR-SOS-03: immutable log, visible to Circle Admins. */
  async getLog(sosEventId: string, requesterId: string) {
    const event = await sosRepository.findEventById(sosEventId);
    if (!event) throw new NotFoundError("SOS event not found");
    await requireActiveAdmin(event.circleId, requesterId);
    const log = await sosRepository.getLog(sosEventId);

    // videoUrl is a private-bucket path (see sos.validation.ts's attachVideoSchema
    // comment) — resolved to a short-lived signed URL only here, at view time,
    // never stored or returned as a permanently-public link.
    if (log?.videoUrl) {
      return { ...log, videoUrl: await createReadUrl(SOS_VIDEO_BUCKET, log.videoUrl) };
    }
    return log;
  },

  /** Author-only: only the person who triggered the SOS can attach their own recording. */
  async attachVideo(sosEventId: string, userId: string, videoPath: string) {
    const event = await sosRepository.findEventById(sosEventId);
    if (!event) throw new NotFoundError("SOS event not found");
    if (event.userId !== userId) {
      throw new ForbiddenError("Only the person who triggered this SOS can attach a video to it");
    }

    const updated = await sosRepository.attachVideo(sosEventId, videoPath);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const members = await circlesRepository.listActiveMemberships(event.circleId);
    for (const member of members) {
      if (member.userId === userId) continue;
      await enqueueSosNotification({
        sosEventId,
        memberId: member.userId,
        triggeredByName: user?.name ?? "A Circle member",
        videoAttached: true,
      });
    }

    notifySosUpdated(event.circleId, sosEventId);
    return updated;
  },
};
