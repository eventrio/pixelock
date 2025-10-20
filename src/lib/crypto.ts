import bcrypt from "bcryptjs";
export function genPin(digits = Number(process.env.PIN_DIGITS || 4)) {
  const mod = 10 ** digits;
  return String(Math.floor(Math.random() * mod)).padStart(digits, "0");
}
export async function hashPin(pin: string) { return bcrypt.hash(pin, 10); }
export async function checkPin(pin: string, hash: string) { return bcrypt.compare(pin, hash); }
