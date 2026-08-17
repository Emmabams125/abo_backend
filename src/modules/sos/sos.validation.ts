import { z } from "zod";

export const triggerSosSchema = z.object({
  circleId: z.string().uuid(),
});

export const sosEventParamsSchema = z.object({
  sosEventId: z.string().uuid(),
});
