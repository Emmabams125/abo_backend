import { ForbiddenError, NotFoundError } from "@/common/errors/app-error";
import { devicesRepository } from "@/modules/devices/devices.repository";
import type { DevicePlatform } from "@prisma/client";

export const devicesService = {
  listDevices(userId: string) {
    return devicesRepository.listByUser(userId);
  },

  registerDevice(userId: string, deviceId: string | undefined, platform: DevicePlatform, pushToken?: string) {
    return devicesRepository.upsert(userId, deviceId, platform, pushToken);
  },

  /** FR-PRO-03: unpairing a device immediately revokes its access to Circle data. */
  async unpairDevice(userId: string, deviceId: string) {
    const device = await devicesRepository.findById(deviceId);
    if (!device) throw new NotFoundError("Device not found");
    if (device.userId !== userId) throw new ForbiddenError("This device does not belong to you");

    await devicesRepository.revokeRefreshTokensForDevice(deviceId);
    await devicesRepository.delete(deviceId);
  },
};
