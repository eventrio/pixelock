import 'server-only';
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return new Response(JSON.stringify({ error: 'No file' }), { status: 400 });
  const live = (form.get('live') as string | null) === 'true';

  const sb = supabaseService();
  const bucket = process.env.PIXEL_BUCKET || 'images';
  const key = `${Date.now()}_${crypto.randomUUID()}.${file.name.split('.').pop() || 'jpg'}`;
  const { data, error } = await sb.storage.from(bucket).upload(key, await file.arrayBuffer(), { contentType: file.type || 'image/jpeg', upsert: false, metadata: { live: String(live) } });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ path: data!.path }), { headers: { 'content-type': 'application/json' } });
}
