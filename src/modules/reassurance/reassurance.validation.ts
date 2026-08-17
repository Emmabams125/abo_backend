import { z } from "zod";

export const checkInSchema = z.object({
  circleId: z.string().uuid(),
});

export const circleIdParamsSchema = z.object({
  circleId: z.string().uuid(),
});

export const createReminderSchema = z.object({
  remindAt: z.coerce.date(),
});

export const reminderParamsSchema = z.object({
  reminderId: z.string().uuid(),
});
