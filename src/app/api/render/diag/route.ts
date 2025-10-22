import "server-only";

const RAW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const URL = (() => {
  const trimmed = RAW_URL.replace(/\/+$/,"");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
})();
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET() {
  try {
    if (!RAW_URL) return json({ ok:false, error:"NEXT_PUBLIC_SUPABASE_URL missing" }, 500);

    // 1) public health (no auth)
    let health: { status:number; ok:boolean; error?:string } = { status:0, ok:false };
    try {
      const res = await fetch(`${URL}/auth/v1/health`, { method: "GET" });
      health = { status: res.status, ok: res.ok };
    } catch (e:any) {
      health = { status: 0, ok: false, error: String(e?.message || e) };
    }

    // 2) REST handshake (HEAD) with service key
    let rest: { status:number; ok:boolean; error?:string } = { status:0, ok:false };
    if (!SRK) {
      rest = { status: 0, ok: false, error: "SUPABASE_SERVICE_ROLE_KEY missing" };
    } else {
      try {
        const head = await fetch(`${URL}/rest/v1/`, {
          method: "HEAD",
          headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
        });
        rest = { status: head.status, ok: head.ok };
      } catch (e:any) {
        rest = { status: 0, ok: false, error: String(e?.message || e) };
      }
    }

    return json({
      url: URL,
      url_has_protocol: /^https?:\/\//i.test(URL),
      key_present: Boolean(SRK),
      key_len: SRK ? SRK.length : 0,
      health,
      rest,
    });
  } catch (e:any) {
    return json({ ok:false, error: String(e?.message || e) }, 500);
  }
}
