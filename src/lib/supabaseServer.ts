// src/lib/supabaseServer.ts
import { createClient } from "@supabase/supabase-js";

export function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!service) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  const client = createClient(url, service, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      // on Node 18+ fetch exists; binding ensures correct context
      fetch: (input: RequestInfo, init?: RequestInit) => fetch(input as any, init),
    },
  });

  return client;
}
