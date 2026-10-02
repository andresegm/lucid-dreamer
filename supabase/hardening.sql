-- Fixes from `supabase db advisors`. Safe to re-run. Run after voice.sql.

-- Pin search_path on trigger functions
alter function public.set_updated_at() set search_path = '';
alter function public.set_row_owner() set search_path = '';

-- Signup trigger only; nobody should call it over the API
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Evaluate auth.uid() once per query instead of once per row
drop policy if exists "own dreams" on public.dreams;
create policy "own dreams" on public.dreams
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own tags" on public.tags;
create policy "own tags" on public.tags
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own dream_tags" on public.dream_tags;
create policy "own dream_tags" on public.dream_tags
  for all to authenticated
  using (
    exists (select 1 from public.dreams d where d.id = dream_id and d.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.dreams d where d.id = dream_id and d.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = (select auth.uid()))
  );

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
