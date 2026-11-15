-- Privacy lock: a locked tag hides itself and every dream that carries it. Safe to re-run. Run after sleep.sql.

alter table public.tags add column if not exists locked boolean not null default false;

-- The app reads dreams only through this view, so a locked dream can't be listed, searched, filtered, or opened.
-- search_text and tag_ids let search match parts of words and tag names, and let tag filters run in the database.
create or replace view public.visible_dreams
  with (security_invoker = true) as
  select d.*,
    lower(
      coalesce(d.title, '') || ' ' || coalesce(d.description, '') || ' ' || coalesce((
        select string_agg(t.name, ' ')
        from public.dream_tags dt
        join public.tags t on t.id = dt.tag_id
        where dt.dream_id = d.id
      ), '')
    ) as search_text,
    coalesce((select array_agg(dt.tag_id) from public.dream_tags dt where dt.dream_id = d.id), '{}'::uuid[]) as tag_ids
  from public.dreams d
  where not exists (
    select 1
    from public.dream_tags dt
    join public.tags t on t.id = dt.tag_id
    where dt.dream_id = d.id and t.locked
  );

revoke all on table public.visible_dreams from public, anon;
grant select on table public.visible_dreams to authenticated;

-- Counts only dreams you can see; a locked tag still counts its own dreams for Settings.
create or replace view public.tags_with_counts
  with (security_invoker = true) as
  select t.id, t.name, t.color, t.created_at,
    (count(dt.dream_id) filter (where t.locked or v.id is not null))::int as dream_count,
    t.locked
  from public.tags t
  left join public.dream_tags dt on dt.tag_id = t.id
  left join public.visible_dreams v on v.id = dt.dream_id
  group by t.id;

grant select on table public.tags_with_counts to authenticated;

notify pgrst, 'reload schema';
