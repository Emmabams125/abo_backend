import { UnauthorizedError } from "@/common/errors/app-error";
import { generateOpaqueToken, sha256 } from "@/common/utils/hash-token";
import { refreshTokenTtlMs, signAccessToken, signReauthToken } from "@/common/utils/jwt";
import { authRepository } from "@/modules/auth/auth.repository";
import { otpService, type OtpDelivery } from "@/modules/auth/otp.service";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function issueTokenPair(userId: string, deviceId?: string): Promise<TokenPair> {
  const accessToken = signAccessToken({ userId, deviceId });
  const refreshToken = generateOpaqueToken();
  await authRepository.createRefreshToken({
    userId,
    deviceId,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
  });
  return { accessToken, refreshToken };
}

export const authService = {
  /** FR-ONB-01 step 1: request a one-time code by SMS, or by email while OTP_CHANNEL=email. */
  requestOtp(phone: string, email?: string): Promise<OtpDelivery> {
    return otpService.requestOtp(phone, email);
  },

  /**
   * FR-ONB-01 step 2: verify the code. Creates the user on first verification
   * (phone-first identity, no separate signup step) and issues session tokens.
   */
  async verifyOtpAndAuthenticate(
    phone: string,
    code: string,
    deviceId?: string
  ): Promise<TokenPair & { userId: string; isNewUser: boolean }> {
    const { email } = await otpService.verifyOtp(phone, code);

    const existing = await authRepository.findUserByPhone(phone);
    let user = existing ?? (await authRepository.createUser(phone, email));
    // Accounts from before email OTP get their inbox bound on first email login.
    if (existing && !existing.email && email) {
      user = await authRepository.setUserEmail(existing.id, email);
    }
    const tokens = await issueTokenPair(user.id, deviceId);

    return { ...tokens, userId: user.id, isNewUser: !existing };
  },

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = sha256(refreshToken);
    const stored = await authRepository.findRefreshTokenByHash(tokenHash);

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedError("Refresh token is invalid or expired");
    }

    await authRepository.revokeRefreshToken(stored.id);
    return issueTokenPair(stored.userId, stored.deviceId ?? undefined);
  },

  async logout(refreshToken: string): Promise<void> {
    const stored = await authRepository.findRefreshTokenByHash(sha256(refreshToken));
    if (stored && !stored.revokedAt) {
      await authRepository.revokeRefreshToken(stored.id);
    }
  },

  /** Re-auth step 1: reuses the OTP flow against the already-authenticated user's own phone. */
  async requestReauthOtp(phone: string, email?: string): Promise<OtpDelivery> {
    return otpService.requestOtp(phone, email);
  },

  /** Re-auth step 2: verifying the OTP proves live possession of the phone; issues a short reauth token. */
  async verifyReauth(phone: string, code: string, expectedUserId: string): Promise<string> {
    await otpService.verifyOtp(phone, code);
    const user = await authRepository.findUserByPhone(phone);
    if (!user || user.id !== expectedUserId) {
      throw new UnauthorizedError("Phone number does not match the authenticated account");
    }
    return signReauthToken(user.id);
  },
};
