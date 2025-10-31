insert into storage.buckets (id, name, public) values ('images', 'images', false)
  on conflict (id) do nothing;

create table if not exists public.tickets (
  token text primary key,
  pin_hash text not null,
  object_path text not null,
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone not null,
  used boolean default false,
  attempts int default 0,
  max_attempts int default 5,
  reveal_seconds int default 15,
  unlocked_at timestamp with time zone
);

alter table public.tickets enable row level security;
create policy "service-only" on public.tickets
  for all using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');
