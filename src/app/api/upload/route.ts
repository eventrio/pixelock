import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { genPin, hashPin } from "@/lib/crypto";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const data = await req.formData();
  const file = data.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  const imageId = randomUUID();
  const token = imageId.slice(0, 8) + Math.random().toString(36).slice(2, 10);
  const storageKey = `${imageId}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const up = await supabaseServer.storage.from("pixelock").upload(storageKey, buf, {
    upsert: false, contentType: file.type || "application/octet-stream",
  });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const pin = genPin();
  const pin_hash = await hashPin(pin);

  const maxViews = Number(process.env.MAX_VIEWS || 1);
  const ttlHours = Number(process.env.UPLOAD_TTL_HOURS || 0);
  const expiresAtISO = ttlHours > 0 ? new Date(Date.now() + ttlHours * 3600_000).toISOString() : null;

  const ins1 = await supabaseServer.from("images").insert({
    id: imageId, token, storage_key: storageKey, max_views: maxViews, ...(expiresAtISO ? { expires_at: expiresAtISO } : {}),
  });
  if (ins1.error) return NextResponse.json({ error: ins1.error.message }, { status: 500 });

  const ins2 = await supabaseServer.from("image_shares").insert({ image_id: imageId, pin_hash });
  if (ins2.error) return NextResponse.json({ error: ins2.error.message }, { status: 500 });

  const shareText = `An image has been shared with you!
Follow the link: ${process.env.NEXT_PUBLIC_APP_URL}/img/${token}
Pin: ${pin}`;
  return NextResponse.json({ token, pin, shareText });
}
