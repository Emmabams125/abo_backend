import { z } from "zod";

/** Extension used for the generated storage path — also doubles as the allowlist. */
export const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  // iOS's default camera photo format since iOS 11 — without this, any photo
  // taken (not picked from an older gallery item) on iPhone gets rejected
  // here before the upload even starts.
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  // Some Android devices' camera app produces this for short/low-res clips.
  "video/3gpp": "3gp",
};

export const uploadUrlSchema = z.object({
  purpose: z.enum(["community", "sos-video", "avatar"]),
  contentType: z.enum(Object.keys(CONTENT_TYPE_EXT) as [string, ...string[]]),
});
