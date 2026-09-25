-- ============================================================
-- Lucid Dream Journal — Supabase schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create extension if not exists "pgcrypto";

-- Enums --------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'lucidity_level') then
    create type lucidity_level as enum ('non-lucid', 'semi-lucid', 'lucid');
  end if;
  if not exists (select 1 from pg_type where typname = 'entry_kind') then
    create type entry_kind as enum ('dream', 'note');
  end if;
end $$;

-- Tables -------------------------------------------------------
create table if not exists public.dreams (
  id               uuid primary key default gen_random_uuid(),
  date             date not null,
  title            text not null,
  description      text not null default '',
  lucidity         lucidity_level not null default 'non-lucid',
  induction_method text,                     -- DILD, MILD, WBTB, WILD, DEILD, EILD, SSILD, FILD, or custom
  induction_notes  text,                     -- free-form detail about how it was induced
  entry_type       entry_kind not null default 'dream',
  favorite         boolean not null default false,
  source           text not null default 'app',   -- 'dreamjournal-2.5' | 'master-2025' | 'app'
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- full-text search over title + description
  search_vector    tsvector generated always as (
                     setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                     setweight(to_tsvector('english', coalesce(description, '')), 'B')
                   ) stored
);

create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text,                           -- optional hex color for the chip
  created_at timestamptz not null default now()
);
create unique index if not exists tags_name_unique_ci on public.tags (lower(name));

create table if not exists public.dream_tags (
  dream_id uuid not null references public.dreams(id) on delete cascade,
  tag_id   uuid not null references public.tags(id)   on delete cascade,
  primary key (dream_id, tag_id)
);

-- Indexes ------------------------------------------------------
create index if not exists dreams_date_idx        on public.dreams (date desc, created_at desc);
create index if not exists dreams_lucidity_idx    on public.dreams (lucidity);
create index if not exists dreams_induction_idx   on public.dreams (induction_method);
create index if not exists dreams_favorite_idx    on public.dreams (favorite) where favorite;
create index if not exists dreams_search_idx      on public.dreams using gin (search_vector);
create index if not exists dream_tags_tag_idx     on public.dream_tags (tag_id);

-- updated_at trigger -------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists dreams_set_updated_at on public.dreams;
create trigger dreams_set_updated_at
  before update on public.dreams
  for each row execute function public.set_updated_at();

-- Helper view: tags with usage counts --------------------------
create or replace view public.tags_with_counts as
  select t.id, t.name, t.color, t.created_at, count(dt.dream_id)::int as dream_count
  from public.tags t
  left join public.dream_tags dt on dt.tag_id = t.id
  group by t.id;

-- Row Level Security -------------------------------------------
-- Everything is private: only an authenticated session (your passcode login) can read/write.
alter table public.dreams     enable row level security;
alter table public.tags       enable row level security;
alter table public.dream_tags enable row level security;

drop policy if exists "auth full access dreams"     on public.dreams;
drop policy if exists "auth full access tags"       on public.tags;
drop policy if exists "auth full access dream_tags" on public.dream_tags;

create policy "auth full access dreams"     on public.dreams     for all to authenticated using (true) with check (true);
create policy "auth full access tags"       on public.tags       for all to authenticated using (true) with check (true);
create policy "auth full access dream_tags" on public.dream_tags for all to authenticated using (true) with check (true);

-- The view inherits RLS from its base tables (security_invoker) so anon can't read it either.
alter view public.tags_with_counts set (security_invoker = on);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.dreams, public.tags, public.dream_tags to authenticated;
grant select on public.tags_with_counts to authenticated;
