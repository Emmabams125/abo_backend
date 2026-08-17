import { z } from "zod";

export const circleIdParamsSchema = z.object({
  circleId: z.string().uuid(),
});

export const changeTierSchema = z.object({
  tier: z.enum(["FREE", "PREMIUM", "ENTERPRISE"]),
  billingProvider: z.enum(["APPLE_IAP", "GOOGLE_IAP", "PAYSTACK", "FLUTTERWAVE"]),
});
