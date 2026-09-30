const LEGACY_DRAFT: Record<'capture' | 'new', string> = {
  capture: 'ldj.draft.capture',
  new: 'ldj.draft.new',
}

export function draftKey(userId: string, kind: 'capture' | 'new') {
  return `ldj.draft.${kind}.${userId}`
}

/** Per-user draft. A pre-account key is copied over once, then removed. */
export function readDraft(userId: string, kind: 'capture' | 'new'): string | null {
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
