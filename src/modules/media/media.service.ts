import { randomUUID } from "node:crypto";
import { createUploadUrl, getPublicUrl } from "@/storage/supabase-storage";
import { CONTENT_TYPE_EXT } from "@/modules/media/media.validation";

const BUCKETS = {
  community: "community-media",
  "sos-video": "sos-videos",
  // Same public bucket as community posts — avatars have no confidentiality
  // need, and it avoids provisioning a third Storage bucket for one field.
  avatar: "community-media",
} as const;

const PUBLIC_PURPOSES = new Set<MediaUploadPurpose>(["community", "avatar"]);

export type MediaUploadPurpose = keyof typeof BUCKETS;

export const mediaService = {
  /**
   * Mints a signed upload URL the client PUTs file bytes to directly — the
   * backend never touches the bytes themselves (see storage/supabase-storage.ts).
   * `publicUrl` is only returned for the public buckets (community, avatar);
   * the private `sos-video` bucket is only ever read back via a signed URL
   * generated at view-time (see sos.controller.ts's log endpoint).
   */
  async requestUploadUrl(userId: string, purpose: MediaUploadPurpose, contentType: string) {
    const bucket = BUCKETS[purpose];
    const ext = CONTENT_TYPE_EXT[contentType];
    const path = `${userId}/${randomUUID()}.${ext}`;

    const { uploadUrl, path: finalPath } = await createUploadUrl(bucket, path);

    return {
      uploadUrl,
      path: finalPath,
      publicUrl: PUBLIC_PURPOSES.has(purpose) ? getPublicUrl(bucket, finalPath) : undefined,
    };
  },
};
