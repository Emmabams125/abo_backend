import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";

let client: SupabaseClient | undefined;

/** Lazy singleton — mirrors fcm.provider.ts's getApp() pattern. */
function getClient(): SupabaseClient {
  if (client) return client;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase Storage credentials are not configured");
  }
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return client;
}

export const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — plenty for a client to finish an upload/view.

/**
 * Mints a short-lived signed URL a client can PUT file bytes to directly —
 * the backend only ever handles this URL string, never the file itself
 * (Vercel's request-size/execution-time limits rule out proxying uploads).
 */
export async function createUploadUrl(bucket: string, path: string) {
  const { data, error } = await getClient().storage.from(bucket).createSignedUploadUrl(path);
  if (error) throw error;
  return { uploadUrl: data.signedUrl, path: data.path };
}

/** For the private `sos-videos` bucket — community-media is public and uses getPublicUrl instead. */
export async function createReadUrl(bucket: string, path: string) {
  const { data, error } = await getClient()
    .storage.from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

export function getPublicUrl(bucket: string, path: string): string {
  return getClient().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
