/**
 * Near-misses: moments in a non-lucid dream where something was off, or where you nearly asked the question.
 * These are what MILD rehearses ("next time that happens, I'll know I'm dreaming").
 * Keyword rules only, English and Spanish, so it is a prompt to look, not a verdict.
 */
export type NearMissKind = 'questioned' | 'false-awakening' | 'impossible' | 'odd'

export interface NearMiss {
  kind: NearMissKind
  label: string
  text: string
}

interface Rule { kind: NearMissKind; label: string; weight: number; pattern: RegExp }

const RULES: Rule[] = [
  {
    kind: 'questioned',
    label: 'You nearly caught it',
    weight: 4,
    pattern: /\b(?:(?:this|it|that) (?:is|was|must be|might be|could be|had to be|felt like) (?:just |only )?a dream|am i dreaming|was i dreaming|i'?m dreaming|thought (?:it|this) was a dream|is this (?:a dream|real)|(?:wasn'?t|was not|isn'?t|can'?t be|couldn'?t be) real|reality checks?|pinched (?:myself|my)|looked at my hands|counted my fingers|era un sue[ñn]o|estaba so[ñn]ando|estoy so[ñn]ando)\b/i,
  },
  {
    kind: 'false-awakening',
    label: 'False awakening',
    weight: 3,
    pattern: /\b(?:false awakenings?|i woke up (?:and|in|but|to)|woke up (?:again|in my (?:bed|room))|thought i (?:was awake|had woken|woke)|me despert[eé] (?:y|en|pero))\b/i,
  },
  {
    kind: 'impossible',
    label: 'Something impossible',
    weight: 2,
    pattern: /\b(?:impossible|imposible|could(?:n'?t| not) (?:be|happen)|who (?:had )?(?:died|passed away)|(?:is|was) (?:dead|deceased)|turned into|transformed into|morphed|changed into|breath(?:e|ed|ing) under ?water|floating|floated|levitat\w+|through (?:a |the )?walls?|teleport\w*|fly|flying|flew|volando|vol[eé])\b/i,
  },
  {
    kind: 'odd',
    label: 'Something odd',
    weight: 1,
    pattern: /\b(?:weird(?:ly)?|strange(?:ly)?|odd(?:ly)?|bizarre|did(?:n'?t| not) make sense|made no sense|makes no sense|for some reason|out of nowhere|out of place|(?:wasn'?t|was not) supposed to|somehow|raro|rara|extra[ñn]o|extra[ñn]a|no ten[ií]a sentido|por alguna raz[oó]n)\b/i,
  },
]

const MAX_LEN = 200

function clip(sentence: string): string {
  const s = sentence.replace(/\s+/g, ' ').trim()
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN).trimEnd() + '…' : s
}

/** Up to `limit` moments from one dream's text, strongest first, in reading order among equals. */
export function nearMissesIn(text: string, limit = 3): NearMiss[] {
  const found: (NearMiss & { weight: number; at: number })[] = []
  let at = 0
  for (const m of text.matchAll(/[^.!?\n]+[.!?]*/g)) {
    const sentence = m[0].trim()
    if (sentence.length < 8) continue
    const rule = RULES.find((r) => r.pattern.test(sentence))
    if (rule) found.push({ kind: rule.kind, label: rule.label, text: clip(sentence), weight: rule.weight, at: at++ })
  }
  return found
    .sort((a, b) => b.weight - a.weight || a.at - b.at)
    .slice(0, limit)
    .map(({ kind, label, text: t }) => ({ kind, label, text: t }))
}

export interface DreamNearMisses<T> { dream: T; moments: NearMiss[] }

/** Non-lucid dreams that have at least one such moment, in the order given. */
export function findNearMisses<T extends { description: string; lucidity: string; entry_type: string }>(
  dreams: T[],
  perDream = 2,
): DreamNearMisses<T>[] {
  const out: DreamNearMisses<T>[] = []
  for (const dream of dreams) {
    if (dream.entry_type !== 'dream' || dream.lucidity !== 'non-lucid') continue
    const moments = nearMissesIn(dream.description, perDream)
    if (moments.length) out.push({ dream, moments })
  }
  return out
}
