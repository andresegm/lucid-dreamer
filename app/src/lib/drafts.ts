const LEGACY_DRAFT: Record<'capture' | 'new', string> = {
  capture: 'ldj.draft.capture',
  new: 'ldj.draft.new',
}

const DRAFT_EVENT = 'ldj-draft'

export type CaptureDraft = {
  text: string
  date: string
  emotions: Record<string, boolean>
  updatedAt: number
}

/** Fields shared by the full form. `updatedAt` is storage-only. */
export type DreamFormDraft = {
  date?: string
  title?: string
  description?: string
  lucidity?: string
  induction_method?: string
  induction_custom?: string
  induction_notes?: string
  entry_type?: string
  favorite?: boolean
  tags?: string[]
  updatedAt?: number
}

export type OpenDraft = {
  to: string
  preview: string
  updatedAt: number
}

export function draftKey(userId: string, kind: 'capture' | 'new') {
  return `ldj.draft.${kind}.${userId}`
}

function editKey(userId: string, dreamId: string) {
  return `ldj.draft.edit.${userId}.${dreamId}`
}

function readRaw(userId: string, kind: 'capture' | 'new'): string | null {
  const key = draftKey(userId, kind)
  try {
    const current = localStorage.getItem(key)
    if (current != null) return current
    const legacy = localStorage.getItem(LEGACY_DRAFT[kind])
    if (legacy == null) return null
    localStorage.setItem(key, legacy)
    localStorage.removeItem(LEGACY_DRAFT[kind])
    return legacy
  } catch {
    return null
  }
}

function commit(key: string, raw: string | null, notify: boolean) {
  try {
    const prev = localStorage.getItem(key)
    if (raw == null) {
      if (prev == null) return
      localStorage.removeItem(key)
    } else if (prev === raw) {
      return
    } else {
      localStorage.setItem(key, raw)
    }
    if (notify) window.dispatchEvent(new Event(DRAFT_EVENT))
  } catch {
    /* private mode / quota */
  }
}

export function subscribeDrafts(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key == null || e.key.startsWith('ldj.draft.')) onChange()
  }
  window.addEventListener(DRAFT_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(DRAFT_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function readEmotions(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'boolean') out[k] = v
  }
  return out
}

export function readCapture(userId: string): CaptureDraft | null {
  const raw = readRaw(userId, 'capture')
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CaptureDraft>
    if (parsed && typeof parsed.text === 'string') {
      if (!parsed.text.trim()) return null
      return {
        text: parsed.text,
        date: typeof parsed.date === 'string' ? parsed.date : '',
        emotions: readEmotions(parsed.emotions),
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      }
    }
  } catch {
    /* older drafts stored the dump as plain text */
  }
  return { text: raw, date: '', emotions: {}, updatedAt: 0 }
}

export function writeCapture(
  userId: string,
  draft: { text: string; date: string; emotions: Record<string, boolean> } | null,
) {
  const key = draftKey(userId, 'capture')
  const prev = readCapture(userId)
  if (!draft?.text.trim()) {
    commit(key, null, prev != null)
    return
  }
  const same = prev != null
    && prev.text === draft.text
    && prev.date === draft.date
    && JSON.stringify(prev.emotions) === JSON.stringify(draft.emotions)
  if (same) return
  commit(key, JSON.stringify({ ...draft, updatedAt: Date.now() }), prev == null)
}

function parseForm(raw: string | null): DreamFormDraft | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as DreamFormDraft
  } catch {
    return null
  }
}

/** Blank new-dream defaults don't count. Lucidity or a method does — Learn is one tap away from those. */
export function formDraftOpen(form: DreamFormDraft): boolean {
  return Boolean(
    form.title?.trim()
    || form.description?.trim()
    || (form.tags && form.tags.length > 0)
    || form.induction_method
    || form.induction_custom?.trim()
    || form.induction_notes?.trim()
    || form.favorite
    || (form.lucidity && form.lucidity !== 'non-lucid')
    || (form.entry_type && form.entry_type !== 'dream'),
  )
}

