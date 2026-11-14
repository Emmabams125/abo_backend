import admin from "firebase-admin";
import { env } from "@/config/env";
import { logger } from "@/common/utils/logger";
import type { PushMessage, PushProvider, PushSendResult } from "@/notifications/push-provider.interface";

let app: admin.app.App | undefined;

const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

function getApp(): admin.app.App {
  if (app) return app;
  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY) {
    throw new Error("FCM credentials are not configured");
  }
  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FCM_PROJECT_ID,
      clientEmail: env.FCM_CLIENT_EMAIL,
      privateKey: env.FCM_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  return app;
}

export class FcmPushProvider implements PushProvider {
  async send(pushToken: string, message: PushMessage): Promise<PushSendResult> {
    try {
      await getApp()
        .messaging()
        .send({
          token: pushToken,
          notification: { title: message.title, body: message.body },
          data: message.data,
          android: {
            priority: "high",
            notification: {
              channelId: message.channel ?? "circle_updates",
              sound: "default",
              ...(message.channel === "sos_alerts" ? { priority: "max" as const, defaultVibrateTimings: true } : {}),
            },
          },
        });
      return { success: true };
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      const invalidToken = DEAD_TOKEN_CODES.has(code);
      if (invalidToken) {
        logger.info({ code }, "FCM token no longer valid");
      } else {
        logger.error({ err }, "FCM send failed");
      }
      return { success: false, error: (err as Error).message, invalidToken };
    }
  }
}
