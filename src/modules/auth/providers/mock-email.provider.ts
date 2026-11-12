import { logger } from "@/common/utils/logger";
import type { EmailProvider } from "@/modules/auth/email-provider.interface";

/** Test-only seam, same idea as mockSmsInbox: the last code sent to each
 * email address. Only populated when EMAIL_PROVIDER=mock. */
export const mockEmailInbox = new Map<string, string>();

/** Logs the OTP instead of emailing it — used in development/test. */
export class MockEmailProvider implements EmailProvider {
  async sendOtp(email: string, code: string): Promise<void> {
    mockEmailInbox.set(email, code);
    logger.info({ email, code }, "[MockEmailProvider] OTP generated (not actually sent)");
  }
}
