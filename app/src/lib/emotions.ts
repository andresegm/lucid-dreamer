import { KEYWORD_RULES } from './autotag'
import { excerpt } from './format'
import type { Dream } from './types'

/** Circumplex order for the Stats radar: high-arousal unpleasant → low → pleasant. */
export const EMOTIONS = [
  { name: 'fear', label: 'Fear' },
  { name: 'anxiety', label: 'Anxiety' },
  { name: 'anger', label: 'Anger' },
  { name: 'shame', label: 'Shame' },
  { name: 'sadness', label: 'Sadness' },
  { name: 'confusion', label: 'Confusion' },
  { name: 'awe', label: 'Awe' },
  { name: 'joy', label: 'Joy' },
] as const

export type EmotionName = (typeof EMOTIONS)[number]['name']

export const EMOTION_NAMES = new Set<string>(EMOTIONS.map((e) => e.name))

export function isEmotion(name: string): boolean {
  return EMOTION_NAMES.has(name.toLowerCase())
}

export function emotionLabel(name: string): string {
  return EMOTIONS.find((e) => e.name === name.toLowerCase())?.label ?? name
}

/** Keyword hits only — used by write-time chips and the beta journal scan. */
export function detectEmotions(text: string): EmotionName[] {
  if (!text.trim()) return []
  return EMOTIONS.filter((e) => KEYWORD_RULES.some((r) => r.tag === e.name && r.pattern.test(text))).map((e) => e.name)
}

export interface EmotionProposal {
  id: string
  date: string
  title: string
  excerpt: string
  emotions: EmotionName[]
}

/** Dreams that mention an emotion they don't already have tagged. Newest first. */
export function proposeEmotionTags(dreams: Dream[]): EmotionProposal[] {
  const out: EmotionProposal[] = []
  for (const d of dreams) {
    if (d.entry_type !== 'dream') continue
    const have = new Set(d.tags.map((t) => t.name.toLowerCase()))
    const emotions = detectEmotions(`${d.title}\n${d.description}`).filter((n) => !have.has(n))
    if (!emotions.length) continue
    out.push({ id: d.id, date: d.date, title: d.title || 'Untitled', excerpt: excerpt(d.description, 140), emotions })
  }
  return out.reverse()
}
