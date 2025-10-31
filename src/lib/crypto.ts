export function randomToken(len = 16) {
  const b = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(b, (v) => v.toString(36).padStart(2, "0")).join("").slice(0, len);
}

export async function hashPin(pin: string) {
  const enc = new TextEncoder().encode(pin);
  const d = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
