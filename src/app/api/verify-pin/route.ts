import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { verifyPin } from "@/lib/crypto";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest, _context: any) {
  const { token, pin } = await req.json().catch(() => ({} as any));
  if (!token || !pin) return NextResponse.json({ error: "Missing token/pin" }, { status: 400 });

  const imgQ = await supabaseServer
    .from("images")
    .select("id, max_views, views, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (imgQ.error || !imgQ.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { id: image_id, max_views, views, expires_at } = imgQ.data;

  if ((expires_at && new Date(expires_at) <= new Date()) || (views ?? 0) >= (max_views ?? 1)) {
    return NextResponse.json({ error: "Share expired" }, { status: 410 });
  }

  const pinQ = await supabaseServer
    .from("image_shares")
    .select("pin_hash")
    .eq("image_id", image_id)
    .maybeSingle();

  if (pinQ.error || !pinQ.data) return NextResponse.json({ error: "Share not available" }, { status: 410 });

  const ok = await verifyPin(pin, pinQ.data.pin_hash);
  if (!ok) return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });

  // create a short-lived view session and a one-use ticket
  const now = Date.now();
  const ttlMs = Number(process.env.VIEW_SECONDS || 15) * 1000;
  const sessionId = randomUUID();
  const ticketId = randomUUID();

  const sessionIns = await supabaseServer.from("view_sessions").insert({
    id: sessionId,
    image_id,
    expires_at: new Date(now + ttlMs).toISOString(),
  });
  if (sessionIns.error) return NextResponse.json({ error: sessionIns.error.message }, { status: 500 });

  const ticketIns = await supabaseServer.from("tickets").insert({
    id: ticketId,
    session_id: sessionId,
    consumed: false,
    expires_at: new Date(now + ttlMs).toISOString(),
  });
  if (ticketIns.error) return NextResponse.json({ error: ticketIns.error.message }, { status: 500 });

  return NextResponse.json({ ticket: ticketId, view_ms: ttlMs });
}
