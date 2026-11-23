import { open, seal } from "@/lib/secretBox";

/**
 * Encrypts the LMS access key before it is stored, so a copy of the database (a backup, a
 * leaked export) does not hand out working keys. See src/lib/secretBox.ts for how the key is chosen.
 */
const PURPOSE = "lms-token-v1";

export function encryptToken(plain: string): string {
  return seal(plain, PURPOSE);
}

export function decryptToken(stored: string): string {
  return open(stored, PURPOSE).value;
}
