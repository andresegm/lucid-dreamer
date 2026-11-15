import { createDream, ensureTags } from './api'
import type { Dream, DreamInput } from './types'

/** A new entry written without a connection. It keeps its id so a retry can never save it twice. */
export interface QueuedDream {
  id: string
  input: Omit<DreamInput, 'tagIds'>
  tagNames: string[]
  queuedAt: number
}

const EVENT = 'ldj-outbox'
const key = (userId: string) => `ldj.outbox.${userId}`

export function readOutbox(userId: string): QueuedDream[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(userId)) ?? '[]') as unknown
    return Array.isArray(raw) ? (raw as QueuedDream[]).filter((q) => q && typeof q.id === 'string' && q.input) : []
  } catch {
    return []
  }
}

function writeOutbox(userId: string, list: QueuedDream[]) {
  if (list.length) localStorage.setItem(key(userId), JSON.stringify(list))
  else localStorage.removeItem(key(userId))
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeOutbox(onChange: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key == null || e.key.startsWith('ldj.outbox.')) onChange() }
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** No connection, as opposed to the server refusing the save. */
export function isOfflineError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  return /failed to fetch|networkerror|network request failed|load failed|network connection/i.test(msg)
}

async function upload(q: QueuedDream): Promise<Dream | null> {
  const tags = await ensureTags(q.tagNames)
  return createDream({ ...q.input, tagIds: tags.map((t) => t.id) }, 'app', q.id)
}

/**
 * Save a new entry, or keep it on this device when there is no connection.
 * `queued` means it is safe locally and will upload by itself later.
 */
export async function saveNewDream(
  userId: string,
  input: Omit<DreamInput, 'tagIds'>,
  tagNames: string[],
): Promise<{ dream: Dream | null; queued: boolean }> {
  const item: QueuedDream = { id: crypto.randomUUID(), input, tagNames, queuedAt: Date.now() }
  try {
    return { dream: await upload(item), queued: false }
  } catch (e) {
    if (!isOfflineError(e)) throw e
    // If the device can't store it either, the caller must see an error and keep the draft
    writeOutbox(userId, [...readOutbox(userId), item])
    return { dream: null, queued: true }
  }
}

const flushing = new Set<string>()

/** Upload whatever is waiting. Returns how many went through; stops at the first failure and keeps the rest. */
export async function flushOutbox(userId: string): Promise<{ sent: number; error: unknown }> {
  if (flushing.has(userId)) return { sent: 0, error: null }
  flushing.add(userId)
  let sent = 0
  try {
    for (const q of readOutbox(userId)) {
      try {
        await upload(q)
      } catch (e) {
        return { sent, error: isOfflineError(e) ? null : e }
      }
      sent++
      writeOutbox(userId, readOutbox(userId).filter((x) => x.id !== q.id))
    }
    return { sent, error: null }
  } finally {
    flushing.delete(userId)
  }
}
