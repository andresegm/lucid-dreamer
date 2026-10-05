import { format, parseISO, isValid } from 'date-fns'
import type { Lucidity } from './types'

/** Calendar date (`YYYY-MM-DD`) as local midnight — avoids UTC day shifts from `parseISO`. */
export function parseLocalISO(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  return parseISO(iso)
}

export function fmtDate(iso: string, pattern = 'EEE, MMM d, yyyy'): string {
  const d = parseLocalISO(iso)
  return isValid(d) ? format(d, pattern) : iso
}

/** Inclusive streak / span label, compact when start and end share a month or year. */
export function fmtDateRange(start: string, end: string): string {
  if (start === end) return fmtDate(start, 'MMM d, yyyy')
  const a = parseLocalISO(start)
  const b = parseLocalISO(end)
  if (!isValid(a) || !isValid(b)) return `${start} – ${end}`
  if (a.getFullYear() === b.getFullYear()) {
    if (a.getMonth() === b.getMonth()) return `${format(a, 'MMM d')}–${format(b, 'd, yyyy')}`
    return `${format(a, 'MMM d')} – ${format(b, 'MMM d, yyyy')}`
  }
  return `${format(a, 'MMM d, yyyy')} – ${format(b, 'MMM d, yyyy')}`
}

export function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function lucidityClass(l: Lucidity): string {
  return l === 'lucid' ? 'pill-lucid' : l === 'semi-lucid' ? 'pill-semi' : 'pill-nonlucid'
}

export function lucidityLabel(l: Lucidity): string {
  return l === 'lucid' ? 'Lucid' : l === 'semi-lucid' ? 'Semi-lucid' : 'Non-lucid'
}

export function excerpt(text: string, max = 220): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max).trimEnd() + '…' : t
}

export function wordCount(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/** First line, trimmed to a short title for morning-capture saves. */
export function titleFromDump(text: string): string {
  const first = text.trim().split(/\n/)[0]?.replace(/\s+/g, ' ').trim() ?? ''
  if (!first) return 'Untitled dream'
  if (first.length <= 56) return first
  const words = first.split(' ')
  const cut = words.slice(0, 8).join(' ')
  return (cut.length < first.length ? cut : first.slice(0, 56)).replace(/[.,;:]+$/, '') + '…'
}

export const TAG_COLOR_PRESETS = ['#7c6cf6', '#5b7cfa', '#38bdf8', '#34d399', '#f6b26c', '#fb7185', '#e879f9', '#94a3b8']

export function tagChipStyle(color: string | null | undefined): { borderColor: string; background: string; color: string } | undefined {
  if (!color) return undefined
  return {
    borderColor: color,
    background: `color-mix(in srgb, ${color} 18%, transparent)`,
    color,
  }
}
