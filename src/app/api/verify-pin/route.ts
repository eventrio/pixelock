import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkPin } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { token, pin } = await req.json();
  if (!token || !pin) return NextResponse.json({ error: "Bad payload" }, { status: 400 });

  const imgQ = await supabaseServer.from("images").select("id, views_used, max_views, expires_at").eq("token", token).maybeSingle();
  if (imgQ.error || !imgQ.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const img = imgQ.data;
  if (img.expires_at && new Date(img.expires_at) <= new Date()) return NextResponse.json({ error: "Expired" }, { status: 410 });
  if ((img.views_used ?? 0) >= img.max_views) return NextResponse.json({ error: "Expired" }, { status: 410 });

  const shareQ = await supabaseServer.from("image_shares").select("id, pin_hash, attempt_count, locked_until").eq("image_id", img.id).maybeSingle();
  if (shareQ.error || !shareQ.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const share = shareQ.data;

  const now = new Date();
  if (share.locked_until && new Date(share.locked_until) > now) return NextResponse.json({ error: "Locked. Try later." }, { status: 429 });

  const ok = await checkPin(pin, share.pin_hash);
  if (!ok) {
    const maxAttempts = Number(process.env.PIN_MAX_ATTEMPTS || 5);
    const lockMins = Number(process.env.PIN_LOCK_MINUTES || 10);
    const attempts = (share.attempt_count ?? 0) + 1;
    const patch: any = { attempt_count: attempts };
    if (attempts >= maxAttempts) patch.locked_until = new Date(Date.now() + lockMins * 60 * 1000).toISOString();
    await supabaseServer.from("image_shares").update(patch).eq("id", share.id);
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  await supabaseServer.from("image_shares").update({ attempt_count: 0, locked_until: null }).eq("id", share.id);

  const newViews = (img.views_used ?? 0) + 1;
  const updImg = await supabaseServer.from("images").update({ views_used: newViews }).eq("id", img.id).select("views_used, max_views").single();
  if (updImg.error) return NextResponse.json({ error: "View update failed" }, { status: 500 });
  if (updImg.data.views_used > updImg.data.max_views) return NextResponse.json({ error: "Expired" }, { status: 410 });

  const remainingMs = 1000 * Number(process.env.VIEW_SECONDS || 15);
  const sessIns = await supabaseServer.from("view_sessions").insert({ image_id: img.id, remaining_ms: remainingMs }).select("id").single();
  if (sessIns.error || !sessIns.data) return NextResponse.json({ error: "Session error" }, { status: 500 });

  return NextResponse.json({ sessionId: sessIns.data.id });
}
