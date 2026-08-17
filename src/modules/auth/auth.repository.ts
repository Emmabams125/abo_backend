import { prisma } from "@/db/prisma.client";

export const authRepository = {
  findUserByPhone(phone: string) {
    return prisma.user.findUnique({ where: { phone } });
  },

  createUser(phone: string) {
    return prisma.user.create({ data: { phone } });
  },

  findOrCreateUserByPhone(phone: string) {
    return prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });
  },

  // ── OTP ──────────────────────────────────────────────────────

  findActiveOtpChallenge(phone: string) {
    return prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  createOtpChallenge(data: { phone: string; codeHash: string; expiresAt: Date }) {
    return prisma.otpChallenge.create({
      data: {
        phone: data.phone,
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
        lastSentAt: new Date(),
      },
    });
  },

  incrementOtpAttempts(id: string, lockedUntil: Date | null) {
    return prisma.otpChallenge.update({
      where: { id },
      data: { attempts: { increment: 1 }, lockedUntil: lockedUntil ?? undefined },
    });
  },

  consumeOtpChallenge(id: string) {
    return prisma.otpChallenge.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  },

  // ── Refresh tokens ───────────────────────────────────────────

  createRefreshToken(data: { userId: string; deviceId?: string; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data });
  },

  findRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  revokeRefreshToken(id: string) {
    return prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  },
};
