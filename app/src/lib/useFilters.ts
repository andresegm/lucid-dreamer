import { useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { DreamFilters, Lucidity, SortOrder } from './types'

/** Filters + page live in the URL so back/forward and refresh keep state. */
export function useFilters(defaultSort: SortOrder, defaultIncludeNotes: boolean) {
  const [sp, setSp] = useSearchParams()

  const filters = useMemo<DreamFilters>(() => {
    const list = (k: string) => (sp.get(k) ? sp.get(k)!.split(',').filter(Boolean) : [])
    return {
      q: sp.get('q') ?? '',
      from: sp.get('from') || null,
      to: sp.get('to') || null,
      lucidity: list('luc') as Lucidity[],
      induction: list('ind'),
      tags: list('tags'),
      tagMode: (sp.get('tm') as 'any' | 'all') || 'any',
      favorites: sp.get('fav') === '1',
      includeNotes: sp.has('notes') ? sp.get('notes') === '1' : defaultIncludeNotes,
      sort: (sp.get('sort') as SortOrder) || defaultSort,
    }
  }, [sp, defaultSort, defaultIncludeNotes])

  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10) || 1)
  // Patches in the same turn (a date blur plus a tag click) must see each other.
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const pageRef = useRef(page)
  pageRef.current = page

  const setFilters = useCallback(
    (patch: Partial<DreamFilters>, resetPage = true) => {
      const next = { ...filtersRef.current, ...patch }
      filtersRef.current = next
      const p = new URLSearchParams()
      if (next.q) p.set('q', next.q)
      if (next.from) p.set('from', next.from)
      if (next.to) p.set('to', next.to)
      if (next.lucidity.length) p.set('luc', next.lucidity.join(','))
      if (next.induction.length) p.set('ind', next.induction.join(','))
      if (next.tags.length) p.set('tags', next.tags.join(','))
      if (next.tagMode !== 'any') p.set('tm', next.tagMode)
      if (next.favorites) p.set('fav', '1')
      if (next.includeNotes !== defaultIncludeNotes) p.set('notes', next.includeNotes ? '1' : '0')
      if (next.sort !== defaultSort) p.set('sort', next.sort)
      if (!resetPage && pageRef.current > 1) p.set('page', String(pageRef.current))
      setSp(p, { replace: false })
    },
    [setSp, defaultSort, defaultIncludeNotes],
  )

  const setPage = useCallback(
    (n: number) => {
      const p = new URLSearchParams(sp)
      if (n <= 1) p.delete('page')
      else p.set('page', String(n))
      setSp(p)
    },
    [sp, setSp],
  )

  const clear = useCallback(() => setSp(new URLSearchParams()), [setSp])

  const activeCount =
    (filters.q ? 1 : 0) +
    (filters.from || filters.to ? 1 : 0) +
    filters.lucidity.length +
    filters.induction.length +
    filters.tags.length +
    (filters.favorites ? 1 : 0) +
    (filters.includeNotes !== defaultIncludeNotes ? 1 : 0)

  return { filters, page, setFilters, setPage, clear, activeCount }
}
