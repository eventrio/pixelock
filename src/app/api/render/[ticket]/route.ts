// src/app/api/view-ticket/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server"; // whatever your current import is

export const dynamic = "force-dynamic"; // optional, but common for server handlers

export async function POST(req: NextRequest) {
  try {
    const { session_id } = await req.json();

    if (!session_id || typeof session_id !== "string") {
      return NextResponse.json({ error: "session_id required" }, { status: 400 });
    }

    // ✅ Get a per-request server client
    const supabase = supabaseServer();

    // Look up the session to validate and get the image_id
    const { data: sessQ, error: sessErr } = await supabase
      .from("view_sessions")
      .select("image_id")
      .eq("id", session_id)
      .maybeSingle();

    if (sessErr) {
      return NextResponse.json({ error: sessErr.message }, { status: 500 });
    }
    if (!sessQ?.image_id) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 404 });
    }

    // Example: return the image_id (adjust to your real response)
    return NextResponse.json({ image_id: sessQ.image_id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
