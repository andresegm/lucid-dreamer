import { INDUCTION_METHODS, type Tag } from './types'
import { parseLocalISO } from './format'

/** Something that keeps showing up in your dreams, so it is worth a reality check when it shows up awake. */
export interface DreamSign { id: string; name: string; dreams: number }

/** Tags about technique rather than dream content. */
const NOT_SIGNS = new Set(['reality check', 'false awakening', 'sleep paralysis', 'lucid', ...INDUCTION_METHODS.map((m) => m.toLowerCase())])

/** Your most used content tags, most frequent first. A tag needs two dreams to count as recurring. */
export function signsFromTags(tags: Tag[], limit = 8): DreamSign[] {
  return tags
    .filter((t) => !t.locked && (t.dream_count ?? 0) >= 2 && !NOT_SIGNS.has(t.name.toLowerCase()))
    .sort((a, b) => (b.dream_count ?? 0) - (a.dream_count ?? 0) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((t) => ({ id: t.id, name: t.name, dreams: t.dream_count ?? 0 }))
}

/** One sign per day, cycling through the list so the trigger stays fresh. */
export function signOfDay(signs: DreamSign[], dateISO: string): DreamSign | null {
  if (!signs.length) return null
  const d = parseLocalISO(dateISO)
  const dayNumber = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
  return signs[dayNumber % signs.length]
}

/** Triggers for a journal with no recurring tags yet. */
const GENERIC = ['you walk through a doorway', 'you look at a clock or your phone', 'something surprises you', 'you wash your hands']

export function genericTrigger(dateISO: string): string {
  const d = parseLocalISO(dateISO)
  return GENERIC[Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000) % GENERIC.length]
}
