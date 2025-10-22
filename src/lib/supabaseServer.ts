import "server-only";
import { createClient } from "@supabase/supabase-js";

function normalizeUrl(u?: string) {
  if (!u) return u;
  let url = u.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;       // ensure protocol
  if (url.endsWith("/")) url = url.slice(0, -1);                // drop trailing slash
  return url;
}

const RAW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_URL = normalizeUrl(RAW_URL);
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing env: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify."
  );
}
if (!/^https:\/\//i.test(SUPABASE_URL)) {
  throw new Error(
    `NEXT_PUBLIC_SUPABASE_URL must be an https URL (got: "${RAW_URL}")`
  );
}

/**
 * Server-only Supabase client factory for API routes & server actions.
 */
export function supabaseServer() {
  try {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "pixelock-server" } },
    });
  } catch (e: any) {
    // createClient rarely throws; fetch errors will surface in the route.
    throw new Error(`Supabase client init failed: ${e?.message ?? e}`);
  }
}
