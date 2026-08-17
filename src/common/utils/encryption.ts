import crypto from "node:crypto";
import { env } from "@/config/env";

/**
 * Field-level AES-256-GCM encryption for sensitive columns (medical info,
 * per NFR-SEC — "encrypted at the field level, not just database level").
 * Stored format: base64(iv).base64(authTag).base64(ciphertext)
 */

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  // FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256.
  const key = crypto.createHash("sha256").update(env.FIELD_ENCRYPTION_KEY).digest();
  return key;
}

export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptField(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted field payload");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
