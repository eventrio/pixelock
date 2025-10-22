// Read PIN from multiple sources so client differences don't break uploads
async function extractPin(req: Request): Promise<string | undefined> {
  // 1) Authorization: Bearer <pin>
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const p = auth.slice(7).trim();
    if (p) return p;
  }

  // 1b) X-Pin: <pin> (fallback in case proxies/tools strip Authorization)
  const xpin = req.headers.get("x-pin") || req.headers.get("X-Pin");
  if (xpin && xpin.trim()) return xpin.trim();

  // 2) Cookie: pin=<pin>
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)pin=([^;]+)/i);
  if (m?.[1]) return decodeURIComponent(m[1]);

  const ctype = req.headers.get("content-type") || "";

  // 3) multipart/form-data — common for file uploads
  if (ctype.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const pin = form.get("pin");
      if (typeof pin === "string" && pin.trim()) return pin.trim();
      // if you want to allow ?pin=... in the URL as a last resort, you could parse here
    } catch { /* ignore and continue */ }
  }

  // 4) application/json
  if (ctype.includes("application/json")) {
    try {
      const body = await req.json();
      const pin = body?.pin;
      if (typeof pin === "string" && pin.trim()) return pin.trim();
    } catch { /* ignore */ }
  }

  return undefined;
}
