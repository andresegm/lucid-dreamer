import { supabase } from './supabase'
import { todayISO } from './format'
import type { RecallContext } from './recallTips'
import type { Dream, DreamFilters, DreamInput, DreamLite, Tag } from './types'

const DREAM_SELECT = '*, dream_tags(tags(id, name, color))'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDream(row: any): Dream {
  const tags: Tag[] = (row.dream_tags ?? [])
    .map((dt: { tags: Tag | null }) => dt.tags)
    .filter(Boolean)
    .sort((a: Tag, b: Tag) => a.name.localeCompare(b.name))
  const { dream_tags: _omit, search_vector: _omit2, ...rest } = row
  void _omit; void _omit2
  return { ...rest, tags } as Dream
}

/** Resolve tag filters to a set of dream ids (or null when no tag filter is active). */
async function dreamIdsForTags(tagIds: string[], mode: 'any' | 'all'): Promise<string[] | null> {
  if (tagIds.length === 0) return null
  const { data, error } = await supabase.from('dream_tags').select('dream_id, tag_id').in('tag_id', tagIds)
  if (error) throw error
  if (mode === 'any') return Array.from(new Set(data.map((r) => r.dream_id)))
  const counts = new Map<string, number>()
  for (const r of data) counts.set(r.dream_id, (counts.get(r.dream_id) ?? 0) + 1)
  return Array.from(counts.entries()).filter(([, n]) => n >= tagIds.length).map(([id]) => id)
}

export async function fetchDreams(
  filters: DreamFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: Dream[]; count: number }> {
  const ids = await dreamIdsForTags(filters.tags, filters.tagMode)
  if (ids !== null && ids.length === 0) return { rows: [], count: 0 }

  let q = supabase.from('dreams').select(DREAM_SELECT, { count: 'exact' })

  if (ids) q = q.in('id', ids)
  if (filters.from) q = q.gte('date', filters.from)
  if (filters.to) q = q.lte('date', filters.to)
  if (filters.lucidity.length) q = q.in('lucidity', filters.lucidity)
  if (filters.induction.length) q = q.in('induction_method', filters.induction)
  if (filters.favorites) q = q.eq('favorite', true)
  if (!filters.includeNotes) q = q.eq('entry_type', 'dream')
  if (filters.q.trim()) {
    const term = filters.q.trim()
    // Full-text for multi-word / natural queries, fallback ilike for very short input
    if (term.length >= 3) q = q.textSearch('search_vector', term, { type: 'websearch', config: 'english' })
    else q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
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
  q = q.range(from, from + pageSize - 1)

  const { data, error, count } = await q
  if (error) throw error
  return { rows: (data ?? []).map(mapDream), count: count ?? 0 }
}

export async function fetchDream(id: string): Promise<Dream | null> {
  const { data, error } = await supabase.from('dreams').select(DREAM_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapDream(data) : null
}

export async function fetchAllLite(): Promise<DreamLite[]> {
  const { data, error } = await supabase
    .from('dreams')
    .select('id, date, lucidity, induction_method, entry_type, favorite, dream_tags(tags(id, name))')
    .order('date', { ascending: true })
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    date: r.date,
    lucidity: r.lucidity,
    induction_method: r.induction_method,
    entry_type: r.entry_type,
    favorite: r.favorite,
    tags: (r.dream_tags ?? []).map((dt: { tags: { id: string; name: string } | null }) => dt.tags).filter(Boolean),
  }))
}

/** Enough context to pick a morning recall cue without loading every dream. */
export async function fetchRecallContext(): Promise<RecallContext> {
  const today = todayISO()
  const [{ count, error: cErr }, { data, error: dErr }] = await Promise.all([
    supabase.from('dreams').select('id', { count: 'exact', head: true }).eq('date', today),
    supabase.from('dreams').select('date, lucidity').eq('entry_type', 'dream').order('date', { ascending: false }).limit(30),
  ])
  if (cErr) throw cErr
  if (dErr) throw dErr
  const rows = data ?? []
  return {
    todayCount: count ?? 0,
    lastDate: rows[0]?.date ?? null,
    recentCount: rows.length,
    recentLucid: rows.filter((r) => r.lucidity !== 'non-lucid').length,
  }
}

export async function fetchTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags_with_counts').select('*').order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Tag[]
}

/** Create any tags that don't yet exist (case-insensitive) and return ids for all names. */
export async function ensureTags(names: string[]): Promise<Tag[]> {
  const clean = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)))
  if (!clean.length) return []
  const { data: existing, error } = await supabase.from('tags').select('id, name, color')
  if (error) throw error
  const byLower = new Map((existing ?? []).map((t) => [t.name.toLowerCase(), t as Tag]))
  const missing = clean.filter((n) => !byLower.has(n.toLowerCase()))
  if (missing.length) {
    const { data: created, error: e2 } = await supabase
      .from('tags')
      .insert(missing.map((name) => ({ name })))
      .select('id, name, color')
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

export async function createDream(input: DreamInput): Promise<Dream> {
  const { tagIds, ...fields } = input
  const { data, error } = await supabase.from('dreams').insert({ ...fields, source: 'app' }).select('id').single()
  if (error) throw error
  await setDreamTags(data.id, tagIds)
  return (await fetchDream(data.id))!
}

export async function updateDream(id: string, input: DreamInput): Promise<Dream> {
  const { tagIds, ...fields } = input
  const { error } = await supabase.from('dreams').update(fields).eq('id', id)
  if (error) throw error
  await setDreamTags(id, tagIds)
  return (await fetchDream(id))!
}

export async function deleteDream(id: string): Promise<void> {
  const { error } = await supabase.from('dreams').delete().eq('id', id)
  if (error) throw error
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

/** Move every dream from `fromId` onto `intoId`, then delete `fromId`. */
export async function mergeTags(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) return
  const { data, error } = await supabase.from('dream_tags').select('dream_id').eq('tag_id', fromId)
  if (error) throw error
  const ids = Array.from(new Set((data ?? []).map((r) => r.dream_id)))
  if (ids.length) {
    const { error: insErr } = await supabase
      .from('dream_tags')
      .upsert(ids.map((dream_id) => ({ dream_id, tag_id: intoId })), { onConflict: 'dream_id,tag_id', ignoreDuplicates: true })
    if (insErr) throw insErr
  }
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
    .from('dreams')
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

/** Everything, for export. */
export async function fetchAllFull(): Promise<Dream[]> {
  const { data, error } = await supabase.from('dreams').select(DREAM_SELECT).order('date', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapDream)
}
