import 'server-only';
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabaseServer';
import { hashPin } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { token, pin } = await req.json();
  if (!token || !pin) return new Response(JSON.stringify({ error: 'Missing token or pin' }), { status: 400 });
  const sb = supabaseService();
  const { data: rows, error } = await sb.from('tickets').select('*').eq('token', token).limit(1);
  if (error || !rows || rows.length === 0) return new Response(JSON.stringify({ error: 'Invalid link' }), { status: 400 });
  const t = rows[0] as any;
  if (t.used) return new Response(JSON.stringify({ error: 'Link expired' }), { status: 410 });
  if (new Date(t.expires_at).getTime() < Date.now()) return new Response(JSON.stringify({ error: 'Link expired' }), { status: 410 });
  if (t.attempts >= (t.max_attempts ?? 5)) return new Response(JSON.stringify({ error: 'Too many attempts' }), { status: 423 });

  const ok = (await hashPin(pin)) === t.pin_hash;
  if (!ok) {
    await sb.from('tickets').update({ attempts: t.attempts + 1, last_failed_at: new Date().toISOString() }).eq('token', token);
    return new Response(JSON.stringify({ error: 'Incorrect PIN' }), { status: 401 });
  }
  await sb.from('tickets').update({ unlocked_at: new Date().toISOString() }).eq('token', token);

  const bucket = process.env.PIXEL_BUCKET || 'images';
  const { data: signed, error: sErr } = await sb.storage.from(bucket).createSignedUrl(t.object_path, 60);
  if (sErr) return new Response(JSON.stringify({ error: sErr.message }), { status: 500 });
  return new Response(JSON.stringify({ signedUrl: signed!.signedUrl, reveal_seconds: t.reveal_seconds ?? 15 }), { headers: { 'content-type': 'application/json' } });
}
