-- Daily voice cap: 2 recordings per account per UTC day. Safe to re-run.
-- Keep 2 in sync with VOICE_DAILY_LIMIT in app/src/lib/voice.ts
-- Only the transcribe Edge Function (service role) can claim or release a use;
-- users can read their own count but never change it.

create table if not exists public.voice_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  used int not null default 0 check (used >= 0),
  primary key (user_id, day)
);

alter table public.voice_daily enable row level security;
alter table public.voice_daily force row level security;

revoke all on table public.voice_daily from public, anon, authenticated;
grant select on table public.voice_daily to authenticated;

drop policy if exists "own voice_daily" on public.voice_daily;
create policy "own voice_daily" on public.voice_daily
  for select to authenticated
  using (user_id = (select auth.uid()));

drop function if exists public.claim_voice_use();
drop function if exists public.release_voice_use();

create or replace function public.claim_voice_use(p_user uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  insert into public.voice_daily (user_id, day, used)
  values (p_user, (timezone('utc', now()))::date, 1)
  on conflict (user_id, day)
  do update set used = public.voice_daily.used + 1
  where public.voice_daily.used < 2
  returning used into n;
  return coalesce(n, -1);
end $$;

create or replace function public.release_voice_use(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.voice_daily
  set used = used - 1
  where user_id = p_user
    and day = (timezone('utc', now()))::date
    and used > 0;
end $$;

revoke all on function public.claim_voice_use(uuid) from public, anon, authenticated;
revoke all on function public.release_voice_use(uuid) from public, anon, authenticated;
grant execute on function public.claim_voice_use(uuid) to service_role;
grant execute on function public.release_voice_use(uuid) to service_role;
