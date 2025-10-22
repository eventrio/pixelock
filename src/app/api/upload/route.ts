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

// Safe, minimal diagnostics when PIN is missing and DEBUG_UPLOAD=1
async function debugDump(req: Request) {
  const url = new URL(req.url);
  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  // headers: only presence, not values (except small booleans)
  const hdr = {
    has_authorization: !!(req.headers.get("authorization") || req.headers.get("Authorization")),
    has_x_pin: !!(req.headers.get("x-pin") || req.headers.get("X-Pin")),
    has_cookie: !!req.headers.get("cookie"),
    content_type: contentType,
    origin: req.headers.get("origin") || null,
    referer: req.headers.get("referer") || null,
  };

  // cookies: list keys only
  const cookie = req.headers.get("cookie") || "";
  const cookieKeys = Array.from(cookie.matchAll(/(?:^|;\s*)([^=;,\s]+)=/g)).map((m) => m[1]).slice(0, 50);

  // query: keys only
  const queryKeys = Array.from(url.searchParams.keys()).slice(0, 50);

  // body: list field names only, never values
  let formKeys: string[] = [];
  let jsonKeys: string[] = [];
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      for (const [k] of form.entries()) {
        if (!formKeys.includes(k)) formKeys.push(k);
      }
    } catch {}
  } else if (contentType.includes("application/json")) {
    try {
      const body: any = await req.json();
      if (body && typeof body === "object") {
        jsonKeys = Object.keys(body).slice(0, 50);
      }
    } catch {}
  }

  return {
    headers: hdr,
    cookies_present: cookieKeys,
    query_keys: queryKeys,
    form_keys: formKeys,
    json_keys: jsonKeys,
  };
}

// Tolerant PIN extraction across headers/cookies/query/form/json
async function extractPin(req: Request): Promise<string | undefined> {
  // 0) URL query
  try {
    const u = new URL(req.url);
    for (const k of u.searchParams.keys()) {
      const key = k.toLowerCase();
      if (key === "pin" || key === "code" || key === "passcode" || key === "p") {
        const v = u.searchParams.get(k)?.trim();
        if (v) return v;
      }
    }
  } catch {}

  // 1) Headers
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const v = auth.slice(7).trim();
    if (v) return v;
  }
  const xpin = req.headers.get("x-pin") || req.headers.get("X-Pin");
  if (xpin?.trim()) return xpin.trim();

  // 2) Cookies
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)(pin|PIN|code|passcode|p)=([^;]+)/);
  if (m?.[2]) return decodeURIComponent(m[2].trim());

  // 3) Body
  const ctype = (req.headers.get("content-type") || "").toLowerCase();

  if (ctype.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const direct = form.get("pin") || form.get("PIN") || form.get("code") || form.get("passcode") || form.get("p");
      if (typeof direct === "string" && direct.trim()) return direct.trim();
      for (const [name, value] of form.entries()) {
        const key = name.toLowerCase();
        if ((key === "pin" || key === "code" || key === "passcode" || key === "p") && typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
    } catch {}
  } else if (ctype.includes("application/json")) {
    try {
      const body: any = await req.json();
      const candidates = ["pin", "PIN", "code", "passcode", "p"];
      for (const k of candidates) {
        const v = body?.[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      if (body && typeof body === "object") {
        for (const [k, v] of Object.entries(body)) {
          const key = k.toLowerCase();
          if ((key === "pin" || key === "code" || key === "passcode" || key === "p") && typeof v === "string" && v.trim()) {
            return v.trim();
          }
        }
      }
    } catch {}
  }

  return undefined;
}

// ---- HTTP handler ----------------------------------------------------------
export async function POST(req: Request) {
  try {
    const pin = await extractPin(req);

    if (!pin) {
      // If debug enabled, return safe diagnostics so we can see exactly what's arriving
      if ((process.env.DEBUG_UPLOAD || "").toString() === "1") {
        const dbg = await debugDump(req);
        return json({ error: "Missing pin", debug: dbg }, 400);
      }
      return json({ error: "Missing pin" }, 400);
    }

    // Optional length enforcement via env
    const PIN_DIGITS = Number(process.env.PIN_DIGITS || 0);
    if (PIN_DIGITS > 0 && pin.length !== PIN_DIGITS) {
      return json({ error: `Invalid pin length; expected ${PIN_DIGITS} digits` }, 400);
    }

    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("multipart/form-data")) {
      return json({ error: "Expected multipart/form-data" }, 400);
    }

    const form = await req.formData();
    // Your UI might name the file field differently; accept common names
    const fileCandidate = form.get("file") ?? form.get("image") ?? form.get("photo") ?? form.get("upload");
    if (!(fileCandidate instanceof File)) {
      return json({ error: "Missing file" }, 400);
    }
    const file = fileCandidate as File;

    // Optional JSON metadata (string in "meta" field)
    const metaRaw = form.get("meta");
    let meta: Record<string, unknown> | undefined;
    if (typeof metaRaw === "string") {
      try { meta = JSON.parse(metaRaw); } catch {}
    }

    const supabase = supabaseServer();
    const bucket = "uploads"; // change if your bucket name differs

    const fileExt = (() => {
      const name = file.name || "upload.bin";
      const dot = name.lastIndexOf(".");
      return dot >= 0 ? name.slice(dot) : "";
    })();

    const now = new Date();
    const key =
      `pins/${pin}/` +
      `${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, "0")}-` +
      `${String(now.getDate()).padStart(2, "0")}/` +
      `${crypto.randomUUID()}${fileExt}`;

    const arrayBuf = await file.arrayBuffer();

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(key, new Uint8Array(arrayBuf), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (upErr) return json({ error: `Upload failed: ${upErr.message}` }, 500);

    return json({
      ok: true,
      pin,
      bucket,
      path: key,
      contentType: file.type || "application/octet-stream",
      meta: meta ?? null,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Server error" }, 500);
  }
}
