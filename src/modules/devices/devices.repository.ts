import { prisma } from "@/db/prisma.client";
import type { DevicePlatform } from "@prisma/client";

export const devicesRepository = {
  listByUser(userId: string) {
    return prisma.device.findMany({ where: { userId }, orderBy: { lastSeenAt: "desc" } });
  },

  findById(deviceId: string) {
    return prisma.device.findUnique({ where: { id: deviceId } });
  },

  async upsert(userId: string, deviceId: string | undefined, platform: DevicePlatform, pushToken?: string) {
    return prisma.$transaction(async (tx) => {
      const existing = deviceId ? await tx.device.findUnique({ where: { id: deviceId } }) : null;
      const ownExisting = existing && existing.userId === userId ? existing : null;
      // One phone = one push token. If another account (or an older row) still
      // holds it — e.g. someone else logged out on this phone — detach it, or
      // they'd keep receiving this user's alerts.
      if (pushToken) {
        await tx.device.updateMany({
          where: { pushToken, ...(ownExisting ? { id: { not: ownExisting.id } } : {}) },
          data: { pushToken: null },
        });
      }
      if (ownExisting) {
        return tx.device.update({
          where: { id: ownExisting.id },
          data: { pushToken, platform, lastSeenAt: new Date() },
        });
      }
      // Unknown id, or one belonging to someone else: never touch their row.
      return tx.device.create({
        data: { ...(deviceId && !existing ? { id: deviceId } : {}), userId, platform, pushToken },
      });
    });
  },

  clearPushToken(deviceId: string) {
    return prisma.device.update({ where: { id: deviceId }, data: { pushToken: null } });
  },

  delete(deviceId: string) {
    return prisma.device.delete({ where: { id: deviceId } });
  },

  revokeRefreshTokensForDevice(deviceId: string) {
    return prisma.refreshToken.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
