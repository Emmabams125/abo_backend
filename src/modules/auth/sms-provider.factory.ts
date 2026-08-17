import { env } from "@/config/env";
import { MockSmsProvider } from "@/modules/auth/providers/mock.provider";
import { TermiiSmsProvider } from "@/modules/auth/providers/termii.provider";
import type { SmsProvider } from "@/modules/auth/sms-provider.interface";

export function createSmsProvider(): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case "termii":
      return new TermiiSmsProvider();
    case "mock":
    default:
      return new MockSmsProvider();
  }
}
