import { supabaseServer } from "@/lib/supabaseServer";

// Netlify/Next can be picky about the context param's type.
// Use the Web Fetch types (Request/Response) and leave the 2nd arg untyped.
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: any) {
  try {
    const ticket = context?.params?.ticket as string | undefined;

    if (!ticket || typeof ticket !== "string" || !ticket.trim()) {
      return new Response(JSON.stringify({ error: "ticket required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const supabase = supabaseServer();

    // Adjust table/columns to your schema as needed
    const { data, error } = await supabase
      .from("tickets")
      .select("id, status, image_id")
      .eq("id", ticket)
      .maybeSingle();

    if (error) {
      return new Response(
        JSON.stringify({ error: `DB error: ${error.message}` }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    if (!data) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ticket: data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
