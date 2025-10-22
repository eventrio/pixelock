import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: { ticket: string } }
) {
  try {
    const ticket = ctx?.params?.ticket;
    if (typeof ticket !== "string" || !ticket.trim()) {
      return NextResponse.json({ error: "ticket required" }, { status: 400 });
    }

    const supabase = supabaseServer(); // ✅ invoke factory

    // Example query—adjust to your schema
    const { data, error } = await supabase
      .from("tickets")
      .select("id, status, image_id")
      .eq("id", ticket)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: `DB error: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ ticket: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
