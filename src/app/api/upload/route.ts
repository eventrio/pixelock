// src/app/api/upload/route.ts
import "server-only";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
// ✅ Force Node runtime so we have Node's Buffer & stable outbound fetch
export const runtime = "nodejs";

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
  const cookieKeys = Array.from(cookie.matchAll(/(?:^|;\s*)([^=;,\s]+)=/g))
    .map((m) => m[1])
    .slice(0, 50);

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
      if (body && typeof body === "object") jsonKeys = Object.keys(body).slice(0, 50);
    } catch {}
  }

  return { headers: hdr, cookies_present: cookieKeys, query_keys: queryKeys, form_keys: formKeys, json_keys: jsonKeys };
}

// --- Tolerant PIN extraction (uses a clone to avoid consuming the stream) ---
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
      const direct =
        form.get("pin") || form.get("PIN") || form.get("code") || form.get("passcode") || form.get("p");
      if (typeof direct === "string" && direct.trim()) return direct.trim();

      for (const [name, value] of form.entries()) {
        const key = name.toLowerCase();
        if (key === "pin" || key === "code" || key === "passcode" || key === "p") {
          if (typeof value === "string" && value.trim()) {
            return value.trim();
          }
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

// ---- HTTP handler ----------------------------------------------------------
export async function POST(req: Request) {
  try {
    // Read configured PIN length once (defaults to 4 if unset)
    const configured = Number(process.env.PIN_DIGITS || 4);
    const PIN_LEN =
      Number.isFinite(configured) && configured > 0
        ? Math.min(12, Math.max(3, configured))
        : 4;

    // Use let so we can generate one if the client didn't send it
    let pin = await extractPin(req);

    // If no pin provided by client, generate one server-side
    if (!pin) {
      pin = Array.from({ length: PIN_LEN }, () =>
        Math.floor(Math.random() * 10)
      ).join("");
    }

    // Enforce length (covers both client-supplied and generated pins)
    if (pin.length !== PIN_LEN) {
      return json({ error: `Invalid pin length; expected ${PIN_LEN} digits` }, 400);
    }

    // Validate envs early (helps avoid "fetch failed")
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return json({ error: "Server misconfig: NEXT_PUBLIC_SUPABASE_URL is missing" }, 500);
    }

    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("multipart/form-data")) {
      return json({ error: "Expected multipart/form-data" }, 400);
    }

    const form = await req.formData();
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

    // Init Supabase server client
    const supabase = supabaseServer();

    const bucket = "uploads"; // change if needed

    const fileName = file.name || "upload.bin";
    const dot = fileName.lastIndexOf(".");
    const ext = dot >= 0 ? fileName.slice(dot) : "";

    const now = new Date();
    const key =
      `pins/${pin}/` +
      `${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, "0")}-` +
      `${String(now.getDate()).padStart(2, "0")}/` +
      `${crypto.randomUUID()}${ext}`;

    const arrayBuf = await file.arrayBuffer();

    // ✅ Use Node Buffer when available; fallback to Uint8Array for edge (shouldn't hit since runtime=nodejs)
    const payload: any =
      typeof Buffer !== "undefined" ? Buffer.from(arrayBuf) : new Uint8Array(arrayBuf);

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(key, payload, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (upErr) {
      const message = upErr.message || "unknown";
      return json({ error: `Upload failed: ${message}` }, 500);
    }

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
