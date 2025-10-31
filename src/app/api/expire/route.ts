import 'server-only';
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400 });
  const sb = supabaseService();
  const { data: rows } = await sb.from('tickets').select('*').eq('token', token).limit(1);
  const t = rows?.[0];
  if (!t) return new Response(JSON.stringify({ ok: true }), { status: 200 });
  await sb.from('tickets').update({ used: true }).eq('token', token);
  try { await sb.storage.from(process.env.PIXEL_BUCKET || 'images').remove([t.object_path]); } catch {}
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
}
