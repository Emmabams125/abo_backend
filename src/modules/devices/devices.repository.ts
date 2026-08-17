import { prisma } from "@/db/prisma.client";
import type { DevicePlatform } from "@prisma/client";

export const devicesRepository = {
  listByUser(userId: string) {
    return prisma.device.findMany({ where: { userId }, orderBy: { lastSeenAt: "desc" } });
  },

  findById(deviceId: string) {
    return prisma.device.findUnique({ where: { id: deviceId } });
  },

  upsert(userId: string, deviceId: string | undefined, platform: DevicePlatform, pushToken?: string) {
    if (deviceId) {
      return prisma.device.upsert({
        where: { id: deviceId },
        update: { pushToken, lastSeenAt: new Date() },
        create: { id: deviceId, userId, platform, pushToken },
      });
    }
    return prisma.device.create({ data: { userId, platform, pushToken } });
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
