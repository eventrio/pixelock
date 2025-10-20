import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

// Next.js 15: accept a generic context object to avoid signature/type errors.
export async function GET(_req: NextRequest, context: any) {
  const ticketId = context?.params?.ticket as string | undefined;
  if (!ticketId) {
    return NextResponse.json({ error: "No ticket" }, { status: 400 });
  }

  // Consume the ticket if it's valid (not used, not expired)
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

  // Verify the view session is still valid
  const sessQ = await supabaseServer
    .from("view_sessions")
    .select("image_id, expires_at")
    .eq("id", consume.data.session_id)
    .maybeSingle();

  if (
    sessQ.error ||
    !sessQ.data ||
    new Date(sessQ.data.expires_at) <= new Date()
  ) {
    return NextResponse.json({ error: "Session expired" }, { status: 410 });
  }

  const storageKey = sessQ.data.image_id;

  // Download the file from Supabase Storage
  const dl = await supabaseServer.storage.from("pixelock").download(storageKey);
  if (dl.error || !dl.data) {
    return NextResponse.json(
      { error: dl.error?.message || "Not found" },
      { status: 404 }
    );
  }

  const buf = Buffer.from(await dl.data.arrayBuffer());

  // Best-effort content type from filename
  let contentType = "application/octet-stream";
  const lower = storageKey.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg";
  else if (lower.endsWith(".png")) contentType = "image/png";
  else if (lower.endsWith(".webp")) contentType = "image/webp";
  else if (lower.endsWith(".gif")) contentType = "image/gif";
  else if (lower.endsWith(".bmp")) contentType = "image/bmp";
  else if (lower.endsWith(".heic") || lower.endsWith(".heif")) contentType = "image/heic";

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": `inline; filename="${encodeURIComponent(storageKey.split("/").pop() || "pixelock.bin")}"`,
    },
  });
}
