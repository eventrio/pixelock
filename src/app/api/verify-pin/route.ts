// app/api/verify-pin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer"; // should use SERVICE ROLE on server
import { verifyPin } from "@/lib/crypto";

export const runtime = "nodejs";           // ensure serverless Node on Vercel
export const dynamic = "force-dynamic";    // don't cache this route

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
    // Parse and normalize payload
    const body = await req.json().catch(() => ({} as any));
    const token = String(body.token ?? body.id ?? "").trim();
    const pin = String(body.pin ?? "").trim();

    if (!token || !pin) {
      return json({ error: "Missing token/pin" }, 400);
    }

    // 1) Lookup image by token
    const imgQ = await supabaseServer
      .from("images")
      .select("id, max_views, views, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (imgQ.error) {
      return json({ error: imgQ.error.message }, 500);
    }
    if (!imgQ.data) {
      return json({ error: "Not found" }, 404);
    }

    const { id: image_id, max_views, views, expires_at } = imgQ.data;

    // 2) Check expiry / view limits
    const now = Date.now();
    const expired =
      expires_at ? new Date(expires_at).getTime() <= now : false;
    const limitReached =
      (views ?? 0) >= (max_views ?? 1);

    if (expired || limitReached) {
      return json({ error: "Share expired" }, 410);
    }

    // 3) Get stored PIN hash
    const pinQ = await supabaseServer
      .from("image_shares")
      .select("pin_hash")
      .eq("image_id", image_id)
      .maybeSingle();

    if (pinQ.error) {
      return json({ error: pinQ.error.message }, 500);
    }
    if (!pinQ.data) {
      return json({ error: "Share not available" }, 410);
    }

    // 4) Verify PIN
    const ok = await verifyPin(pin, pinQ.data.pin_hash);
    if (!ok) {
      return json({ error: "Invalid PIN" }, 401);
    }

    // 5) Create a short-lived view session and a one-use ticket
    const ttlSec = Number(process.env.VIEW_SECONDS ?? 15);
    const ttlMs = Math.max(1, ttlSec) * 1000;
    const sessionId = randomUUID();
    const ticketId = randomUUID();
    const expiresIso = new Date(now + ttlMs).toISOString();

    const sessionIns = await supabaseServer.from("view_sessions").insert({
      id: sessionId,
      image_id,
      expires_at: expiresIso,
    });
    if (sessionIns.error) {
      return json({ error: sessionIns.error.message }, 500);
    }

    const ticketIns = await supabaseServer.from("tickets").insert({
      id: ticketId,
      session_id: sessionId,
      consumed: false,
      expires_at: expiresIso,
    });
    if (ticketIns.error) {
      return json({ error: ticketIns.error.message }, 500);
    }

    return json({ ticket: ticketId, view_ms: ttlMs }, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? "Unexpected error" }, 500);
  }
}
