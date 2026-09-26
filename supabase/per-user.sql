-- Per-user journals. Run once in Supabase → SQL Editor before turning on signup.
-- Existing rows are assigned to the first auth user (the current passcode account).

alter table public.dreams add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.tags   add column if not exists user_id uuid references auth.users (id) on delete cascade;

update public.dreams
set user_id = (select id from auth.users order by created_at asc limit 1)
where user_id is null;

update public.tags
set user_id = (select id from auth.users order by created_at asc limit 1)
where user_id is null;

alter table public.dreams alter column user_id set default auth.uid();
alter table public.tags   alter column user_id set default auth.uid();
alter table public.dreams alter column user_id set not null;
alter table public.tags   alter column user_id set not null;

drop index if exists tags_name_unique_ci;
create unique index if not exists tags_user_name_unique_ci on public.tags (user_id, lower(name));
create index if not exists dreams_user_date_idx on public.dreams (user_id, date desc, created_at desc);

create or replace function public.set_row_owner()
returns trigger language plpgsql as $$
begin
  new.user_id := auth.uid();
  return new;
end $$;

drop trigger if exists dreams_set_owner on public.dreams;
create trigger dreams_set_owner
  before insert on public.dreams
  for each row execute function public.set_row_owner();

drop trigger if exists tags_set_owner on public.tags;
create trigger tags_set_owner
  before insert on public.tags
  for each row execute function public.set_row_owner();

drop policy if exists "auth full access dreams"     on public.dreams;
drop policy if exists "auth full access tags"       on public.tags;
drop policy if exists "auth full access dream_tags" on public.dream_tags;
drop policy if exists "own dreams"                  on public.dreams;
drop policy if exists "own tags"                    on public.tags;
drop policy if exists "own dream_tags"              on public.dream_tags;

create policy "own dreams" on public.dreams
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own tags" on public.tags
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "own dream_tags" on public.dream_tags
  for all to authenticated
  using (
    exists (select 1 from public.dreams d where d.id = dream_id and d.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.dreams d where d.id = dream_id and d.user_id = auth.uid())
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = auth.uid())
  );
