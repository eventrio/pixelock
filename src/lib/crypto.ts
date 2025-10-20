import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt);

/**
 * Generate a numeric PIN using env PIN_DIGITS (default 4).
 * Keeps leading zeros (e.g., "0047").
 */
export function genPin(): string {
  const digits = Math.max(1, Math.min(10, parseInt(process.env.PIN_DIGITS || "4", 10) || 4));
  let out = "";
  for (let i = 0; i < digits; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

/**
 * Hash a PIN with scrypt + random salt.
 * Returns "saltHex:hashHex".
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16); // 128-bit salt
  const key = (await scrypt(pin, salt, 32)) as Buffer; // 256-bit key
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

/**
 * Verify a PIN against a "saltHex:hashHex" string.
 * Uses timingSafeEqual to avoid timing leaks.
 */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  try {
    const [saltHex, keyHex] = stored.split(":");
    if (!saltHex || !keyHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(keyHex, "hex");
    const got = (await scrypt(pin, salt, expected.length)) as Buffer;
    // Ensure equal-length buffers before compare
    if (got.length !== expected.length) return false;
    return timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}
