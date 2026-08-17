import { z } from "zod";

export const registerDeviceSchema = z.object({
  deviceId: z.string().uuid().optional(),
  platform: z.enum(["IOS", "ANDROID"]),
  pushToken: z.string().min(1).optional(),
});

export const deviceParamsSchema = z.object({
  deviceId: z.string().uuid(),
});
