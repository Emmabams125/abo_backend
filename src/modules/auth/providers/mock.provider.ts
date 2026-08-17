import { logger } from "@/common/utils/logger";
import type { SmsProvider } from "@/modules/auth/sms-provider.interface";

/** Test-only seam: lets integration tests read back the last code sent to a phone
 * number without parsing logs or breaking the OTP hash's one-wayness. Only ever
 * populated when SMS_PROVIDER=mock, which is never the case in production. */
export const mockSmsInbox = new Map<string, string>();

/** Logs the OTP instead of sending an SMS — used in development/test. */
export class MockSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    mockSmsInbox.set(phone, code);
    logger.info({ phone, code }, "[MockSmsProvider] OTP generated (not actually sent)");
  }
}
