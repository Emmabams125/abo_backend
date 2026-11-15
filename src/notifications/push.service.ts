import type { DevicePlatform } from "@prisma/client";
import { FcmPushProvider } from "@/notifications/fcm.provider";
import type { PushMessage, PushSendResult } from "@/notifications/push-provider.interface";

const fcm = new FcmPushProvider();

export const pushService = {
  /**
   * Every token the app registers is an FCM token: firebase_messaging hands
   * out FCM tokens on iOS too, and FCM relays to APNs (the APNs auth key is
   * uploaded in the Firebase console). So iOS goes through FCM as well;
   * sending an FCM token straight to APNs would always fail.
   */
  async sendToDevice(_platform: DevicePlatform, pushToken: string, message: PushMessage): Promise<PushSendResult> {
    return fcm.send(pushToken, message);
  },
};
