import crypto from "node:crypto";

/** Opaque tokens (refresh tokens, invite codes) are already high-entropy random —
 * SHA-256 is sufficient (and fast) for at-rest hashing, unlike passwords/OTPs. */
export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateOpaqueToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("hex");
}
