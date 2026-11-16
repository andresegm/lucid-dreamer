-- Dream sign scan: one AI analysis per account per UTC day, and the last result. Safe to re-run. Run after tag-lock.sql.
-- Keep the 1-a-day rule in sync with SIGN_SCAN_DAILY_LIMIT in app/src/lib/signScan.ts
-- Only the dream-signs Edge Function (service role) can claim a scan or save a result;
-- users can read their own row but never change it.

create table if not exists public.dream_sign_scans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  day date not null,
  result jsonb,
  scanned_at timestamptz,
  started_at timestamptz
);
alter table public.dream_sign_scans add column if not exists started_at timestamptz;

alter table public.dream_sign_scans enable row level security;
alter table public.dream_sign_scans force row level security;

revoke all on table public.dream_sign_scans from public, anon, authenticated;
grant select on table public.dream_sign_scans to authenticated;

drop policy if exists "own dream_sign_scans" on public.dream_sign_scans;
create policy "own dream_sign_scans" on public.dream_sign_scans
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 1 when today's scan was claimed, -1 when it was already used.
-- A scan that started more than 5 minutes ago and never saved a result is treated as dead, so it can be claimed again.
-- Keep the 5 minutes in sync with SCAN_STALE_MS in app/src/lib/signScan.ts
create or replace function public.claim_sign_scan(p_user uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  insert into public.dream_sign_scans as s (user_id, day, started_at)
  values (p_user, (timezone('utc', now()))::date, now())
  on conflict (user_id)
  do update set day = excluded.day, started_at = excluded.started_at
  where s.day < excluded.day
    or (
      (s.scanned_at is null or s.scanned_at < s.started_at)
      and s.started_at < now() - interval '5 minutes'
    )
  returning 1 into n;
  return coalesce(n, -1);
end $$;

-- Hands today's scan back after a failed analysis. The last saved result is kept.
create or replace function public.release_sign_scan(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.dream_sign_scans
  set day = day - 1
  where user_id = p_user
    and day = (timezone('utc', now()))::date;
end $$;

-- Stores a finished scan. A function rather than a direct table write, so it does not depend on
-- the service role having been granted access to this table.
create or replace function public.save_sign_scan(p_user uuid, p_result jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  t timestamptz;
begin
  update public.dream_sign_scans
  set result = p_result, scanned_at = now()
  where user_id = p_user
  returning scanned_at into t;
  if t is null then
    raise exception 'no scan row for user';
  end if;
  return t;
end $$;

revoke all on function public.save_sign_scan(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_sign_scan(uuid, jsonb) to service_role;

revoke all on function public.claim_sign_scan(uuid) from public, anon, authenticated;
revoke all on function public.release_sign_scan(uuid) from public, anon, authenticated;
grant execute on function public.claim_sign_scan(uuid) to service_role;
grant execute on function public.release_sign_scan(uuid) to service_role;

notify pgrst, 'reload schema';
