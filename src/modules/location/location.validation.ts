import { z } from "zod";

export const pingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  batteryPct: z.number().int().min(0).max(100).optional(),
});

export const circleIdParamsSchema = z.object({
  circleId: z.string().uuid(),
});

export const memberLocationParamsSchema = z.object({
  circleId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const createSafePlaceSchema = z.object({
  name: z.string().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(50).max(500),
});

export const safePlaceParamsSchema = z.object({
  circleId: z.string().uuid(),
  safePlaceId: z.string().uuid(),
});

export const retentionSchema = z.object({
  retentionDays: z.number().int().min(1).max(30),
});
