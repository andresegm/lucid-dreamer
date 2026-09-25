import { differenceInCalendarDays, format, parseISO, startOfMonth, startOfYear, subDays } from 'date-fns'
import type { DreamLite, Lucidity } from './types'

export type Range = 'all' | '1y' | '6m' | '3m' | '30d'
export type Granularity = 'month' | 'year'

export function rangeStart(r: Range, now = new Date()): Date | null {
  switch (r) {
    case '30d': return subDays(now, 30)
    case '3m': return subDays(now, 91)
    case '6m': return subDays(now, 182)
    case '1y': return subDays(now, 365)
    default: return null
  }
}

export interface StatsInput {
  dreams: DreamLite[]
  range: Range
  includeNotes: boolean
  series: Record<Lucidity, boolean>
}

export interface Streaks { current: number; longest: number; lastEntry: string | null }

export function computeStreaks(dates: string[], today = new Date()): Streaks {
  const days = Array.from(new Set(dates)).sort()
  if (!days.length) return { current: 0, longest: 0, lastEntry: null }
  let longest = 1, run = 1
  for (let i = 1; i < days.length; i++) {
    const gap = differenceInCalendarDays(parseISO(days[i]), parseISO(days[i - 1]))
    run = gap === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  const last = parseISO(days[days.length - 1])
  const sinceLast = differenceInCalendarDays(today, last)
  let current = 0
  if (sinceLast <= 1) {
    current = 1
    for (let i = days.length - 1; i > 0; i--) {
      if (differenceInCalendarDays(parseISO(days[i]), parseISO(days[i - 1])) === 1) current++
      else break
    }
  }
  return { current, longest, lastEntry: days[days.length - 1] }
}

export function computeStats({ dreams, range, includeNotes, series }: StatsInput) {
  const start = rangeStart(range)
  const inRange = dreams.filter((d) => (includeNotes || d.entry_type === 'dream') && (!start || parseISO(d.date) >= start))
  const onlyDreams = inRange.filter((d) => d.entry_type === 'dream')
  const shown = onlyDreams.filter((d) => series[d.lucidity])

  const byLucidity: Record<Lucidity, number> = { 'non-lucid': 0, 'semi-lucid': 0, lucid: 0 }
  for (const d of onlyDreams) byLucidity[d.lucidity]++
  const lucidCount = byLucidity.lucid + byLucidity['semi-lucid']

  const induction = new Map<string, number>()
  for (const d of onlyDreams) if (d.lucidity !== 'non-lucid') induction.set(d.induction_method ?? 'Unspecified', (induction.get(d.induction_method ?? 'Unspecified') ?? 0) + 1)

  // span → choose granularity
  const first = shown.length ? parseISO(shown[0].date) : null
  const last = shown.length ? parseISO(shown[shown.length - 1].date) : null
  const spanDays = first && last ? differenceInCalendarDays(last, first) : 0
  const autoGranularity: Granularity = spanDays > 365 * 3 ? 'year' : 'month'

  const weekday = Array.from({ length: 7 }, (_, i) => ({ label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i], total: 0, lucid: 0 }))
  for (const d of shown) {
    const w = parseISO(d.date).getDay()
    weekday[w].total++
    if (d.lucidity !== 'non-lucid') weekday[w].lucid++
  }

  const tagCounts = new Map<string, { id: string; name: string; n: number; lucid: number }>()
  for (const d of shown) for (const t of d.tags) {
    const e = tagCounts.get(t.id) ?? { id: t.id, name: t.name, n: 0, lucid: 0 }
    e.n++
    if (d.lucidity !== 'non-lucid') e.lucid++
    tagCounts.set(t.id, e)
  }
  const topTags = Array.from(tagCounts.values()).sort((a, b) => b.n - a.n).slice(0, 10)
  const pairs = tagPairs(shown, shown.length >= 80 ? 3 : 2, 12)

  const streaks = computeStreaks(inRange.map((d) => d.date))

  // words/week style rate: entries per week over the covered span
  const covered = first && last ? Math.max(7, differenceInCalendarDays(new Date(), start ?? first) + 1) : 0
  const perWeek = covered ? (onlyDreams.length / covered) * 7 : 0

  // best month
  const monthCounts = new Map<string, number>()
  for (const d of onlyDreams) monthCounts.set(d.date.slice(0, 7), (monthCounts.get(d.date.slice(0, 7)) ?? 0) + 1)
  const bestMonth = Array.from(monthCounts.entries()).sort((a, b) => b[1] - a[1])[0] ?? null

  return { inRange, onlyDreams, shown, byLucidity, lucidCount, induction, autoGranularity, weekday, topTags, pairs, streaks, perWeek, bestMonth, favorites: onlyDreams.filter((d) => d.favorite).length }
}

export interface TagPair {
  a: { id: string; name: string }
  b: { id: string; name: string }
  together: number
  lift: number
}

/** Pairs that show up together more often than chance. Lift 2 = twice the independent rate. */
export function tagPairs(shown: DreamLite[], minTogether = 3, limit = 12): TagPair[] {
  const n = shown.length
  if (n < 8) return []
  const counts = new Map<string, { id: string; name: string; n: number }>()
  const together = new Map<string, number>()

  for (const d of shown) {
    const seen = new Set<string>()
    const tags = d.tags.filter((t) => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
    for (const t of tags) {
      const e = counts.get(t.id) ?? { id: t.id, name: t.name, n: 0 }
      e.n++
      counts.set(t.id, e)
    }
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const [x, y] = tags[i].id < tags[j].id ? [tags[i], tags[j]] : [tags[j], tags[i]]
        const key = `${x.id}|${y.id}`
        together.set(key, (together.get(key) ?? 0) + 1)
      }
    }
  }

  const out: TagPair[] = []
  for (const [key, both] of together) {
    if (both < minTogether) continue
    const [idA, idB] = key.split('|')
    const a = counts.get(idA)
    const b = counts.get(idB)
    if (!a || !b) continue
    const lift = (both * n) / (a.n * b.n)
    if (lift < 1.25) continue
    out.push({ a: { id: a.id, name: a.name }, b: { id: b.id, name: b.name }, together: both, lift })
  }
  return out.sort((x, y) => y.lift - x.lift || y.together - x.together).slice(0, limit)
}

export function trendSeries(shown: DreamLite[], granularity: Granularity, range: Range) {
  // Build continuous buckets from start → now so gaps show as zeros
  const start = rangeStart(range) ?? (shown.length ? parseISO(shown[0].date) : new Date())
  const buckets = new Map<string, { label: string; lucid: number; semi: number; non: number }>()
  const now = new Date()
  const cursor = granularity === 'year' ? startOfYear(start) : startOfMonth(start)
  const key = (d: Date) => (granularity === 'year' ? format(d, 'yyyy') : format(d, 'yyyy-MM'))
  const label = (d: Date) => (granularity === 'year' ? format(d, 'yyyy') : format(d, 'MMM yy'))
  const c = new Date(cursor)
  let guard = 0
  while (c <= now && guard++ < 600) {
    buckets.set(key(c), { label: label(c), lucid: 0, semi: 0, non: 0 })
    if (granularity === 'year') c.setFullYear(c.getFullYear() + 1)
    else c.setMonth(c.getMonth() + 1)
  }
  for (const d of shown) {
    const k = key(parseISO(d.date))
    const b = buckets.get(k)
    if (!b) continue
    if (d.lucidity === 'lucid') b.lucid++
    else if (d.lucidity === 'semi-lucid') b.semi++
    else b.non++
  }
  return Array.from(buckets.values())
}
