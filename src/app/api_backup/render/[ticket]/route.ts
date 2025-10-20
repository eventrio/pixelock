import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { ticket: string } }) {
  const ticketId = params.ticket;
  if (!ticketId) return NextResponse.json({ error: "No ticket" }, { status: 400 });

  // Consume ticket if unconsumed & not expired
  const consume = await supabaseServer
    .from("tickets")
    .update({ consumed: true })
    .eq("id", ticketId)
    .eq("consumed", false)
    .gt("expires_at", new Date().toISOString())
    .select("session_id")
    .single();

  if (consume.error || !consume.data) {
    return NextResponse.json({ error: "Ticket expired/invalid" }, { status: 410 });
  }

  // Find session → get image id
  const sessQ = await supabaseServer
    .from("view_sessions")
    .select("image_id, expires_at")
    .eq("id", consume.data.session_id)
    .maybeSingle();

  if (sessQ.error || !sessQ.data || new Date(sessQ.data.expires_at) <= new Date()) {
    return NextResponse.json({ error: "Session expired" }, { status: 410 });
  }

  // Stream bytes from private bucket
  const dl = await supabaseServer.storage.from("pixelock").download(sessQ.data.image_id);
  if (dl.error || !dl.data) {
    return NextResponse.json({ error: dl.error?.message || "Not found" }, { status: 404 });
  }

  const buf = Buffer.from(await dl.data.arrayBuffer());
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": 'inline; filename="pixelock.bin"',
    },
  });
}
