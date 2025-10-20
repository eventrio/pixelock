import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest, _context: any) {
  const { session_id } = await req.json().catch(() => ({} as any));
  if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

  // Increment views when session is first acknowledged (optional)
  const sessQ = await supabaseServer
    .from("view_sessions")
    .select("image_id")
    .eq("id", session_id)
    .maybeSingle();

  if (sessQ.error || !sessQ.data) return NextResponse.json({ error: "No session" }, { status: 404 });

  const upd = await supabaseServer.rpc("increment_image_views", { p_image_id: sessQ.data.image_id }).catch(() => null);
  // ignore RPC failure; it's optional
  return NextResponse.json({ ok: true });
}
