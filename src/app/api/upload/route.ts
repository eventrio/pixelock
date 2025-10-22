// src/app/api/upload/route.ts
import "server-only";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // ensure Node runtime on Netlify

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Safe diagnostics without consuming body
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
  const cookieKeys = Array.from(cookie.matchAll(/(?:^|;\s*)([^=;,\s]+)=/g))
    .map((m) => m[1])
    .slice(0, 50);

  const queryKeys = Array.from(url.searchParams.keys()).slice(0, 50);

  let formKeys: string[] = [];
  let jsonKeys: string[] = [];
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await clone.formData();
      for (const [k] of form.entries()) if (!formKeys.includes(k)) formKeys.push(k);
    } catch {}
  } else if (contentType.includes("application/json")) {
    try {
      const body: any = await clone.json();
      if (body && typeof body === "object") jsonKeys = Object.keys(body).slice(0, 50);
    } catch {}
  }

  return { headers: hdr, cookies_present: cookieKeys, query_keys: queryKeys, form_keys: formKeys, json_keys: jsonKeys };
}

// tolerant PIN extractor
async function extractPin(req: Request): Promise<string | undefined> {
  const r = req.clone();

  // query
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

  // headers
  const auth = r.headers.get("authorization") || r.headers.get("Authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const v = auth.slice(7).trim();
    if (v) return v;
  }
  const xpin = r.headers.get("x-pin") || r.headers.get("X-Pin");
  if (xpin?.trim()) return xpin.trim();

  // cookie
  const cookie = r.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)(pin|PIN|code|passcode|p)=([^;]+)/);
  if (m?.[2]) return decodeURIComponent(m[2].trim());

  // body
  const ctype = (r.headers.get("content-type") || "").toLowerCase();
  if (ctype.includes("multipart/form-data")) {
    try {
      const form = await r.formData();
      const direct =
        form.get("pin") || form.get("PIN") || form.get("code") || form.get("passcode") || form.get("p");
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
      const body: any = await r.json();
      const candidates = ["pin", "PIN", "code", "passcode", "p"];
      for (const k of candidates) {
        const v = body?.[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      if (body && typeof body === "object") {
        for (const [k, v] of Object.entries(body)) {
          const key = k.toLowerCase();
          if ((key === "pin" || key === "code" || key === "passcode" || key === "p") && typeof v === "string" && v.trim()) {
            return (v as string).trim();
          }
        }
      }
    } catch {}
  }

  return undefined;
}

// connectivity preflight to Supabase Storage
async function preflightStorage(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!base) return { ok: false, reason: "Missing NEXT_PUBLIC_SUPABASE_URL" };
  if (!key) return { ok: false, reason: "Missing SUPABASE_SERVICE_ROLE_KEY" };

  const url = `${base}/storage/v1/bucket`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
    }).catch((e) => {
      throw new Error(`Network error to ${new URL(base).host}: ${e?.message || e}`);
    });
    clearTimeout(t);

    if (!res.ok) {
      return { ok: false, reason: `Supabase HTTP ${res.status} at ${new URL(base).host}/storage/v1/bucket` };
    }
    return { ok: true };
  } catch (e: any) {
    clearTimeout(t);
    return { ok: false, reason: e?.message || "Unknown network error" };
  }
}

export async function POST(req: Request) {
  try {
    // PIN rules
    const configured = Number(process.env.PIN_DIGITS || 4);
    const PIN_LEN =
      Number.isFinite(configured) && configured > 0
        ? Math.min(12, Math.max(3, configured))
        : 4;

    let pin = await extractPin(req);
    if (!pin) {
      pin = Array.from({ length: PIN_LEN }, () => Math.floor(Math.random() * 10)).join("");
    }
    if (pin.length !== PIN_LEN) {
      return json({ error: `Invalid pin length; expected ${PIN_LEN} digits` }, 400);
    }

    // Content-type
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("multipart/form-data")) {
      return json({ error: "Expected multipart/form-data" }, 400);
    }

    // Preflight Supabase connectivity (clearer error than "fetch failed")
    const pre = await preflightStorage();
    if (!pre.ok) {
      return json({
        error: `Supabase connectivity check failed: ${pre.reason}`,
        hint: "If you're on Netlify, set NODE_OPTIONS=--dns-result-order=ipv4first and ensure NEXT_PUBLIC_SUPABASE_URL is the full https://...supabase.co URL.",
      }, 500);
    }

    // Parse form
    const form = await req.formData();
    const fileCandidate = form.get("file") ?? form.get("image") ?? form.get("photo") ?? form.get("upload");
    if (!(fileCandidate instanceof File)) {
      return json({ error: "Missing file" }, 400);
    }
    const file = fileCandidate as File;

    // Optional metadata
    const metaRaw = form.get("meta");
    let meta: Record<string, unknown> | undefined;
    if (typeof metaRaw === "string") {
      try { meta = JSON.parse(metaRaw); } catch {}
    }

    // Supabase client (service role)
    const supabase = supabaseServer();

    const bucket = "uploads"; // adjust if your bucket differs
    const name = file.name || "upload.bin";
    const dot = name.lastIndexOf(".");
    const ext = dot >= 0 ? name.slice(dot) : "";

    const now = new Date();
    const key =
      `pins/${pin}/` +
      `${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, "0")}-` +
      `${String(now.getDate()).padStart(2, "0")}/` +
      `${crypto.randomUUID()}${ext}`;

    const arrayBuf = await file.arrayBuffer();
    const payload: any = typeof Buffer !== "undefined" ? Buffer.from(arrayBuf) : new Uint8Array(arrayBuf);

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(key, payload, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (upErr) {
      return json({ error: `Upload failed: ${upErr.message}` }, 500);
    }

    return json({
      ok: true,
      token: key, // if you later map token differently, adjust here
      pin,
      shareText: `An image has been shared with you!\nFollow the link: /img/${key}\nPin: ${pin}`,
      bucket,
      path: key,
      contentType: file.type || "application/octet-stream",
      meta: meta ?? null,
    });
  } catch (e: any) {
    // Enhanced error in debug
    if ((process.env.DEBUG_UPLOAD || "").toString() === "1") {
      try {
        const dbg = await debugDump(req);
        return json({ error: e?.message ?? "Server error", debug: dbg }, 500);
      } catch {}
    }
    return json({ error: e?.message ?? "Server error" }, 500);
  }
}
