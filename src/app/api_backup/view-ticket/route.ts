import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  // 1) Read session
  const sessQ = await supabaseServer
    .from("view_sessions")
    .select("id, image_id, remaining_ms, expires_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessQ.error || !sessQ.data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const sess = sessQ.data;
  if (new Date(sess.expires_at) <= new Date() || sess.remaining_ms <= 0) {
    return NextResponse.json({ error: "No remaining time or expired" }, { status: 410 });
  }

  // 2) Decrement remaining budget with a compare-and-swap style update
  const slice = 2000; // ms per ticket
  const newRemaining = Math.max(0, sess.remaining_ms - slice);
  const upd = await supabaseServer
    .from("view_sessions")
    .update({ remaining_ms: newRemaining })
    .eq("id", sessionId)
    .eq("remaining_ms", sess.remaining_ms) // prevent race; if changed, client can retry
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .single();

  if (upd.error || !upd.data) {
    return NextResponse.json({ error: "Budget race/expired; try again" }, { status: 409 });
  }
  if (newRemaining <= 0) {
    return NextResponse.json({ error: "No remaining time" }, { status: 410 });
  }

  // 3) Create a short-lived, one-use ticket row
  const tIns = await supabaseServer
    .from("tickets")
    .insert({ session_id: sessionId }) // expires_at default ~15s
    .select("id")
    .single();

  if (tIns.error || !tIns.data) {
    return NextResponse.json({ error: "Ticket error" }, { status: 500 });
  }

  return NextResponse.json({ ticket: tIns.data.id });
}
