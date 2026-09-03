import { z } from "zod";

export const alertKindSchema = z.enum(["MISSING", "LOST_ITEM", "HAZARD"]);

export const mediaTypeSchema = z.enum(["PHOTO", "VIDEO"]);

export const createAlertSchema = z
  .object({
    kind: alertKindSchema,
    title: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    placeLabel: z.string().min(1).max(80),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    mediaUrl: z.string().url().optional(),
    mediaType: mediaTypeSchema.optional(),
  })
  .refine((v) => Boolean(v.mediaUrl) === Boolean(v.mediaType), {
    message: "mediaUrl and mediaType must be provided together",
    path: ["mediaType"],
  });

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().int().min(500).max(20_000).default(5000),
  kind: alertKindSchema.optional(),
});

export const alertIdParamsSchema = z.object({
  alertId: z.string().uuid(),
});
