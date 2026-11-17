import nodemailer from "nodemailer";
import { env } from "@/config/env";
import { logger } from "@/common/utils/logger";

let transporter: nodemailer.Transporter | null = null;

/**
 * Plain-text email to the team's own inbox (SUPPORT_EMAIL), e.g. a new
 * Community report to review. No-op without SMTP or a support address
 * (and in tests, where EMAIL_PROVIDER is "mock"). Never throws.
 */
export async function emailSupport(subject: string, text: string): Promise<void> {
  if (env.EMAIL_PROVIDER !== "smtp" || !env.SUPPORT_EMAIL) {
    logger.info({ subject }, "Support email skipped (no SMTP or SUPPORT_EMAIL)");
    return;
  }
  try {
    transporter ??= nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: env.EMAIL_FROM || `Abo <${env.SMTP_USER}>`,
      to: env.SUPPORT_EMAIL,
      subject,
      text,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message, subject }, "Support email failed");
  }
}
