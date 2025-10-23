// app/api/verify-pin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer"; // factory
import { verifyPin } from "@/lib/crypto";

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

export async function POST(req: NextRequest) {
  try {
    // 0) Parse input
    const body = await req.json().catch(() => ({} as any));
    const token = String(body.token ?? body.id ?? "").trim(); // token == storage object key (e.g. "pins/1234/.../uuid.jpg")
    const pin = String(body.pin ?? "").trim();
    if (!token || !pin) return json({ error: "Missing token/pin" }, 400);

    // 1) Server Supabase client
    const supabase = supabaseServer();

    // 2) Lookup image by STORAGE KEY, not "token" column
    //    We intentionally select only existing columns to avoid schema errors.
    const imgQ = await supabase
      .from("images")
      .select("id, views")
      .eq("key", token)        // <-- key, not token
      .maybeSingle();

    if (imgQ.error) return json({ error: imgQ.error.message }, 500);
    if (!imgQ.data) return json({ error: "Not found" }, 404);

    const { id: image_id, views } = imgQ.data;

    // 3) View limits (use env; avoid selecting non-existent DB columns)
    const MAX_VIEWS = Number(process.env.MAX_VIEWS ?? 1);
    const currentViews = Number(views ?? 0);
    if (currentViews >= Math.max(1, MAX_VIEWS)) {
      return json({ error: "Share expired" }, 410);
    }

    // 4) Get stored PIN hash
    const pinQ = await supabase
      .from("image_shares")
      .select("pin_hash")
      .eq("image_id", image_id)
      .maybeSingle();

    if (pinQ.error) return json({ error: pinQ.error.message }, 500);
    if (!pinQ.data) {
      // This means no share was created for this image_id.
      // Ensure your /api/upload route inserts pin_hash into image_shares at upload time.
      return json({ error: "Share not available" }, 410);
    }

    // 5) Verify PIN
    const ok = await verifyPin(pin, pinQ.data.pin_hash);
    if (!ok) return json({ error: "Invalid PIN" }, 401);

    // 6) Create short-lived view session + one-use ticket
    const now = Date.now();
    const ttlSec = Number(process.env.VIEW_SECONDS ?? 15);
    const ttlMs = Math.max(1, ttlSec) * 1000;
    const sessionId = randomUUID();
    const ticketId = randomUUID();
    const expiresIso = new Date(now + ttlMs).toISOString();

    const sessionIns = await supabase.from("view_sessions").insert({
      id: sessionId,
      image_id,
      expires_at: expiresIso,
    });
    if (sessionIns.error) return json({ error: sessionIns.error.message }, 500);

    const ticketIns = await supabase.from("tickets").insert({
      id: ticketId,
      session_id: sessionId,
      consumed: false,
      expires_at: expiresIso,
    });
    if (ticketIns.error) return json({ error: ticketIns.error.message }, 500);

    return json({ ticket: ticketId, view_ms: ttlMs }, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? "Unexpected error" }, 500);
  }
}
