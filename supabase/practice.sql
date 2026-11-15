-- Lucid practice log: one row per user per day. Safe to re-run. Run after sleep.sql.
-- `date` is the morning a night ended on (same as a dream's date); reality checks count on the calendar day.

create table if not exists public.practice_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  rc_count smallint not null default 0 check (rc_count between 0 and 500),
  mild_at timestamptz,
  mild_cue text not null default '',
  mild_dream_id uuid references public.dreams (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.practice_days enable row level security;
alter table public.practice_days force row level security;

revoke all on table public.practice_days from public, anon;
revoke truncate on table public.practice_days from authenticated;
grant select, insert, update, delete on table public.practice_days to authenticated;

drop policy if exists "own practice_days" on public.practice_days;
create policy "own practice_days" on public.practice_days
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop trigger if exists practice_days_set_owner on public.practice_days;
create trigger practice_days_set_owner
  before insert or update on public.practice_days
  for each row execute function public.set_row_owner();

drop trigger if exists practice_days_set_updated_at on public.practice_days;
create trigger practice_days_set_updated_at
  before update on public.practice_days
  for each row execute function public.set_updated_at();
