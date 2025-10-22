// src/app/api/view-ticket/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

/**
 * POST /api/view-ticket
 * Body: { session_id: string }
 * - Validates that the session exists and is not expired
 * - Mints a short-lived, one-use ticket linked to that session
 * - Returns { ticket, view_ms }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseServer();

    const body = await req.json().catch(() => ({} as any));
    const session_id = String(body.session_id ?? "").trim();
    if (!session_id) return json({ error: "Missing session_id" }, 400);

    // 1) Fetch the session to verify validity and get any existing expiry
    const sessQ = await supabase
      .from("view_sessions")
      .select("id, image_id, expires_at")
      .eq("id", session_id)
      .maybeSingle();

    if (sessQ.error) return json({ error: sessQ.error.message }, 500);
    if (!sessQ.data) return json({ error: "Session not found" }, 404);

    const { image_id, expires_at } = sessQ.data as {
      image_id: string;
      expires_at: string | null;
    };

    // 2) Check session expiry
    const now = Date.now();
    if (expires_at && new Date(expires_at).getTime() <= now) {
      return json({ error: "Session expired" }, 410);
    }

    // 3) Determine ticket TTL (don’t exceed session expiry)
    const ttlSec = Number(process.env.VIEW_SECONDS ?? 15);
    const ttlMs = Math.max(1, ttlSec) * 1000;
    const ticketExpiresAt = (() => {
      const byTtl = new Date(now + ttlMs).getTime();
      const bySession = expires_at ? new Date(expires_at).getTime() : byTtl;
      return new Date(Math.min(byTtl, bySession)).toISOString();
    })();

    // 4) Create a one-time ticket
    const ticketId = randomUUID();
    const ins = await supabase.from("tickets").insert({
      id: ticketId,
      session_id,
      consumed: false,
      expires_at: ticketExpiresAt,
    });
    if (ins.error) return json({ error: ins.error.message }, 500);

    return json({ ticket: ticketId, view_ms: ttlMs }, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? "Unexpected error" }, 500);
  }
}
