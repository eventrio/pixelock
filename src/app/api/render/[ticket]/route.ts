// src/app/api/render/[ticket]/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function GET(req: Request) {
  try {
    const supabase = supabaseServer();

    // Extract the [ticket] param from the URL path to avoid type issues
    const url = new URL(req.url);
    // .../api/render/<ticket>
    const segments = url.pathname.split("/").filter(Boolean);
    const ticketId = segments[segments.length - 1]?.trim();
    if (!ticketId) return json({ error: "Missing ticket" }, 400);

    // 1) Atomically consume ticket if not expired
    const nowIso = new Date().toISOString();
    const consume = await supabase
      .from("tickets")
      .update({ consumed: true })
      .eq("id", ticketId)
      .eq("consumed", false)
      .gt("expires_at", nowIso)
      .select("session_id")
      .maybeSingle();

    if (consume.error) return json({ error: consume.error.message }, 500);
    if (!consume.data) return json({ error: "Ticket invalid or expired" }, 404);

    const sessionId = consume.data.session_id as string;

    // 2) Load & validate session
    const sessQ = await supabase
      .from("view_sessions")
      .select("image_id, expires_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessQ.error) return json({ error: sessQ.error.message }, 500);
    if (!sessQ.data) return json({ error: "Session not found" }, 404);

    const { image_id, expires_at } = sessQ.data as {
      image_id: string;
      expires_at: string | null;
    };

    if (expires_at && new Date(expires_at) <= new Date()) {
      return json({ error: "Session expired" }, 410);
    }

    // 3) Get storage path for the image
    const imgQ = await supabase
      .from("images")
      .select("path")
      .eq("id", image_id)
      .maybeSingle();

    if (imgQ.error) return json({ error: imgQ.error.message }, 500);
    if (!imgQ.data) return json({ error: "Image not found" }, 404);

    const storageKey =
      (imgQ.data as { path: string | null }).path ?? image_id;

    // 4) Download from Supabase Storage (bucket: "pixelock")
    const dl = await supabase.storage.from("pixelock").download(storageKey);
    if (dl.error || !dl.data) {
      return json({ error: dl.error?.message || "Not found" }, 404);
    }

    const buf = Buffer.from(await dl.data.arrayBuffer());

    // 5) Best-effort content type from file extension
    let contentType = "application/octet-stream";
    const lower = storageKey.toLowerCase();
    if (/\.(jpe?g)$/.test(lower)) contentType = "image/jpeg";
    else if (lower.endsWith(".png")) contentType = "image/png";
    else if (lower.endsWith(".webp")) contentType = "image/webp";
    else if (lower.endsWith(".gif")) contentType = "image/gif";
    else if (lower.endsWith(".bmp")) contentType = "image/bmp";
    else if (lower.endsWith(".heic") || lower.endsWith(".heif"))
      contentType = "image/heic";

    const filename = encodeURIComponent(
      storageKey.split("/").pop() || "pixelock.bin"
    );

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Unexpected error" }, 500);
  }
}
