-- Daily voice cap: 2 recordings per account per UTC day. Safe to re-run.
-- Keep 2 in sync with VOICE_DAILY_LIMIT in app/src/lib/voice.ts

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
  using (user_id = auth.uid());

create or replace function public.claim_voice_use()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  insert into public.voice_daily (user_id, day, used)
  values (uid, (timezone('utc', now()))::date, 1)
  on conflict (user_id, day)
  do update set used = public.voice_daily.used + 1
  where public.voice_daily.used < 2
  returning used into n;
  return coalesce(n, -1);
end $$;

create or replace function public.release_voice_use()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  update public.voice_daily
  set used = used - 1
  where user_id = uid
    and day = (timezone('utc', now()))::date
    and used > 0;
end $$;

revoke all on function public.claim_voice_use() from public, anon;
revoke all on function public.release_voice_use() from public, anon;
grant execute on function public.claim_voice_use() to authenticated;
grant execute on function public.release_voice_use() to authenticated;
