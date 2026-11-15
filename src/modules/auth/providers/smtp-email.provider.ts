import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { env } from "@/config/env";
import { logger } from "@/common/utils/logger";
import type { EmailProvider } from "@/modules/auth/email-provider.interface";

const BRAND_GREEN = "#1E9952";
const LOGO_CID = "abo-logo@aaboo.tech";

/** The logo travels inside the email (CID attachment), so it shows without "load images". */
function loadLogo(): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), "assets", "email", "abo-logo.png"));
  } catch {
    return null;
  }
}

function otpHtml(code: string, minutes: number, withLogo: boolean): string {
  const logo = withLogo
    ? `<img src="cid:${LOGO_CID}" width="64" height="64" alt="Abo" style="display:block;margin:0 auto 8px;border:0">`
    : `<div style="font-size:28px;font-weight:700;color:${BRAND_GREEN};text-align:center">abo</div>`;
  const support = env.SUPPORT_EMAIL
    ? `Questions? Reply to this email or write to <a href="mailto:${env.SUPPORT_EMAIL}" style="color:${BRAND_GREEN}">${env.SUPPORT_EMAIL}</a>.`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Abo code</title></head>
<body style="margin:0;padding:0;background:#F4F6F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1A1A1A">
  <span style="display:none;max-height:0;overflow:hidden">Your Abo code is ${code}. It expires in ${minutes} minutes.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F5;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#FFFFFF;border-radius:16px;padding:32px 28px">
        <tr><td align="center">${logo}</td></tr>
        <tr><td align="center" style="font-size:20px;font-weight:600;padding:8px 0 4px">Your sign-in code</td></tr>
        <tr><td align="center" style="font-size:14px;color:#555;padding-bottom:20px">Enter this code in the Abo app to continue.</td></tr>
        <tr><td align="center">
          <div style="display:inline-block;background:#EAF6EF;border:1px solid #BFE3CD;border-radius:12px;padding:14px 22px;font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND_GREEN}">${code}</div>
        </td></tr>
        <tr><td align="center" style="font-size:13px;color:#555;padding-top:20px">This code expires in ${minutes} minutes. Never share it with anyone; Abo will never ask you for it.</td></tr>
        <tr><td style="border-top:1px solid #EEE;padding-top:18px;margin-top:20px;font-size:12px;color:#888;text-align:center">
          If you didn't try to sign in to Abo, you can safely ignore this email.<br>${support}
        </td></tr>
      </table>
      <div style="font-size:11px;color:#999;padding-top:14px">Abo · Keeping your Circle safe</div>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Sends OTP emails over SMTP. Works with any SMTP service; for inbox (not
 * spam) delivery use one that sends from your own domain with SPF/DKIM/DMARC
 * set up (e.g. Brevo or Resend with EMAIL_FROM=Abo <no-reply@yourdomain>).
 */
export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  private readonly logo = loadLogo();

  async sendOtp(email: string, code: string): Promise<void> {
    const minutes = env.OTP_TTL_MINUTES;
    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM || `Abo <${env.SMTP_USER}>`,
        to: email,
        ...(env.SUPPORT_EMAIL ? { replyTo: env.SUPPORT_EMAIL } : {}),
        subject: `${code} is your Abo code`,
        text:
          `Your Abo sign-in code is ${code}\n\n` +
          `Enter it in the Abo app to continue. It expires in ${minutes} minutes.\n` +
          `Never share this code with anyone.\n\n` +
          `If you didn't try to sign in to Abo, you can ignore this email.`,
        html: otpHtml(code, minutes, this.logo !== null),
        attachments: this.logo
          ? [{ filename: "abo-logo.png", content: this.logo, cid: LOGO_CID, contentDisposition: "inline" }]
          : [],
        // Each code is its own message: stops Gmail from threading/collapsing them.
        headers: { "X-Entity-Ref-ID": `${Date.now()}-${code}` },
      });
    } catch (err) {
      logger.error({ err: (err as Error).message }, "SMTP OTP send failed");
      throw new Error("Failed to send verification email");
    }
  }
}
