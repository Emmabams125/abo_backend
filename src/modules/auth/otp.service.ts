import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "@/config/env";
import { BadRequestError, ForbiddenError, TooManyRequestsError } from "@/common/errors/app-error";
import { authRepository } from "@/modules/auth/auth.repository";
import { createEmailProvider } from "@/modules/auth/email-provider.factory";
import { createSmsProvider } from "@/modules/auth/sms-provider.factory";

const smsProvider = createSmsProvider();
const emailProvider = createEmailProvider();

export interface OtpDelivery {
  channel: "sms" | "email";
  /** Masked destination ("ad***@gmail.com") so the client can show where the code went. */
  destination: string | null;
}

function generateOtpCode(): string {
  // 6-digit numeric code, uniformly distributed via rejection-free modulo of a random uint.
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

/**
 * OTP_CHANNEL=email: works out which inbox gets the code. A phone that already
 * has an email bound always uses that one, whatever the client sent — otherwise
 * anyone who knew a phone number could log into that account with their own
 * inbox. A phone without one (new user, or an account from before email OTP)
 * uses the requested email, which is bound to the account on verification.
 */
async function resolveOtpEmail(phone: string, requestedEmail?: string): Promise<string> {
  const user = await authRepository.findUserByPhone(phone);
  if (user?.email) return user.email;

  if (!requestedEmail) {
    throw new BadRequestError("Email is required to receive a verification code");
  }
  const owner = await authRepository.findUserByEmail(requestedEmail);
  if (owner && owner.phone !== phone) {
    throw new BadRequestError("This email is already linked to another account");
  }
  return requestedEmail;
}

/** The single store-review account (see REVIEW_LOGIN_* in env.ts). */
function isReviewLogin(phone: string): boolean {
  return Boolean(env.REVIEW_LOGIN_PHONE && env.REVIEW_LOGIN_CODE && phone === env.REVIEW_LOGIN_PHONE);
}

export const otpService = {
  /** FR-ONB-01: resend available after 30 seconds. */
  async requestOtp(phone: string, requestedEmail?: string): Promise<OtpDelivery> {
    // TEMPORARY: while OTP_BYPASS_ENABLED, skip the real challenge/SMS flow
    // entirely for every phone number — this must never be true once real
    // users exist (see env.ts and the plan doc for the full rationale).
    // Never bypassed in NODE_ENV=test — the integration suite (and its
    // signUpUser helper) needs the real mock-provider path to work, same
    // reasoning as the test-env skip in rate-limit.ts.
    if (env.OTP_BYPASS_ENABLED && env.NODE_ENV !== "test") return { channel: env.OTP_CHANNEL, destination: null };
    if (isReviewLogin(phone)) return { channel: env.OTP_CHANNEL, destination: "the review account" };

    const existing = await authRepository.findActiveOtpChallenge(phone);

    if (existing) {
      const resendAvailableAt = new Date(existing.lastSentAt.getTime() + env.OTP_RESEND_SECONDS * 1000);
      if (resendAvailableAt > new Date()) {
        throw new TooManyRequestsError(
          `Please wait before requesting another code (available at ${resendAvailableAt.toISOString()})`
        );
      }
      if (existing.lockedUntil && existing.lockedUntil > new Date()) {
        throw new ForbiddenError(`Too many attempts. Try again after ${existing.lockedUntil.toISOString()}`);
      }
    }

    const email = env.OTP_CHANNEL === "email" ? await resolveOtpEmail(phone, requestedEmail) : null;

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000);

    await authRepository.createOtpChallenge({ phone, email, codeHash, expiresAt });

    if (email) {
      await emailProvider.sendOtp(email, code);
      return { channel: "email", destination: maskEmail(email) };
    }
    await smsProvider.sendOtp(phone, code);
    return { channel: "sms", destination: null };
  },

  /**
   * FR-ONB-01: OTP expires after 5 min; max 5 attempts before 15-min lockout.
   * Returns the inbox the code was emailed to (null for SMS), for the caller
   * to bind to the account.
   */
  async verifyOtp(phone: string, code: string): Promise<{ email: string | null }> {
    // TEMPORARY: see requestOtp's bypass comment above — must never be true
    // once real users exist, and never applies in NODE_ENV=test. Only the
    // exact bypass code is accepted; any other code still falls through to
    // the real challenge lookup and correctly fails.
    if (env.OTP_BYPASS_ENABLED && env.NODE_ENV !== "test" && code === env.OTP_BYPASS_CODE) return { email: null };
    if (isReviewLogin(phone)) {
      if (code === env.REVIEW_LOGIN_CODE) return { email: null };
      throw new BadRequestError("Incorrect verification code");
    }

    const challenge = await authRepository.findActiveOtpChallenge(phone);
    if (!challenge) {
      throw new BadRequestError("No pending verification for this phone number");
    }

    if (challenge.lockedUntil && challenge.lockedUntil > new Date()) {
      throw new ForbiddenError(`Too many attempts. Try again after ${challenge.lockedUntil.toISOString()}`);
    }

    if (challenge.expiresAt < new Date()) {
      throw new BadRequestError("Verification code has expired");
    }

    const matches = await bcrypt.compare(code, challenge.codeHash);
    if (!matches) {
      const attemptsAfter = challenge.attempts + 1;
      const lockedUntil =
        attemptsAfter >= env.OTP_MAX_ATTEMPTS ? new Date(Date.now() + env.OTP_LOCKOUT_MINUTES * 60_000) : null;
      await authRepository.incrementOtpAttempts(challenge.id, lockedUntil);

      if (lockedUntil) {
        throw new ForbiddenError(`Too many attempts. Try again after ${lockedUntil.toISOString()}`);
      }
      throw new BadRequestError("Incorrect verification code");
    }

    await authRepository.consumeOtpChallenge(challenge.id);
    return { email: challenge.email };
  },
};
