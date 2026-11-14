import { prisma } from "@/db/prisma.client";
import type { SOSDeliveryStatus } from "@prisma/client";

/** What Circle members may see of each other (no email / medical fields). */
const publicUserFields = { id: true, name: true, avatarUrl: true, phone: true } as const;

export const sosRepository = {
  findRecentActiveTrigger(userId: string, sinceMs: number) {
    return prisma.sOSEvent.findFirst({
      where: { userId, triggeredAt: { gte: new Date(Date.now() - sinceMs) } },
      orderBy: { triggeredAt: "desc" },
    });
  },

  async createSosEvent(userId: string, circleId: string, payloadSnapshot: object, memberIds: string[]) {
    return prisma.$transaction(async (tx) => {
      const event = await tx.sOSEvent.create({
        data: { userId, circleId, payloadSnapshot },
      });
      if (memberIds.length > 0) {
        await tx.sOSNotification.createMany({
          data: memberIds.map((memberId) => ({ sosEventId: event.id, memberId })),
        });
      }
      return event;
    });
  },

  findEventById(sosEventId: string) {
    return prisma.sOSEvent.findUnique({ where: { id: sosEventId }, include: { notifications: true } });
  },

  updateNotificationStatus(sosEventId: string, memberId: string, status: SOSDeliveryStatus) {
    return prisma.sOSNotification.update({
      where: { sosEventId_memberId: { sosEventId, memberId } },
      data: {
        deliveryStatus: status,
        deliveredAt: status === "DELIVERED" ? new Date() : undefined,
        attempts: { increment: 1 },
      },
    });
  },

  acknowledge(sosEventId: string, memberId: string) {
    return prisma.sOSNotification.update({
      where: { sosEventId_memberId: { sosEventId, memberId } },
      data: { acknowledgedAt: new Date() },
    });
  },

  resolve(sosEventId: string) {
    return prisma.sOSEvent.update({ where: { id: sosEventId }, data: { status: "RESOLVED" } });
  },

  attachVideo(sosEventId: string, videoPath: string) {
    return prisma.sOSEvent.update({ where: { id: sosEventId }, data: { videoUrl: videoPath } });
  },

  getLog(sosEventId: string) {
    return prisma.sOSEvent.findUnique({
      where: { id: sosEventId },
      include: {
        notifications: { include: { member: { select: publicUserFields } } },
        user: { select: publicUserFields },
      },
    });
  },

  /** Unresolved SOS events in a Circle from the last [sinceMs]. */
  listActiveForCircle(circleId: string, sinceMs: number) {
    return prisma.sOSEvent.findMany({
      where: { circleId, status: "ACTIVE", triggeredAt: { gte: new Date(Date.now() - sinceMs) } },
      include: { user: { select: publicUserFields } },
      orderBy: { triggeredAt: "desc" },
    });
  },
};
