// src/app/dashboard/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseService } from '@/lib/supabaseServer';

type AnalyticsRow = {
  event_type: string;
  created_at: string;
  device_type: string | null;
  ip: string | null;
  meta: any;
};

type Stats = {
  totalUploads: number;
  totalShares: number;
  totalReveals: number;
  mobileReveals: number;
  desktopReveals: number;
};

function computeStats(events: AnalyticsRow[]): Stats {
  let totalUploads = 0;
  let totalShares = 0;
  let totalReveals = 0;
  let mobileReveals = 0;
  let desktopReveals = 0;

  for (const e of events) {
    if (e.event_type === 'upload') totalUploads += 1;
    if (e.event_type === 'share_created') totalShares += 1;
    if (e.event_type === 'reveal_started') {
      totalReveals += 1;
      if (e.device_type === 'mobile') mobileReveals += 1;
      if (e.device_type === 'desktop') desktopReveals += 1;
    }
  }

  return {
    totalUploads,
    totalShares,
    totalReveals,
    mobileReveals,
    desktopReveals,
  };
}

type DailyCount = { date: string; count: number };

function groupUploadsByDay(events: AnalyticsRow[]): DailyCount[] {
  const map = new Map<string, number>();

  for (const e of events) {
    if (e.event_type !== 'upload') continue;
    const d = new Date(e.created_at);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, count]) => ({ date, count }));
}

type CountryAgg = {
  country: string;
  count: number;
  sampleIps: string[];
  lat?: number;
  lon?: number;
};

type Marker = CountryAgg & { x: number; y: number };

