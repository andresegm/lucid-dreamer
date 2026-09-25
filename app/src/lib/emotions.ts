export const EMOTIONS = [
  { name: 'fear', label: 'Fear' },
  { name: 'anxiety', label: 'Anxiety' },
  { name: 'anger', label: 'Anger' },
  { name: 'sadness', label: 'Sadness' },
  { name: 'joy', label: 'Joy' },
  { name: 'awe', label: 'Awe' },
  { name: 'confusion', label: 'Confusion' },
  { name: 'shame', label: 'Shame' },
] as const

export const EMOTION_NAMES = new Set<string>(EMOTIONS.map((e) => e.name))

export function isEmotion(name: string): boolean {
  return EMOTION_NAMES.has(name.toLowerCase())
}
