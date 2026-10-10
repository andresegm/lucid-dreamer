-- Sleep hygiene log: one row per user per morning. Safe to re-run. Run after hardening.sql.

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  bed_time time,
  wake_time time,
  alarm boolean,
  wbtb boolean,
  awakenings smallint check (awakenings between 0 and 50),
  total_sleep_min smallint check (total_sleep_min between 0 and 1440),
  rem_min smallint check (rem_min between 0 and 1440),
  rested smallint check (rested between 1 and 5),
  checklist jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.sleep_logs enable row level security;
alter table public.sleep_logs force row level security;

revoke all on table public.sleep_logs from public, anon;
revoke truncate on table public.sleep_logs from authenticated;
grant select, insert, update, delete on table public.sleep_logs to authenticated;

drop policy if exists "own sleep_logs" on public.sleep_logs;
create policy "own sleep_logs" on public.sleep_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop trigger if exists sleep_logs_set_owner on public.sleep_logs;
create trigger sleep_logs_set_owner
  before insert or update on public.sleep_logs
  for each row execute function public.set_row_owner();

drop trigger if exists sleep_logs_set_updated_at on public.sleep_logs;
create trigger sleep_logs_set_updated_at
  before update on public.sleep_logs
  for each row execute function public.set_updated_at();