function formPayload(form: DreamFormDraft): string {
  return JSON.stringify({
    date: form.date ?? '',
    title: form.title ?? '',
    description: form.description ?? '',
    lucidity: form.lucidity ?? 'non-lucid',
    induction_method: form.induction_method ?? '',
    induction_custom: form.induction_custom ?? '',
    induction_notes: form.induction_notes ?? '',
    entry_type: form.entry_type ?? 'dream',
    favorite: !!form.favorite,
    tags: form.tags ?? [],
  })
}

function clip(text: string): string {
  const line = text.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  if (line.length <= 72) return line
  return `${line.slice(0, 72).trimEnd()}…`
}

export function formDraftPreview(form: DreamFormDraft): string {
  const title = form.title?.trim()
  if (title) return clip(title)
  const description = form.description?.trim()
  if (description) return clip(description)
  if (form.lucidity === 'lucid') return 'Lucid dream'
  if (form.lucidity === 'semi-lucid') return 'Semi-lucid dream'
  if (form.induction_method && form.induction_method !== 'other') return form.induction_method
  if (form.induction_custom?.trim()) return clip(form.induction_custom)
  if (form.tags && form.tags.length > 0) return form.tags.slice(0, 3).join(', ')
  if (form.entry_type === 'note') return 'Note'
  return 'Unfinished dream'
}

function writeFormAt(key: string, prev: DreamFormDraft | null, form: DreamFormDraft | null) {
  const wasOpen = prev != null && formDraftOpen(prev)
  if (!form || !formDraftOpen(form)) {
    commit(key, null, wasOpen)
    return
  }
  if (wasOpen && prev && formPayload(prev) === formPayload(form)) return
  commit(key, JSON.stringify({ ...form, updatedAt: Date.now() }), !wasOpen)
}

export function readFormDraft(userId: string): DreamFormDraft | null {
  return parseForm(readRaw(userId, 'new'))
}

export function writeFormDraft(userId: string, form: DreamFormDraft | null) {
  writeFormAt(draftKey(userId, 'new'), readFormDraft(userId), form)
}

export function readEditDraft(userId: string, dreamId: string): DreamFormDraft | null {
  try {
    return parseForm(localStorage.getItem(editKey(userId, dreamId)))
  } catch {
    return null
  }
}

export function writeEditDraft(userId: string, dreamId: string, form: DreamFormDraft | null) {
  writeFormAt(editKey(userId, dreamId), readEditDraft(userId, dreamId), form)
}

function listEditDrafts(userId: string): OpenDraft[] {
  const prefix = `ldj.draft.edit.${userId}.`
  const out: OpenDraft[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(prefix)) continue
      const dreamId = key.slice(prefix.length)
      if (!dreamId) continue
      const form = parseForm(localStorage.getItem(key))
      if (!form || !formDraftOpen(form)) continue
      out.push({
        to: `/dream/${dreamId}/edit`,
        preview: formDraftPreview(form),
        updatedAt: form.updatedAt ?? 0,
      })
    }
  } catch {
    /* ignore */
  }
  return out
}

/** The draft touched most recently. The bubble sends the writer back in one tap. */
export function latestOpenDraft(userId: string): OpenDraft | null {
  const found: OpenDraft[] = []
  const capture = readCapture(userId)
  if (capture) {
    found.push({
      to: '/capture',
      preview: clip(capture.text),
      updatedAt: capture.updatedAt,
    })
  }
  const fresh = readFormDraft(userId)
  if (fresh && formDraftOpen(fresh)) {
    found.push({
      to: '/new',
      preview: formDraftPreview(fresh),
      updatedAt: fresh.updatedAt ?? 0,
    })
  }
  found.push(...listEditDrafts(userId))
  found.sort((a, b) => b.updatedAt - a.updatedAt)
  return found[0] ?? null
}
