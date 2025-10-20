import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest, _context: any) {
  const { session_id } = await req.json().catch(() => ({} as any));
  if (!session_id) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  // Look up the session to validate and get the image_id
  const sessQ = await supabaseServer
    .from("view_sessions")
    .select("image_id")
    .eq("id", session_id)
    .maybeSingle();

  if (sessQ.error || !sessQ.data) {
    return NextResponse.json({ error: "No session" }, { status: 404 });
  }

  // Optional: increment the image's view counter via RPC (ignore failures)
  try {
    await supabaseServer.rpc("increment_image_views", {
      p_image_id: sessQ.data.image_id,
    });
  } catch {
    // ignore (analytics only)
  }

  return NextResponse.json({ ok: true });
}
