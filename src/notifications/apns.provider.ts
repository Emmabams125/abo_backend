import apn from "@parse/node-apn";
import { env } from "@/config/env";
import { logger } from "@/common/utils/logger";
import type { PushMessage, PushProvider, PushSendResult } from "@/notifications/push-provider.interface";

let provider: apn.Provider | undefined;

function getProvider(): apn.Provider {
  if (provider) return provider;
  if (!env.APNS_KEY_ID || !env.APNS_TEAM_ID || !env.APNS_PRIVATE_KEY_PATH) {
    throw new Error("APNs credentials are not configured");
  }
  provider = new apn.Provider({
    token: {
      key: env.APNS_PRIVATE_KEY_PATH,
      keyId: env.APNS_KEY_ID,
      teamId: env.APNS_TEAM_ID,
    },
    production: env.APNS_PRODUCTION,
  });
  return provider;
}

export class ApnsPushProvider implements PushProvider {
  async send(pushToken: string, message: PushMessage): Promise<PushSendResult> {
    const notification = new apn.Notification();
    notification.alert = { title: message.title, body: message.body };
    notification.topic = env.APNS_BUNDLE_ID;
    notification.payload = message.data ?? {};
    notification.priority = 10;

    const result = await getProvider().send(notification, pushToken);

    if (result.failed.length > 0) {
      const failure = result.failed[0];
      logger.error({ pushToken, response: failure?.response }, "APNs send failed");
      return { success: false, error: failure?.response?.reason };
    }
    return { success: true };
  }
}
