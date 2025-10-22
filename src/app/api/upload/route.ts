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

// --- PIN extraction that tolerates real-world UIs ---------------------------
async function extractPin(req: Request): Promise<string | undefined> {
  // 0) URL query (?pin=..., ?PIN=..., ?code=..., ?passcode=...)
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

  // 1) Authorization: Bearer <pin>
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const v = auth.slice(7).trim();
    if (v) return v;
  }

  // 1b) X-Pin header
  const xpin = req.headers.get("x-pin") || req.headers.get("X-Pin");
  if (xpin?.trim()) return xpin.trim();

  // 2) Cookie: pin=<pin>
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)(pin|PIN|code|passcode)=([^;]+)/);
  if (m?.[2]) return decodeURIComponent(m[2].trim());

  // 3) Body
  const ctype = (req.headers.get("content-type") || "").toLowerCase();

  // 3a) multipart/form-data — scan ALL fields for any pin-like key
  if (ctype.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      // Common names first
      const direct = form.get("pin") || form.get("PIN") || form.get("code") || form.get("passcode") || form.get("p");
      if (typeof direct === "string" && direct.trim()) return direct.trim();

      // Fallback: scan every entry case-insensitively
      for (const [name, value] of form.entries()) {
        const key = name.toLowerCase();
        if (key === "pin" || key === "code" || key === "passcode" || key === "p") {
          if (typeof value === "string" && value.trim()) return value.trim();
        }
      }
    } catch {}
  }

  // 3b) application/json — check common keys (case-insensitive)
  if (ctype.includes("application/json")) {
    try {
      const body: any = await req.json();
      const candidates = ["pin", "PIN", "code", "passcode", "p"];
      for (const k of candidates) {
        const v = body?.[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      // generic scan
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

// --- HTTP handler -----------------------------------------------------------
export async function POST(req: Request) {
  try {
    const pin = await extractPin(req);
    if (!pin) return json({ error: "Missing pin" }, 400);

    // Optional length enforcement via env
    const PIN_DIGITS = Number(process.env.PIN_DIGITS || 0);
    if (PIN_DIGITS > 0 && pin.length !== PIN_DIGITS) {
      return json({ error: `Invalid pin length; expected ${PIN_DIGITS} digits` }, 400);
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return json({ error: "Expected multipart/form-data" }, 400);
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: "Missing file" }, 400);
    }

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

    // Optional DB record:
    // await supabase.from("uploads").insert({ pin, path: key, content_type: file.type || null, meta });

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
