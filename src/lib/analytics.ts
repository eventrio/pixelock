// src/lib/analytics.ts
import { NextRequest } from 'next/server';
import { supabaseService } from './supabaseServer';

export type AnalyticsEventType =
  | 'upload'
  | 'share_created'
  | 'reveal_started'
  | 'reveal_viewed'
  | 'share_expired'
  | 'error';

export async function logEvent(
  req: NextRequest,
  event_type: AnalyticsEventType,
  meta: Record<string, any> = {},
) {
  try {
    const supabase = supabaseService();

    const ua = req.headers.get('user-agent') ?? null;
    const ipHeader =
      req.headers.get('x-forwarded-for') ??
      req.headers.get('x-real-ip') ??
      null;
    const ip = ipHeader ? ipHeader.split(',')[0].trim() : null;

    const device_type =
      ua && /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' : 'desktop';

    await supabase.from('analytics_events').insert({
      event_type,
      user_agent: ua,
      ip,
      device_type,
      source: 'web',
      meta,
    });
  } catch (err) {
    // Logging should NEVER break core flows
    console.error('analytics logEvent failed', err);
  }
}
