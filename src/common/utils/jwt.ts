import jwt from "jsonwebtoken";
import { env } from "@/config/env";

export interface AccessTokenPayload {
  userId: string;
  deviceId?: string;
}

export interface ReauthTokenPayload {
  userId: string;
  purpose: "reauth";
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function signReauthToken(userId: string): string {
  const payload: ReauthTokenPayload = { userId, purpose: "reauth" };
  return jwt.sign(payload, env.JWT_REAUTH_SECRET, { expiresIn: env.JWT_REAUTH_TTL } as jwt.SignOptions);
}

export function verifyReauthToken(token: string): ReauthTokenPayload {
  const payload = jwt.verify(token, env.JWT_REAUTH_SECRET) as ReauthTokenPayload;
  if (payload.purpose !== "reauth") {
    throw new Error("Invalid reauth token");
  }
  return payload;
}

/** Refresh tokens are random opaque strings (hashed at rest), not JWTs — see auth.repository.ts. */
export function refreshTokenTtlMs(): number {
  return parseDurationToMs(env.JWT_REFRESH_TTL);
}

function parseDurationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit as "s" | "m" | "h" | "d"];
  return value * unitMs;
}
