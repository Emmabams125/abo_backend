import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "@/config/env";
import { BadRequestError, ForbiddenError, TooManyRequestsError } from "@/common/errors/app-error";
import { authRepository } from "@/modules/auth/auth.repository";
import { createSmsProvider } from "@/modules/auth/sms-provider.factory";

const smsProvider = createSmsProvider();

function generateOtpCode(): string {
  // 6-digit numeric code, uniformly distributed via rejection-free modulo of a random uint.
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

export const otpService = {
  /** FR-ONB-01: resend available after 30 seconds. */
  async requestOtp(phone: string): Promise<void> {
    // TEMPORARY: while OTP_BYPASS_ENABLED, skip the real challenge/SMS flow
    // entirely for every phone number — this must never be true once real
    // users exist (see env.ts and the plan doc for the full rationale).
    // Never bypassed in NODE_ENV=test — the integration suite (and its
    // signUpUser helper) needs the real mock-provider path to work, same
    // reasoning as the test-env skip in rate-limit.ts.
    if (env.OTP_BYPASS_ENABLED && env.NODE_ENV !== "test") return;

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

    const code = generateOtpCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000);

    await authRepository.createOtpChallenge({ phone, codeHash, expiresAt });
    await smsProvider.sendOtp(phone, code);
  },

  /** FR-ONB-01: OTP expires after 5 min; max 5 attempts before 15-min lockout. */
  async verifyOtp(phone: string, code: string): Promise<void> {
    // TEMPORARY: see requestOtp's bypass comment above — must never be true
    // once real users exist, and never applies in NODE_ENV=test. Only the
    // exact bypass code is accepted; any other code still falls through to
    // the real challenge lookup and correctly fails.
    if (env.OTP_BYPASS_ENABLED && env.NODE_ENV !== "test" && code === env.OTP_BYPASS_CODE) return;

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
  },
};
