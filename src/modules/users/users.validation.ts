import { z } from "zod";

export const emergencyContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  relationship: z.string().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().optional(),
  emergencyContacts: z.array(emergencyContactSchema).optional(),
  medicalInfo: z.string().max(2000).nullable().optional(),
});
