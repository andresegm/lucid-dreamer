-- Tighten isolation. Safe to re-run after per-user.sql.

alter table public.dreams     enable row level security;
alter table public.tags       enable row level security;
alter table public.dream_tags enable row level security;
alter table public.dreams     force row level security;
alter table public.tags       force row level security;
alter table public.dream_tags force row level security;

revoke all on table public.dreams, public.tags, public.dream_tags from public, anon;
revoke all on table public.tags_with_counts from public, anon;
revoke truncate on table public.dreams, public.tags, public.dream_tags from authenticated;

grant select, insert, update, delete on table public.dreams, public.tags, public.dream_tags to authenticated;
grant select on table public.tags_with_counts to authenticated;

-- profiles / voice_daily exist after their own SQL files; skip if this file is run first
do $$ begin
  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles enable row level security';
    execute 'alter table public.profiles force row level security';
    revoke all on table public.profiles from public, anon;
    revoke truncate on table public.profiles from authenticated;
    grant select, insert, update, delete on table public.profiles to authenticated;
  end if;
  if to_regclass('public.voice_daily') is not null then
    execute 'alter table public.voice_daily enable row level security';
    execute 'alter table public.voice_daily force row level security';
    revoke all on table public.voice_daily from public, anon, authenticated;
    grant select on table public.voice_daily to authenticated;
  end if;
end $$;

create or replace view public.tags_with_counts
  with (security_invoker = true) as
  select t.id, t.name, t.color, t.created_at, count(dt.dream_id)::int as dream_count
  from public.tags t
  left join public.dream_tags dt on dt.tag_id = t.id
  group by t.id;

grant select on table public.tags_with_counts to authenticated;

create or replace function public.set_row_owner()
returns trigger language plpgsql as $$
begin
  new.user_id := auth.uid();
  if new.user_id is null then
    raise exception 'Not signed in';
  end if;
  return new;
end $$;

drop trigger if exists dreams_set_owner on public.dreams;
create trigger dreams_set_owner
  before insert or update on public.dreams
  for each row execute function public.set_row_owner();

drop trigger if exists tags_set_owner on public.tags;
create trigger tags_set_owner
  before insert or update on public.tags
  for each row execute function public.set_row_owner();
