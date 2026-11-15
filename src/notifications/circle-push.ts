import { logger } from "@/common/utils/logger";
import { redis } from "@/config/redis";
import { prisma } from "@/db/prisma.client";
import { circlesRepository } from "@/modules/circles/circles.repository";
import { enqueuePush } from "@/queues/push.queue";
import type { PushMessage } from "@/notifications/push-provider.interface";

/**
 * Small helpers for "tell these people about this" pushes. Never throws:
 * a push that can't be queued must not fail the request that caused it
 * (the in-app socket events still reach anyone with the app open).
 */

export async function nameOf(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const name = user?.name?.trim();
  return name ? name : "A Circle member";
}

export async function circleNameOf(circleId: string): Promise<string> {
  const circle = await circlesRepository.findCircleById(circleId);
  return circle?.name ?? "your Circle";
}

export async function pushToUsers(userIds: string[], message: PushMessage): Promise<void> {
  for (const userId of new Set(userIds)) {
    try {
      await enqueuePush({ userId, message });
    } catch (err) {
      logger.warn({ err: (err as Error).message, userId }, "Could not queue push");
    }
  }
}

/** Every active member of the Circle except `exclude`. */
export async function pushToCircle(circleId: string, message: PushMessage, exclude: string[] = []): Promise<void> {
  try {
    const members = await circlesRepository.listActiveMemberships(circleId);
    await pushToUsers(
      members.map((m) => m.userId).filter((id) => !exclude.includes(id)),
      message
    );
  } catch (err) {
    logger.warn({ err: (err as Error).message, circleId }, "Could not push to Circle");
  }
}

export async function pushToAdmins(circleId: string, message: PushMessage): Promise<void> {
  try {
    const admins = await prisma.circleMembership.findMany({
      where: { circleId, role: "ADMIN", status: "ACTIVE" },
      select: { userId: true },
    });
    await pushToUsers(
      admins.map((a) => a.userId),
      message
    );
  } catch (err) {
    logger.warn({ err: (err as Error).message, circleId }, "Could not push to Circle Admins");
  }
}

export const LOW_BATTERY_PCT = 15;
const LOW_BATTERY_COOLDOWN_SECONDS = 24 * 60 * 60;

/**
 * "Ada's phone is at 10%" to everyone in Ada's Circles, at most once a day,
 * so a phone dying isn't mistaken for something worse.
 */
export async function maybeNotifyLowBattery(userId: string, batteryPct: number | undefined): Promise<void> {
  if (batteryPct === undefined || batteryPct === null || batteryPct > LOW_BATTERY_PCT) return;
  try {
    const first = await redis.set(`abo:low-battery:${userId}`, "1", "EX", LOW_BATTERY_COOLDOWN_SECONDS, "NX");
    if (first !== "OK") return;

    const name = await nameOf(userId);
    const memberships = await prisma.circleMembership.findMany({
      where: { userId, status: "ACTIVE" },
      select: { circleId: true },
    });
    for (const { circleId } of memberships) {
      await pushToCircle(
        circleId,
        {
          title: `🔋 ${name}'s phone is at ${batteryPct}%`,
          body: "It may switch off soon, so their location could stop updating.",
          data: { type: "low-battery", userId, circleId },
        },
        [userId]
      );
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message, userId }, "Low battery push failed");
  }
}
