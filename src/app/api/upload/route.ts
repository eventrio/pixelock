// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";
import { hashPin } from "@/lib/crypto"; // add this if missing (see below)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" }});
}

export async function POST(req: NextRequest) {
  try {
    // Parse body: expect JSON with { pin, maxViews?, ... } OR FormData; adapt to your UI
    const body = await req.json().catch(() => ({} as any));
    const pin = String(body.pin ?? "").trim();
    if (!pin) return json({ error: "Missing pin" }, 400);

    // Create IDs/timestamps
    const id = randomUUID();
    const token = randomUUID().replace(/-/g, "").slice(0, 16); // short token for URL
    const now = Date.now();

    const hours = Number(process.env.UPLOAD_TTL_HOURS ?? 24);
    const expiresIso = new Date(now + Math.max(1, hours) * 3600_000).toISOString();
    const maxViews = Number(process.env.MAX_VIEWS ?? 1);

    // 1) (If you upload the binary to Supabase Storage, do that here)
    // const filePath = `images/${id}.png`; // example
    // await supabase.storage.from('images').upload(filePath, fileBlob, { upsert: false });

    // 2) DB inserts
    const supabase = supabaseServer();

    // images row
    const { error: imgErr } = await supabase.from("images").insert({
      id,
      token,
      path: body.path ?? null, // or filePath from storage step above
      views: 0,
      max_views: maxViews,
      expires_at: expiresIso,
    });
    if (imgErr) return json({ error: imgErr.message }, 500);

    // image_shares row with hashed PIN
    const pin_hash = await hashPin(pin);
    const { error: shareErr } = await supabase.from("image_shares").insert({
      image_id: id,
      pin_hash,
    });
    if (shareErr) return json({ error: shareErr.message }, 500);

    // 3) Respond with share URL for /img/[token]
    const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "";
    const shareUrl = `${base.replace(/\/$/, "")}/img/${token}`;

    return json({ ok: true, id, token, expires_at: expiresIso, max_views: maxViews, url: shareUrl });
  } catch (e: any) {
    return json({ error: e?.message ?? "Upload failed" }, 500);
  }
}
