import { z } from "zod";

const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in E.164 format, e.g. +2348012345678");

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  // Only used while OTP_CHANNEL=email; ignored for phones that already have one bound.
  email: z.string().trim().toLowerCase().email().optional(),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6),
  deviceId: z.string().uuid().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const reauthVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6),
});
