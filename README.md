# PIXELock MVP (Next.js + Supabase + Netlify)

## Quick start
1. Copy `.env.local.example` to `.env.local` and fill your Supabase keys.
2. In Supabase, run `supabase/init.sql` once (creates private `images` bucket + `tickets` table).
3. `npm i` then `npm run dev`.
4. Deploy to Netlify and set the same env vars (include `SUPABASE_SERVICE_ROLE_KEY`).

## Notes
- Uploads go to private bucket `images`.
- `/api/create-ticket` returns a share URL `/img/[token]` and a 4-digit PIN.
- Viewer enters PIN → gets 60s signed URL; client enforces press-and-hold with a 15s countdown. On 0s, `/api/expire` marks used and deletes.
- Incorrect PIN 5× locks the ticket; links expire after 24h by default.
