import { ForbiddenError } from "@/common/errors/app-error";
import { prisma } from "@/db/prisma.client";
import { circlesRepository } from "@/modules/circles/circles.repository";
import { reassuranceRepository } from "@/modules/reassurance/reassurance.repository";
import { enqueuePush } from "@/queues/push.queue";
import { emitToCircle } from "@/realtime/socket.server";
import { SocketEvents, type CheckInCreatedPayload } from "@/realtime/events";

async function requireActiveMembership(circleId: string, userId: string) {
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new ForbiddenError("You are not a member of this Circle");
  }
  return membership;
}

export const reassuranceService = {
  /** FR-RSR-01: one tap broadcasts "I'm Okay" to the full Circle — no location/call/message attached. */
  async checkIn(userId: string, circleId: string) {
    await requireActiveMembership(circleId, userId);
    const checkIn = await reassuranceRepository.createCheckIn(userId, circleId);

    const payload: CheckInCreatedPayload = { userId, createdAt: checkIn.createdAt.toISOString() };
    emitToCircle(circleId, SocketEvents.CheckInCreated, payload);

    const [user, members] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      circlesRepository.listActiveMemberships(circleId),
    ]);

    for (const member of members) {
      if (member.userId === userId) continue;
      await enqueuePush({
        userId: member.userId,
        message: {
          title: "Abo",
          body: `${user?.name ?? "A Circle member"} checked in: I'm okay`,
          data: { type: "check-in", userId },
        },
      });
    }

    return checkIn;
  },

  /** FR-RSR-02: at least the last 10 check-ins per member. */
  async getCircleHistory(circleId: string, requesterId: string) {
    await requireActiveMembership(circleId, requesterId);
    return reassuranceRepository.listRecentForCircle(circleId);
  },

  /**
   * FR-RSR-03: a soft, local-notification-only reminder — never escalates to the
   * Circle if missed. The backend only persists the schedule for cross-device
   * sync; firing the actual reminder is a client-side local notification.
   */
  createReminder(userId: string, remindAt: Date) {
    return reassuranceRepository.createReminder(userId, remindAt);
  },

  listReminders(userId: string) {
    return reassuranceRepository.listUpcomingReminders(userId);
  },

  async deleteReminder(userId: string, reminderId: string) {
    const reminders = await reassuranceRepository.listUpcomingReminders(userId);
    if (!reminders.some((r) => r.id === reminderId)) {
      throw new ForbiddenError("This reminder does not belong to you");
    }
    await reassuranceRepository.deleteReminder(reminderId);
  },
};
