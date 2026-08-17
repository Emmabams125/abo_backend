import { prisma } from "@/db/prisma.client";
import type { SafePlaceEventType } from "@prisma/client";

export const safePlaceEventsRepository = {
  getLastEventType(safePlaceId: string, userId: string): Promise<SafePlaceEventType | null> {
    return prisma.safePlaceEvent
      .findFirst({
        where: { safePlaceId, userId },
        orderBy: { occurredAt: "desc" },
        select: { type: true },
      })
      .then((row) => row?.type ?? null);
  },

  createEvent(safePlaceId: string, userId: string, type: SafePlaceEventType) {
    return prisma.safePlaceEvent.create({ data: { safePlaceId, userId, type } });
  },

  listEventsForCircle(circleId: string, since: Date) {
    return prisma.safePlaceEvent.findMany({
      where: { safePlace: { circleId }, occurredAt: { gte: since } },
      include: { safePlace: true, user: true },
      orderBy: { occurredAt: "desc" },
    });
  },
};
