import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_REAUTH_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  JWT_REAUTH_TTL: z.string().default("5m"),

  OTP_TTL_MINUTES: z.coerce.number().default(5),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_LOCKOUT_MINUTES: z.coerce.number().default(15),
  OTP_RESEND_SECONDS: z.coerce.number().default(30),

  // TEMPORARY, pre-launch only — see otp.service.ts's bypass short-circuits.
  // Must be false/unset before any real user data exists in this environment.
  OTP_BYPASS_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  OTP_BYPASS_CODE: z.string().default("000000"),

  CIRCLE_INVITE_TTL_DAYS: z.coerce.number().default(7),
  LOCATION_RETENTION_DEFAULT_DAYS: z.coerce.number().default(7),
  LOCATION_RETENTION_MAX_DAYS: z.coerce.number().default(30),

  COMMUNITY_HAZARD_TTL_HOURS: z.coerce.number().default(24),
  COMMUNITY_ALERT_TTL_DAYS: z.coerce.number().default(7),

  SMS_PROVIDER: z.enum(["termii", "mock"]).default("mock"),
  TERMII_API_KEY: z.string().optional().default(""),
  TERMII_SENDER_ID: z.string().optional().default("Abo"),

  FCM_PROJECT_ID: z.string().optional().default(""),
  FCM_CLIENT_EMAIL: z.string().optional().default(""),
  FCM_PRIVATE_KEY: z.string().optional().default(""),

  APNS_KEY_ID: z.string().optional().default(""),
  APNS_TEAM_ID: z.string().optional().default(""),
  APNS_BUNDLE_ID: z.string().optional().default(""),
  APNS_PRIVATE_KEY_PATH: z.string().optional().default(""),
  APNS_PRODUCTION: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  FIELD_ENCRYPTION_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
