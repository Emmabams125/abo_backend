import { prisma } from "@/db/prisma.client";

export const reassuranceRepository = {
  createCheckIn(userId: string, circleId: string) {
    return prisma.checkIn.create({ data: { userId, circleId } });
  },

  /** FR-RSR-02: history shows at minimum the last 10 check-ins per member. */
  listRecentForCircle(circleId: string, limit = 10) {
    return prisma.checkIn.findMany({
      where: { circleId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  listRecentForUser(userId: string, circleId: string, limit = 10) {
    return prisma.checkIn.findMany({
      where: { userId, circleId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  createReminder(userId: string, remindAt: Date) {
    return prisma.checkInReminder.create({ data: { userId, remindAt } });
  },

  listUpcomingReminders(userId: string) {
    return prisma.checkInReminder.findMany({
      where: { userId, remindAt: { gte: new Date() } },
      orderBy: { remindAt: "asc" },
    });
  },

  deleteReminder(reminderId: string) {
    return prisma.checkInReminder.delete({ where: { id: reminderId } });
  },
};
