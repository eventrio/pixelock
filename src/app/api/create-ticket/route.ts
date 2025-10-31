import 'server-only';
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabaseServer';
import { randomToken, hashPin } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { object_path } = await req.json();
  if (!object_path) return new Response(JSON.stringify({ error: 'Missing object_path' }), { status: 400 });
  const token = randomToken(16);
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  const pin_hash = await hashPin(pin);
  const hours = Number(process.env.PIXEL_LINK_TTL_HOURS || 24);
  const expires_at = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const reveal_seconds = Number(process.env.PIXEL_REVEAL_SECONDS || 15);

  const sb = supabaseService();
  const { error } = await sb.from('tickets').insert({ token, pin_hash, object_path, expires_at, reveal_seconds });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ token, pin }), { headers: { 'content-type': 'application/json' } });
}
