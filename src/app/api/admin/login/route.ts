import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { pin } = await req.json().catch(() => ({ pin: '' as string }));

  const expected = process.env.DASHBOARD_PIN;

  if (!expected || pin !== expected) {
    return new NextResponse(
      JSON.stringify({ error: 'Invalid PIN' }),
      {
        status: 401,
        headers: { 'content-type': 'application/json' },
      },
    );
  }

  const res = NextResponse.json({ ok: true });

  // HttpOnly cookie so you stay logged in
  res.cookies.set('px_admin', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
