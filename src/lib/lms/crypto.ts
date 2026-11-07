import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "crypto";

/**
 * Encrypts the LMS access key before it is stored, so a copy of the database (a backup, a
 * leaked export) does not hand out working keys. AES-256-GCM with a random nonce per value.
 *
 * The encryption key is derived on the server from LMS_TOKEN_SECRET when set, otherwise from
 * the database connection string, which never lives in the database itself.
 */
function key(): Buffer {
  const secret = process.env.LMS_TOKEN_SECRET || process.env.DATABASE_URL || "";
  if (!secret) throw new Error("No server secret available to protect the LMS key");
  const ikm = createHash("sha256").update(secret).digest();
  return Buffer.from(hkdfSync("sha256", ikm, Buffer.from("faida-os"), Buffer.from("lms-token-v1"), 32));
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptToken(stored: string): string {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unreadable stored LMS key");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
