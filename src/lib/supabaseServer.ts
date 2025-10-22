// src/lib/supabaseServer.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (uses the SERVICE ROLE key).
 * - Lazy-initialized at request time (avoids build-time env errors).
 * - Cached across HMR in dev and across calls in prod.
 * - Throws if imported/used on the client.
 */
let _serverClient: SupabaseClient | undefined;

// Support Next.js HMR in dev: cache on globalThis to avoid multiple instances.
const g = globalThis as typeof globalThis & {
  __PIXELock_SupabaseServerClient__?: SupabaseClient;
};

function requiredEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    // Fail clearly at runtime if route is called without required envs.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

export function supabaseServer(): SupabaseClient {
  // Hard guard: never allow the service client on the client/browser
  if (typeof window !== "undefined") {
    throw new Error("supabaseServer() must only be called on the server.");
  }

  // Reuse cached instance (dev: from global; prod: module-level)
  if (process.env.NODE_ENV !== "production") {
    if (!g.__PIXELock_SupabaseServerClient__) {
      g.__PIXELock_SupabaseServerClient__ = createClient(
        requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
        requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
        {
          auth: { persistSession: false },
        }
      );
    }
    return g.__PIXELock_SupabaseServerClient__;
  }

  if (!_serverClient) {
    _serverClient = createClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: { persistSession: false },
      }
    );
  }
  return _serverClient;
}
