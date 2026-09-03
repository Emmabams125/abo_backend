import { z } from "zod";

/** Extension used for the generated storage path — also doubles as the allowlist. */
export const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export const uploadUrlSchema = z.object({
  purpose: z.enum(["community", "sos-video"]),
  contentType: z.enum(Object.keys(CONTENT_TYPE_EXT) as [string, ...string[]]),
});
