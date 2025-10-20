import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  // Find images whose views are fully consumed OR are time-expired
  const q = await supabaseServer
    .from("images")
    .select("id, storage_key, views_used, max_views, expires_at")
    .or(`views_used.gte.max_views,expires_at.lte.${new Date().toISOString()}`)
    .limit(1000);

  if (q.error) return NextResponse.json({ error: q.error.message }, { status: 500 });
  if (!q.data?.length) return NextResponse.json({ deleted: 0 });

  const keys = q.data.map((i) => i.storage_key);
  const rm = await supabaseServer.storage.from("pixelock").remove(keys);
  const ids = q.data.map((i) => i.id);
  const del = await supabaseServer.from("images").delete().in("id", ids);

  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });
  return NextResponse.json({ deleted: ids.length, storage: rm.data ?? null });
}
