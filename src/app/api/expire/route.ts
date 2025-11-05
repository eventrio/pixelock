import 'server-only';
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabaseServer';
import { logEvent } from '@/lib/analytics';  // ⬅️ NEW

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) {
    await logEvent(req, 'error', {
      kind: 'expire_missing_token',
    });

    return new Response(
      JSON.stringify({ error: 'Missing token' }),
      { status: 400 },
    );
  }

  const sb = supabaseService();
  const { data: rows, error } = await sb
    .from('tickets')
    .select('*')
    .eq('token', token)
    .limit(1);

  const t = rows?.[0];

  if (error) {
    await logEvent(req, 'error', {
      kind: 'expire_ticket_lookup_failed',
      token,
      message: error.message,
    });

    // still respond ok so front-end doesn’t get stuck
    return new Response(
      JSON.stringify({ ok: false }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }

  if (!t) {
    // Ticket already gone / cleaned up
    await logEvent(req, 'share_expired', {
      token,
      reason: 'ticket_not_found',
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }

  await sb
    .from('tickets')
    .update({ used: true })
    .eq('token', token);

  const bucket = process.env.PIXEL_BUCKET || 'images';

  try {
    await sb.storage.from(bucket).remove([t.object_path]);
  } catch (err: any) {
    await logEvent(req, 'error', {
      kind: 'expire_storage_remove_failed',
      token,
      bucket,
      object_path: t.object_path,
      message: err?.message ?? String(err),
    });
  }

  // ✅ Log successful share expiration
  await logEvent(req, 'share_expired', {
    token,
    bucket,
    object_path: t.object_path,
  });

  return new Response(
    JSON.stringify({ ok: true }),
    { headers: { 'content-type': 'application/json' } },
  );
}
