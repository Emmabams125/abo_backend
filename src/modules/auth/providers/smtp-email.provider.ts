import nodemailer from "nodemailer";
import { env } from "@/config/env";
import { logger } from "@/common/utils/logger";
import type { EmailProvider } from "@/modules/auth/email-provider.interface";

/** Sends OTP emails over SMTP (a Gmail app password by default). */
export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  async sendOtp(email: string, code: string): Promise<void> {
    const minutes = env.OTP_TTL_MINUTES;
    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM || `Abo <${env.SMTP_USER}>`,
        to: email,
        subject: `${code} is your Abo verification code`,
        text: `Your Abo verification code is ${code}. It expires in ${minutes} minutes.\n\nIf you didn't request this, you can ignore this email.`,
        html: `<p>Your Abo verification code is</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>
<p>It expires in ${minutes} minutes.</p>
<p style="color:#666;font-size:13px">If you didn't request this, you can ignore this email.</p>`,
      });
    } catch (err) {
      logger.error({ err: (err as Error).message }, "SMTP OTP send failed");
      throw new Error("Failed to send verification email");
    }
  }
}
