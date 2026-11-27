import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface EncryptedSecret {
  iv: string;
  tag: string;
  data: string;
}

/**
 * The 32-byte AES key from MFA_ENCRYPTION_KEY, as 64 hex characters or base64.
 * Throws when it is missing or the wrong size: there is no default key, so a
 * misconfigured server fails loudly instead of storing secrets under a known key.
 * Generate one with: openssl rand -base64 32
 */
function key(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (!raw) throw new Error("MFA_ENCRYPTION_KEY is not set");
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must be 32 bytes (64 hex characters or base64)");
  return buf;
}

/** AES-256-GCM: the IV is random per secret, and the auth tag makes any tampering detectable. */
export function encryptSecret(plain: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

export function decryptSecret(enc: EncryptedSecret): string {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(enc.iv, "base64"));
  decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc.data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
