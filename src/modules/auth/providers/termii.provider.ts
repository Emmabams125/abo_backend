import { env } from "@/config/env";
import { logger } from "@/common/utils/logger";
import type { SmsProvider } from "@/modules/auth/sms-provider.interface";

/** Termii SMS provider — Nigeria-first delivery reliability (FRD §28). */
export class TermiiSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string): Promise<void> {
    // Termii expects the number without the leading "+" (e.g. "2348012345678"),
    // but this app stores/validates phone in E.164 with one (see phoneSchema).
    const to = phone.replace(/^\+/, "");

    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from: env.TERMII_SENDER_ID,
        sms: `Your Abo verification code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes.`,
        type: "plain",
        // "generic" is Termii's promotional route and gets filtered for
        // numbers registered on Nigeria's DND list — OTPs are transactional
        // and must go via "dnd" to reliably reach every number.
        channel: "dnd",
        api_key: env.TERMII_API_KEY,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body }, "Termii OTP send failed");
      throw new Error("Failed to send OTP SMS");
    }
  }
}
