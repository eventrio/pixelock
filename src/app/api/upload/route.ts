// src/app/api/upload/route.ts
import "server-only";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// --- Safe diagnostics (uses req.clone() so we don't consume the stream) -----
async function debugDump(req: Request) {
  const clone = req.clone();
  const url = new URL(clone.url);
  const contentType = (clone.headers.get("content-type") || "").toLowerCase();

  const hdr = {
    has_authorization: !!(clone.headers.get("authorization") || clone.headers.get("Authorization")),
    has_x_pin: !!(clone.headers.get("x-pin") || clone.headers.get("X-Pin")),
    has_cookie: !!clone.headers.get("cookie"),
    content_type: contentType,
    origin: clone.headers.get("origin") || null,
    referer: clone.headers.get("referer") || null,
  };

  const cookie = clone.headers.get("cookie") || "";
  const cookieKeys = Array.from(cookie.matchAll(/(?:^|;\s*)([^=;,\s]+)=/g)).map((m) => m[1]).slice(0, 50);

  const queryKeys = Array.from(url.searchParams.keys()).slice(0, 50);

  let formKeys: string[] = [];
  let jsonKeys: string[] = [];
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await clone.formData();
      for (const [k] of form.entries()) {
        if (!formKeys.includes(k)) formKeys.push(k);
      }
    } catch {}
  } else if (contentType.includes("application/json")) {
    try {
      const body: any = await clone.json();
      if (body && typeof body === "object") {
        jsonKeys = Object.keys(body).slice(0, 50);
      }
    } catch {}
  }

  return { headers: hdr, cookies_present: cookieKeys, query_keys: queryKeys, form_keys: formKeys, json_keys: jsonKeys };
}

// --- Tolerant PIN extraction (now also uses a clone) ------------------------
async function extractPin(req: Request): Promise<string | undefined> {
  const r = req.clone();

  // 0) URL query
  try {
    const u = new URL(r.url);
    for (const k of u.searchParams.keys()) {
      const key = k.toLowerCase();
      if (key === "pin" || key === "code" || key === "passcode" || key === "p") {
        const v = u.searchParams.get(k)?.trim();
        if (v) return v;
      }
    }
  } catch {}

  // 1) Headers
  const auth = r.headers.get("authorization") || r.headers.get("Authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const v = auth.slice(7).trim();
    if (v) return v;
  }
  const xpin = r.headers.get("x-pin") || r.headers.get("X-Pin");
  if (xpin?.trim()) return xpin.trim();

  // 2) Cookies
  const cookie = r.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)(pin|PIN|code|passcode|p)=([^;]+)/);
  if (m?.[2]) return decodeURIComponent(m[2].trim());

  // 3) Body
  const ctype = (r.headers.get("content-type") || "").toLowerCase();
  if (ctype.includes("multipart/form-data")) {
    try {
      const form = await r.formData();
      const direct = form.get("pin") || form.get("PIN") || form.get("code") || form.get("passcode") || form.get("p");
      if (typeof direct === "string" && direct.trim()) return direct.trim();
      for (const [name, value] of form.entries()) {
        const key = name.toLowerCase();
        if ((key === "pin" || key === "code" || key === "passcode" || key === "p") && typeof value === "string" && value.trim()) {
          return value.trim(
