// src/lib/analytics.ts
import { NextRequest } from 'next/server';
import { supabaseService } from '@/lib/supabaseServer';

type EventType =
  | 'upload'
  | 'share_created'
  | 'reveal_started'
  | 'share_expired'
  | 'error';

type AnyReq = NextRequest | Request;

export async function logEvent(
  req: AnyReq,
  event_type: EventType,
  meta: Record<string, any> = {},
) {
  try {
    const sb = supabaseService();
    const headers: Headers = (req as any).headers;

    // --- IP --------------------------------------------------------
    const ipHeader =
      headers.get('x-forwarded-for') ||
      headers.get('x-real-ip') ||
      headers.get('client-ip') ||
      '';

    const ip =
      ipHeader
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)[0] || null;

    // --- User agent & device type ---------------------------------
    const userAgent = headers.get('user-agent') || null;

    const device_type =
      /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent ?? '')
        ? 'mobile'
        : 'desktop';

    // --- Netlify geo header ---------------------------------------
    // Netlify adds x-nf-geo as a JSON string like:
    // { country: 'US', city: 'San Francisco', latitude: 37.7, longitude: -122.4, ... }
    let geo: any = undefined;
    const geoRaw = headers.get('x-nf-geo');
    if (geoRaw) {
      try {
        geo = JSON.parse(geoRaw);
      } catch {
        // ignore parse errors – keep geo undefined
      }
    }

    await sb.from('analytics_events').insert({
      event_type,
      source: 'web',
      device_type,
      ip,
      user_agent: userAgent,
      meta: { ...meta, geo },
    });
  } catch (err) {
    // Never break the core flow because of analytics
    console.error('logEvent failed', err);
  }
}
