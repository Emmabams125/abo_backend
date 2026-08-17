import { z } from "zod";

export const createCircleSchema = z.object({
  name: z.string().min(1).max(80),
});

export const acceptInviteSchema = z.object({
  code: z.string().min(1),
});

export const circleIdParamsSchema = z.object({
  circleId: z.string().uuid(),
});

export const membershipParamsSchema = z.object({
  circleId: z.string().uuid(),
  membershipId: z.string().uuid(),
});

export const changeRoleSchema = z.object({
  role: z.enum(["ADMIN", "ADULT", "MANAGED"]),
});
