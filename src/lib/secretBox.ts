import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "crypto";

/**
 * AES-256-GCM for values that must never sit in the database as plain text (LMS access keys,
 * Developer Hub secrets). Each value gets a random nonce; the stored form is "v1.iv.tag.data".
 *
 * The key comes from a server secret, never from the database itself. In order of preference:
 *   APP_SECRET        a dedicated secret (recommended: set it once and never change it)
 *   LMS_TOKEN_SECRET  the older LMS-only secret
 *   DATABASE_URL      last resort; rotating the database password would make values unreadable
 *
 * New values are sealed with the first secret that is set. Opening tries every secret, so adding
 * APP_SECRET later does not lock out values sealed before it existed.
 */
function candidateSecrets(): string[] {
  const all = [process.env.APP_SECRET, process.env.LMS_TOKEN_SECRET, process.env.DATABASE_URL];
  return [...new Set(all.filter((s): s is string => Boolean(s)))];
}

function deriveKey(secret: string, purpose: string): Buffer {
  const ikm = createHash("sha256").update(secret).digest();
  return Buffer.from(hkdfSync("sha256", ikm, Buffer.from("faida-os"), Buffer.from(purpose), 32));
}

export function isSealed(stored: string): boolean {
  const parts = stored.split(".");
  return parts.length === 4 && parts[0] === "v1";
}

export function seal(plain: string, purpose: string): string {
  const secret = candidateSecrets()[0];
  if (!secret) throw new Error("No server secret is set (APP_SECRET), so the value cannot be protected");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, purpose), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

/** Returns the plain value and whether it was sealed with the preferred (first) secret. */
export function open(stored: string, purpose: string): { value: string; current: boolean } {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unreadable stored secret");
  const secrets = candidateSecrets();
  for (let i = 0; i < secrets.length; i++) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", deriveKey(secrets[i], purpose), Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      const value = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
      return { value, current: i === 0 };
    } catch {
      // wrong key: try the next one
    }
  }
  throw new Error("Stored secret cannot be opened with any configured server secret");
}
