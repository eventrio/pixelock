// src/app/api/upload/route.ts
import "server-only";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// ---- small helpers ---------------------------------------------------------
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Accept PIN from multiple locations (Authorization, X-Pin, cookie, form, json)
async function extractPin(req: Request): Promise<string | undefined> {
  // 1) Authorization: Bearer <pin>
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const p = auth.slice(7).trim();
    if (p) return p;
  }

  // 1b) X-Pin header (fallback if proxies strip Authorization)
  const xpin = req.headers.get("x-pin") || req.headers.get("X-Pin");
  if (xpin && xpin.trim()) return xpin.trim();

  // 2) Cookie: pin=<pin>
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)pin=([^;]+)/i);
  if (m?.[1]) return decodeURIComponent(m[1]);

  const ctype = req.headers.get("content-type") || "";

  // 3) multipart/form-data
  if (ctype.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const pin = form.get("pin");
      if (typeof pin === "string" && pin.trim()) return pin.trim();
    } catch {
      // ignore and continue
    }
  }

  // 4) application/json
  if (ctype.includes("application/json")) {
    try {
      const body = await req.json();
      const pin = body?.pin;
      if (typeof pin === "string" && pin.trim()) return pin.trim();
    } catch {
      // ignore
    }
  }

  return undefined;
}

// ---- HTTP handler ----------------------------------------------------------
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
    if (!contentType.includes("multipart/form-data")) {
      return json({ error: "Expected multipart/form-data" }, 400);
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: "Missing file" }, 400);
    }

    // Optional extra metadata
    const metaRaw = form.get("meta");
    let meta: Record<string, unknown> | undefined;
    if (typeof metaRaw === "string") {
      try { meta = JSON.parse(metaRaw); } catch { /* ignore */ }
    }

    const supabase = supabaseServer();

    // Change this if your bucket name differs
    const bucket = "uploads";

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

    // Optional: record to a table
    // const { error: dbErr } = await supabase.from("uploads").insert({
    //   pin,
    //   path: key,
    //   content_type: file.type || null,
    //   meta,
    // });
    // if (dbErr) return json({ error: `DB error: ${dbErr.message}` }, 500);

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