function buildGeoAgg(events: AnalyticsRow[]): {
  countries: CountryAgg[];
  markers: Marker[];
} {
  const byCountry = new Map<string, CountryAgg>();

  for (const e of events) {
    const meta: any = e.meta ?? {};
    const geo: any = meta.geo ?? {};

    const country =
      geo.country_code ||
      geo.country ||
      'Unknown';

    const lat =
      typeof geo.latitude === 'number' ? geo.latitude : undefined;
    const lon =
      typeof geo.longitude === 'number' ? geo.longitude : undefined;

    const ip = e.ip ?? null;

    const key = country || 'Unknown';

    if (!byCountry.has(key)) {
      byCountry.set(key, {
        country: key,
        count: 0,
        sampleIps: [],
        lat,
        lon,
      });
    }

    const entry = byCountry.get(key)!;
    entry.count += 1;

    if (ip && entry.sampleIps.length < 3 && !entry.sampleIps.includes(ip)) {
      entry.sampleIps.push(ip);
    }

    // Keep the first lat/lon we see for this country
    if (lat !== undefined && lon !== undefined && entry.lat === undefined) {
      entry.lat = lat;
      entry.lon = lon;
    }
  }

  const countries = Array.from(byCountry.values()).sort(
    (a, b) => b.count - a.count,
  );

  const markers: Marker[] = countries
    .filter((c) => typeof c.lat === 'number' && typeof c.lon === 'number')
    .map((c) => {
      // crude lat/lon -> percentage position
      const x = ((c.lon! + 180) / 360) * 100; // 0–100
      const y = ((90 - c.lat!) / 180) * 100; // 0–100 (top is 0)
      return { ...c, x, y };
    });

  return { countries, markers };
}

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // 🔐 PIN gate
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get('px_admin');
  if (!adminCookie || adminCookie.value !== '1') {
    redirect('/dashboard/login');
  }

  const sb = supabaseService();
  const { data, error } = await sb
    .from('analytics_events')
    .select('event_type,created_at,device_type,ip,meta')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('dashboard analytics fetch error', error.message);
  }

  const events: AnalyticsRow[] = data ?? [];

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const events7 = events.filter(
    (e) => new Date(e.created_at) >= sevenDaysAgo,
  );
  const events30 = events.filter(
    (e) => new Date(e.created_at) >= thirtyDaysAgo,
  );

  const stats7 = computeStats(events7);
  const stats30 = computeStats(events30);
  const statsAll = computeStats(events);

  const uploadsByDay7 = groupUploadsByDay(events7);
  const max7 = uploadsByDay7.reduce(
    (m, d) => (d.count > m ? d.count : m),
    0,
  );

  function shareViewedPercent(s: Stats) {
    if (s.totalShares === 0) return 0;
    return Math.round((s.totalReveals / s.totalShares) * 100);
  }

  function mobilePercent(s: Stats) {
    const total = s.mobileReveals + s.desktopReveals;
    if (total === 0) return 0;
    return Math.round((s.mobileReveals / total) * 100);
  }

  const shareViewed7 = shareViewedPercent(stats7);
  const mobile7 = mobilePercent(stats7);

  // 🌍 Geo aggregation (last 30 days)
  const { countries, markers } = buildGeoAgg(events30);

  return (
    <div className="mx-auto mt-10 flex w-full max-w-6xl flex-col gap-8">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">
            PIXELock Usage
          </h1>
          <p className="text-sm text-gray-600">
            Internal dashboard. Data pulled from Supabase analytics_events.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Last updated: {now.toLocaleString()}
        </span>
      </header>

      {/* Top-level cards for last 7 days */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Last 7 days
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-500">
              Total uploads
            </div>
            <div className="mt-2 text-2xl font-bold text-brand-ink">
              {stats7.totalUploads}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-500">
              Shares actually viewed
            </div>
            <div className="mt-2 text-2xl font-bold text-brand-ink">
              {shareViewed7}%
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {stats7.totalReveals}/{stats7.totalShares} shares
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-gray-500">
              Mobile vs desktop reveals
            </div>
            <div className="mt-2 text-2xl font-bold text-brand-ink">
              {mobile7}% mobile
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {stats7.mobileReveals} mobile · {stats7.desktopReveals} desktop
            </div>
          </div>
        </div>
      </section>

      {/* Uploads per day chart (7d) */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Uploads per day (last 7 days)
        </h2>
        {uploadsByDay7.length === 0 ? (
          <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">
            No uploads recorded in the last 7 days.
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-4">
            <ul className="space-y-2 text-sm">
              {uploadsByDay7.map((d) => {
                const pct = max7 ? (d.count / max7) * 100 : 0;
                return (
                  <li key={d.date} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 tabular-nums">
                      {d.date}
                    </span>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-brand-blue"
                          style={{ width: `${pct || 5}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-10 shrink-0 text-right tabular-nums">
                      {d.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Summary for 30d and All time */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Last 30 days
          </h2>
          <p className="text-sm text-gray-600">
            Uploads:{' '}
            <span className="font-semibold text-brand-ink">
              {stats30.totalUploads}
            </span>
          </p>
          <p className="text-sm text-gray-600">
            Shares viewed:{' '}
            <span className="font-semibold text-brand-ink">
              {shareViewedPercent(stats30)}%
            </span>{' '}
            ({stats30.totalReveals}/{stats30.totalShares})
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            All time
          </h2>
          <p className="text-sm text-gray-600">
            Uploads:{' '}
            <span className="font-semibold text-brand-ink">
              {statsAll.totalUploads}
            </span>
          </p>
          <p className="text-sm text-gray-600">
            Shares viewed:{' '}
            <span className="font-semibold text-brand-ink">
              {shareViewedPercent(statsAll)}%
            </span>{' '}
            ({statsAll.totalReveals}/{statsAll.totalShares})
          </p>
        </div>
      </section>

      {/* 🌍 GEO SECTION – last 30 days */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Usage geography (last 30 days)
        </h2>

        {countries.length === 0 ? (
          <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">
            No geo data recorded yet. New events will start capturing location
            via Netlify&apos;s geo headers after the latest deploy.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
            {/* Simple “map” with hover markers */}
            <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border bg-gradient-to-b from-sky-50 to-slate-100">
              {markers.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  Geo locations available, but no lat/lon on records yet.
                </div>
              )}

              {markers.map((m) => (
                <div
                  key={m.country}
                  className="group absolute"
                  style={{
                    left: `${Math.min(98, Math.max(2, m.x))}%`,
                    top: `${Math.min(96, Math.max(4, m.y))}%`,
                  }}
                >
                  <div className="h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-blue shadow-[0_0_0_4px_rgba(0,139,244,0.25)]" />
                  <div className="pointer-events-none absolute left-1/2 top-[-0.4rem] z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
                    <div className="font-semibold">{m.country}</div>
                    <div className="text-[11px] text-slate-200">
                      {m.count} events
                    </div>
                    {m.sampleIps.length > 0 && (
                      <div className="mt-1 text-[10px] text-slate-300">
                        IPs:{' '}
                        {m.sampleIps.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Top locations list */}
            <div className="rounded-2xl border bg-white p-4 text-sm">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Top locations
              </h3>
              <ul className="space-y-1">
                {countries.slice(0, 10).map((c) => (
                  <li
                    key={c.country}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="truncate">
                      {c.country}
                    </span>
                    <span className="tabular-nums text-gray-700">
                      {c.count}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-gray-400">
                Hover markers on the map to see sample IPs per country. IP
                addresses are only visible here on the private dashboard.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
