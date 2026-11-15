import { supabase } from './supabase'
import type { Dream, DreamFilters, DreamInput, DreamLite, Tag } from './types'
import { searchTerms } from './format'

const DREAM_SELECT =
  'id, date, title, description, lucidity, induction_method, induction_notes, entry_type, favorite, source, created_at, updated_at, dream_tags(tags(id, name, color))'
/** Dreams minus any carrying a locked tag. Every read goes here; writes go to `dreams`. */
const VISIBLE = 'visible_dreams'

/** The API returns at most 1,000 rows per request, so anything meant to be complete is read in pages. */
const API_PAGE = 1000

async function fetchEvery<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += API_PAGE) {
    const { data, error } = await page(from, from + API_PAGE - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < API_PAGE) return out
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDream(row: any): Dream {
  const tags: Tag[] = (row.dream_tags ?? [])
    .map((dt: { tags: Tag | null }) => dt.tags)
    .filter(Boolean)
    .sort((a: Tag, b: Tag) => a.name.localeCompare(b.name))
  const { dream_tags: _omit, ...rest } = row
  void _omit
  return { ...rest, tags } as Dream
}

/** Resolve tag filters to a set of dream ids (or null when no tag filter is active). */
async function dreamIdsForTags(tagIds: string[], mode: 'any' | 'all'): Promise<string[] | null> {
  if (tagIds.length === 0) return null
  const data = await fetchEvery((from, to) =>
    supabase.from('dream_tags').select('dream_id, tag_id').in('tag_id', tagIds).order('dream_id').order('tag_id').range(from, to),
  )
  if (mode === 'any') return Array.from(new Set(data.map((r) => r.dream_id)))
  const counts = new Map<string, number>()
  for (const r of data) counts.set(r.dream_id, (counts.get(r.dream_id) ?? 0) + 1)
  return Array.from(counts.entries()).filter(([, n]) => n >= tagIds.length).map(([id]) => id)
}

/** Flips to false once the database turns out to have an older supabase/tag-lock.sql, without search_text and tag_ids. */
let richSearch = true

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&')

/**
 * One page of the list. With the current tag-lock.sql applied, search matches parts of words and tag names, and tag
 * filters run in the database; without it, this falls back to whole-word search and id lists.
 */
export async function fetchDreams(
  filters: DreamFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: Dream[]; count: number }> {
  if (richSearch) {
    const res = await dreamPage(filters, page, pageSize, null)
    if (!res.error) return { rows: (res.data ?? []).map(mapDream), count: res.count ?? 0 }
    if (res.error.code !== '42703') throw res.error
    richSearch = false
  }
  const ids = await dreamIdsForTags(filters.tags, filters.tagMode)
  if (ids !== null && ids.length === 0) return { rows: [], count: 0 }
  const { data, error, count } = await dreamPage(filters, page, pageSize, { ids })
  if (error) throw error
  return { rows: (data ?? []).map(mapDream), count: count ?? 0 }
}

function dreamPage(filters: DreamFilters, page: number, pageSize: number, legacy: { ids: string[] | null } | null) {
  let q = supabase.from(VISIBLE).select(DREAM_SELECT, { count: 'exact' })

  if (filters.from) q = q.gte('date', filters.from)
  if (filters.to) q = q.lte('date', filters.to)
  if (filters.lucidity.length) q = q.in('lucidity', filters.lucidity)
  if (filters.induction.length) q = q.in('induction_method', filters.induction)
  if (filters.favorites) q = q.eq('favorite', true)
  if (!filters.includeNotes) q = q.eq('entry_type', 'dream')

  const term = filters.q.trim()
  if (!legacy) {
    if (filters.tags.length) q = filters.tagMode === 'all' ? q.contains('tag_ids', filters.tags) : q.overlaps('tag_ids', filters.tags)
    // Every word must appear somewhere in the title, text, or tag names
    for (const word of searchTerms(term)) q = q.ilike('search_text', `%${escapeLike(word)}%`)
  } else {
    if (legacy.ids) q = q.in('id', legacy.ids)
    if (term.length >= 3) q = q.textSearch('search_vector', term, { type: 'websearch', config: 'english' })
    else if (term) {
      // Quoted so a comma or bracket in the term can't break the filter
      const safe = term.replace(/["\\]/g, '')
      if (safe) q = q.or(`title.ilike."%${safe}%",description.ilike."%${safe}%"`)
    }
  }

  switch (filters.sort) {
    case 'oldest':
      q = q.order('date', { ascending: true }).order('created_at', { ascending: true })
      break
    case 'title':
      q = q.order('title', { ascending: true })
      break
    default:
      q = q.order('date', { ascending: false }).order('created_at', { ascending: false })
  }

  const from = (page - 1) * pageSize
  return q.range(from, from + pageSize - 1)
}

/** Every row matching the filters, across pages. */
export async function fetchDreamsAll(filters: DreamFilters, pageSize = 200): Promise<Dream[]> {
  const first = await fetchDreams(filters, 1, pageSize)
  if (first.rows.length >= first.count || first.rows.length === 0) return first.rows
  const pages = Math.ceil(first.count / pageSize)
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => fetchDreams(filters, i + 2, pageSize)),
  )
  return [first.rows, ...rest.map((page) => page.rows)].flat()
}

export async function fetchDream(id: string): Promise<Dream | null> {
  const { data, error } = await supabase.from(VISIBLE).select(DREAM_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapDream(data) : null
}

/**
 * Uniform random dream: each of the N dreams has probability 1/N.
 * Two round-trips (count + one-row range) — never loads the full journal.
 * Pass `excludeId` to prefer a different dream when more than one exists.
 */
export async function fetchRandomDream(excludeId?: string): Promise<Dream | null> {
  const { count, error: cErr } = await supabase
    .from(VISIBLE)
    .select('id', { count: 'exact', head: true })
    .eq('entry_type', 'dream')
  if (cErr) throw cErr
  if (!count) return null

  let offset = Math.floor(Math.random() * count)
  let dream = await fetchDreamAtOffset(offset)
  if (excludeId && dream?.id === excludeId && count > 1) {
    offset = (offset + 1 + Math.floor(Math.random() * (count - 1))) % count
    dream = await fetchDreamAtOffset(offset)
  }
  return dream
}

async function fetchDreamAtOffset(offset: number): Promise<Dream | null> {
  const { data, error } = await supabase
    .from(VISIBLE)
    .select(DREAM_SELECT)
    .eq('entry_type', 'dream')
    .order('id', { ascending: true })
    .range(offset, offset)
    .maybeSingle()
  if (error) throw error
  return data ? mapDream(data) : null
}

export async function fetchAllLite(): Promise<DreamLite[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await fetchEvery<any>((from, to) =>
    supabase
      .from(VISIBLE)
      .select('id, date, lucidity, induction_method, entry_type, favorite, dream_tags(tags(id, name))')
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((r: any) => ({
    id: r.id,
    date: r.date,
    lucidity: r.lucidity,
    induction_method: r.induction_method,
    entry_type: r.entry_type,
    favorite: r.favorite,
    tags: (r.dream_tags ?? []).map((dt: { tags: { id: string; name: string } | null }) => dt.tags).filter(Boolean),
  }))
}

/** Unlocked tags only, unless `includeLocked` (Settings, and to keep auto-tag away from locked names). */
export async function fetchTags(includeLocked = false): Promise<Tag[]> {
  let q = supabase.from('tags_with_counts').select('*').order('name', { ascending: true })
  if (!includeLocked) q = q.eq('locked', false)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Tag[]
}

export async function fetchTag(id: string): Promise<Tag | null> {
  const { data, error } = await supabase.from('tags_with_counts').select('*').eq('id', id).eq('locked', false).maybeSingle()
  if (error) throw error
  return (data as Tag | null) ?? null
}

/** Create any tags that don't yet exist (case-insensitive) and return ids for all names. */
export async function ensureTags(names: string[]): Promise<Tag[]> {
  const clean = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
  if (!clean.length) return []
  const { data: existing, error } = await supabase.from('tags').select('id, name, color, locked')
  if (error) throw error
  const byLower = new Map((existing ?? []).map((t) => [t.name.toLowerCase(), t as Tag]))
  const missing = clean.filter((n) => !byLower.has(n.toLowerCase()))
  if (missing.length) {
    const { data: created, error: e2 } = await supabase
      .from('tags')
      .insert(missing.map((name) => ({ name })))
      .select('id, name, color, locked')
    if (e2) throw e2
    for (const t of created ?? []) byLower.set(t.name.toLowerCase(), t as Tag)
  }
  return clean.map((n) => byLower.get(n.toLowerCase())!)
}

async function setDreamTags(dreamId: string, tagIds: string[]) {
  const { error: delErr } = await supabase.from('dream_tags').delete().eq('dream_id', dreamId)
  if (delErr) throw delErr
  if (tagIds.length) {
    const { error } = await supabase.from('dream_tags').insert(tagIds.map((tag_id) => ({ dream_id: dreamId, tag_id })))
    if (error) throw error
  }
}

/**
 * Returns null when a locked tag hides the saved dream.
 * Pass `id` when the save may be retried (offline queue, undo): a row that already exists counts as saved.
 */
export async function createDream(
  input: DreamInput,
  source = 'app',
  id?: string,
  extra?: { created_at?: string },
): Promise<Dream | null> {
  const { tagIds, ...fields } = input
  const row = { ...fields, source, ...(id ? { id } : {}), ...extra }
  const { data, error } = await supabase.from('dreams').insert(row).select('id').single()
  if (error && !(id && error.code === '23505')) throw error
  const dreamId: string = data?.id ?? id!
  await setDreamTags(dreamId, tagIds)
  return fetchDream(dreamId)
}

export type ImportDraft = Omit<DreamInput, 'tagIds'> & { tagNames: string[] }

/** Date + title + body only, for import dedupe. Avoids downloading tags and metadata. */
async function fetchImportKeys(): Promise<Set<string>> {
  const data = await fetchEvery((from, to) =>
    supabase.from('dreams').select('date, title, description').order('id', { ascending: true }).range(from, to),
  )
  return new Set(data.map((d) => `${d.date}\n${d.title}\n${d.description}`))
}

export async function importEntries(rows: ImportDraft[]): Promise<{ created: number; skipped: number }> {
  if (!rows.length) return { created: 0, skipped: 0 }
  const seen = await fetchImportKeys()
  let created = 0
  let skipped = 0
  for (const row of rows) {
    const key = `${row.date}\n${row.title}\n${row.description}`
    if (seen.has(key)) {
      skipped++
      continue
    }
    const tags = await ensureTags(row.tagNames)
    await createDream({
      date: row.date,
      title: row.title,
      description: row.description,
      lucidity: row.lucidity,
      induction_method: row.induction_method,
      induction_notes: row.induction_notes,
      entry_type: row.entry_type,
      favorite: row.favorite,
      tagIds: tags.map((t) => t.id),
    }, 'import')
    seen.add(key)
    created++
  }
  return { created, skipped }
}

/** Returns null when a locked tag hides the saved dream. */
export async function updateDream(id: string, input: DreamInput): Promise<Dream | null> {
  const { tagIds, ...fields } = input
  const { error } = await supabase.from('dreams').update(fields).eq('id', id)
  if (error) throw error
  await setDreamTags(id, tagIds)
  return fetchDream(id)
}

export async function deleteDream(id: string): Promise<void> {
  const { error } = await supabase.from('dreams').delete().eq('id', id)
  if (error) throw error
}

export async function deleteDreams(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase.from('dreams').delete().in('id', ids)
  if (error) throw error
}

/** Put a deleted dream back exactly as it was: same id, tags, and original date added. */
export async function restoreDream(d: Dream): Promise<void> {
  await createDream(
    {
      date: d.date,
      title: d.title,
      description: d.description,
      lucidity: d.lucidity,
      induction_method: d.induction_method,
      induction_notes: d.induction_notes,
      entry_type: d.entry_type,
      favorite: d.favorite,
      tagIds: d.tags.map((t) => t.id),
    },
    d.source,
    d.id,
    { created_at: d.created_at },
  )
}

export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  const { error } = await supabase.from('dreams').update({ favorite }).eq('id', id)
  if (error) throw error
}

export async function renameTag(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('tags').update({ name }).eq('id', id)
  if (error) throw error
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw error
}

export async function setTagColor(id: string, color: string | null): Promise<void> {
  const { error } = await supabase.from('tags').update({ color }).eq('id', id)
  if (error) throw error
}

export async function setTagLocked(id: string, locked: boolean): Promise<void> {
  const { error } = await supabase.from('tags').update({ locked }).eq('id', id)
  if (error) throw error
}

/** Move every dream from `fromId` onto `intoId`, then delete `fromId`. */
export async function mergeTags(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) return
  const data = await fetchEvery((from, to) =>
    supabase.from('dream_tags').select('dream_id').eq('tag_id', fromId).order('dream_id').range(from, to),
  )
  const ids = Array.from(new Set(data.map((r) => r.dream_id)))
  await appendDreamTags(ids.map((dream_id) => ({ dream_id, tag_id: intoId })))
  const { error: delErr } = await supabase.from('tags').delete().eq('id', fromId)
  if (delErr) throw delErr
}

/** Other dreams that share the most tags with this one, newest first among ties. */
export async function fetchRelatedDreams(
  dreamId: string,
  tagIds: string[],
  limit = 6,
): Promise<{ dream: Dream; shared: Tag[] }[]> {
  if (!tagIds.length) return []
  const { data, error } = await supabase
    .from('dream_tags')
    .select('dream_id, tags(id, name, color)')
    .in('tag_id', tagIds)
    .neq('dream_id', dreamId)
  if (error) throw error

  const byDream = new Map<string, Tag[]>()
  for (const r of data ?? []) {
    const raw = r.tags as Tag | Tag[] | null
    const tag = Array.isArray(raw) ? raw[0] : raw
    if (!tag) continue
    const list = byDream.get(r.dream_id) ?? []
    if (!list.some((t) => t.id === tag.id)) list.push(tag)
    byDream.set(r.dream_id, list)
  }
  const ranked = [...byDream.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, limit * 3)
  if (!ranked.length) return []

  const { data: rows, error: e2 } = await supabase
    .from(VISIBLE)
    .select(DREAM_SELECT)
    .in('id', ranked.map(([id]) => id))
    .eq('entry_type', 'dream')
  if (e2) throw e2

  const mapped = new Map((rows ?? []).map((r) => [r.id as string, mapDream(r)]))
  const dateOf = (id: string) => mapped.get(id)?.date ?? ''
  return ranked
    .filter(([id]) => mapped.has(id))
    .sort((a, b) => b[1].length - a[1].length || dateOf(b[0]).localeCompare(dateOf(a[0])))
    .slice(0, limit)
    .map(([id, shared]) => ({ dream: mapped.get(id)!, shared }))
}

/** Title and body of every visible entry, for phrase tagging. Paged past the API row cap. */
export async function fetchDreamTexts(): Promise<{ id: string; title: string; description: string }[]> {
  return fetchEvery((from, to) =>
    supabase.from(VISIBLE).select('id, title, description').order('id', { ascending: true }).range(from, to),
  )
}

/** Add tags without replacing ones already on the dream. */
export async function appendDreamTags(rows: { dream_id: string; tag_id: string }[]): Promise<void> {
  const seen = new Set<string>()
  const unique = rows.filter((r) => {
    const k = `${r.dream_id}:${r.tag_id}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  for (let i = 0; i < unique.length; i += 150) {
    const chunk = unique.slice(i, i + 150)
    const { error } = await supabase
      .from('dream_tags')
      .upsert(chunk, { onConflict: 'dream_id,tag_id', ignoreDuplicates: true })
    if (error) throw error
  }
}

export interface ProfileRow {
  settings: Record<string, unknown>
  stats: Record<string, unknown>
}

export async function fetchProfile(): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles').select('settings, stats').maybeSingle()
  if (error) throw error
  return (data as ProfileRow | null) ?? null
}

export async function saveProfile(patch: { settings?: unknown; stats?: unknown }): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData.session?.user.id
  if (!uid) return
  const { error } = await supabase.from('profiles').upsert({
    id: uid,
    ...patch,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

/** Everything, for export. */
export async function fetchAllFull(): Promise<Dream[]> {
  const data = await fetchEvery((from, to) =>
    supabase.from(VISIBLE).select(DREAM_SELECT).order('date', { ascending: true }).order('id', { ascending: true }).range(from, to),
  )
  return data.map(mapDream)
}
