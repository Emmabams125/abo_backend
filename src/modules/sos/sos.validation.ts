import { z } from "zod";

export const triggerSosSchema = z.object({
  circleId: z.string().uuid(),
});

export const sosEventParamsSchema = z.object({
  sosEventId: z.string().uuid(),
});

// A bucket-relative path in the private "sos-videos" Supabase Storage bucket
// (from POST /media/upload-url's `path`), not a public URL — resolved to a
// short-lived signed URL only at GET /:sosEventId/log time.
export const attachVideoSchema = z.object({
  videoPath: z.string().min(1),
});
