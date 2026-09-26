import { parse, isValid } from 'date-fns'
import type { EntryType, Lucidity } from './types'
import type { ImportDraft } from './api'

const LUCID: Lucidity[] = ['non-lucid', 'semi-lucid', 'lucid']

function asLucidity(v: unknown): Lucidity {
  const s = String(v ?? '').toLowerCase()
  if (s === 'lucid') return 'lucid'
  if (s === 'semi-lucid' || s === 'semi') return 'semi-lucid'
  return 'non-lucid'
}

function asEntry(v: unknown): EntryType {
  return String(v ?? '').toLowerCase() === 'note' ? 'note' : 'dream'
}

function asDate(v: unknown): string | null {
  const s = String(v ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  for (const pat of ['dd.MM.yyyy', 'd.M.yyyy', 'MM/dd/yyyy', 'yyyy/MM/dd']) {
    const d = parse(s, pat, new Date())
    if (isValid(d)) {
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${d.getFullYear()}-${m}-${day}`
    }
  }
  return null
}

function draft(partial: Partial<ImportDraft> & { date: string }): ImportDraft {
  return {
    date: partial.date,
    title: (partial.title ?? '').trim() || 'Untitled',
    description: partial.description ?? '',
    lucidity: partial.lucidity && LUCID.includes(partial.lucidity) ? partial.lucidity : 'non-lucid',
    induction_method: partial.induction_method || null,
    induction_notes: partial.induction_notes || null,
    entry_type: partial.entry_type ?? 'dream',
    favorite: Boolean(partial.favorite),
    tagNames: partial.tagNames ?? [],
  }
}

function parseJson(text: string): ImportDraft[] {
  const raw = JSON.parse(text) as unknown
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { dreams?: unknown }).dreams)
    ? (raw as { dreams: unknown[] }).dreams
    : null
  if (!rows) throw new Error('JSON should be a list of dreams.')
  const out: ImportDraft[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const date = asDate(r.date)
    if (!date) continue
    const tags = Array.isArray(r.tags)
      ? r.tags.map((t) => (typeof t === 'string' ? t : (t as { name?: string })?.name ?? '')).filter(Boolean)
      : String(r.tags ?? '').split(/[;,]/).map((t) => t.trim()).filter(Boolean)
    out.push(draft({
      date,
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
      lucidity: asLucidity(r.lucidity),
      induction_method: r.induction_method ? String(r.induction_method) : null,
      induction_notes: r.induction_notes ? String(r.induction_notes) : null,
      entry_type: asEntry(r.entry_type),
      favorite: r.favorite === true || r.favorite === 'true',
      tagNames: tags,
    }))
  }
  return out
}

function parseCsv(text: string): ImportDraft[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.length)
  if (lines.length < 2) return []
  const cells = (line: string) => {
    const out: string[] = []
    let cur = '', q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++ }
        else q = !q
      } else if (c === ',' && !q) { out.push(cur); cur = '' }
      else cur += c
    }
    out.push(cur)
    return out
  }
  const head = cells(lines[0]).map((h) => h.trim().toLowerCase())
  const idx = (name: string) => head.indexOf(name)
  const out: ImportDraft[] = []
  for (const line of lines.slice(1)) {
    const cols = cells(line)
    const date = asDate(cols[idx('date')] ?? cols[0])
    if (!date) continue
    const tags = (cols[idx('tags')] ?? '').split(/[;,]/).map((t) => t.trim()).filter(Boolean)
    out.push(draft({
      date,
      title: cols[idx('title')] ?? '',
      description: cols[idx('description')] ?? '',
      lucidity: asLucidity(cols[idx('lucidity')]),
      induction_method: cols[idx('induction_method')] || null,
      induction_notes: cols[idx('induction_notes')] || null,
      entry_type: asEntry(cols[idx('entry_type')]),
      favorite: /^(1|true|yes|★)$/i.test(cols[idx('favorite')] ?? ''),
      tagNames: tags,
    }))
  }
  return out
}

function parseTxt(text: string): ImportDraft[] {
  const chunks = text.split(/\n-{10,}\n/).map((c) => c.trim()).filter(Boolean)
  const out: ImportDraft[] = []
  for (const chunk of chunks) {
    const lines = chunk.split('\n')
    const head = lines[0] ?? ''
    const m = head.match(/^(\d{1,2}\.\d{1,2}\.\d{4})\s+\|\s+(.+?)\s+\(([^)]+)\)( ★)?$/)
    const date = asDate(m?.[1] ?? '')
    if (!date || !m) continue
    let tags: string[] = []
    let bodyStart = 2
    if (lines[1]?.startsWith('Tags:')) {
      tags = lines[1].slice(5).split(',').map((t) => t.trim()).filter(Boolean)
      bodyStart = 3
    }
    const meta = m[3]
    const isNote = /note/i.test(meta)
    const lucidity = asLucidity(meta)
    const induction = meta.split('·')[1]?.trim() || null
    out.push(draft({
      date,
      title: m[2].trim(),
      description: lines.slice(bodyStart).join('\n').trim(),
      lucidity: isNote ? 'non-lucid' : lucidity,
      induction_method: isNote ? null : induction,
      entry_type: isNote ? 'note' : 'dream',
      favorite: Boolean(m[4]),
      tagNames: tags,
    }))
  }
  return out
}

export function parseImport(filename: string, text: string): ImportDraft[] {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{')) return parseJson(text)
  if (lower.endsWith('.csv') || (text.includes(',') && text.toLowerCase().includes('date'))) return parseCsv(text)
  return parseTxt(text)
}
