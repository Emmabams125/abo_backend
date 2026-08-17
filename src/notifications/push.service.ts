import type { DevicePlatform } from "@prisma/client";
import { ApnsPushProvider } from "@/notifications/apns.provider";
import { FcmPushProvider } from "@/notifications/fcm.provider";
import type { PushMessage, PushSendResult } from "@/notifications/push-provider.interface";

const fcm = new FcmPushProvider();
const apns = new ApnsPushProvider();

export const pushService = {
  async sendToDevice(platform: DevicePlatform, pushToken: string, message: PushMessage): Promise<PushSendResult> {
    const provider = platform === "ANDROID" ? fcm : apns;
    return provider.send(pushToken, message);
  },
};
