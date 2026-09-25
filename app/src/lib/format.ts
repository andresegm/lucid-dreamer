import { format, parseISO, isValid } from 'date-fns'
import type { Lucidity } from './types'

export function fmtDate(iso: string, pattern = 'EEE, MMM d, yyyy'): string {
  const d = parseISO(iso)
  return isValid(d) ? format(d, pattern) : iso
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

export function pluralize(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`
}
