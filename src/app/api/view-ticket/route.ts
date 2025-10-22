import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const session_id: unknown = body?.session_id;

    if (typeof session_id !== "string" || !session_id.trim()) {
      return NextResponse.json(
        { error: "session_id required" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer(); // ✅ invoke factory

    const { data, error } = await supabase
      .from("view_sessions")
      .select("image_id")
      .eq("id", session_id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: `DB error: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data?.image_id) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 404 }
      );
    }

    return NextResponse.json({ image_id: data.image_id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
        { error: e?.message ?? "Server error" },
        { status: 500 }
    );
  }
}
