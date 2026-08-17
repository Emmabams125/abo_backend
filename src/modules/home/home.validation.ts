import { z } from "zod";

export const circleIdParamsSchema = z.object({
  circleId: z.string().uuid(),
});
