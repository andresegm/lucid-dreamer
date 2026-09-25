import type { Tag } from './types'

/**
 * Auto-tagging: derive tag names from a dream's text.
 *
 * Two sources are combined:
 *  1. Every existing tag name, matched as a whole word (case-insensitive). "I saw Tonka" → Tonka.
 *  2. Keyword rules (kept in sync with supabase/autotag.sql) so that variants map to one tag:
 *     "flew" → flying, "my brother" → family, "RC" → reality check, …
 *
 * Acronym rules are case-sensitive so "RC"/"SP"/"FA" only match as abbreviations.
 */
interface Rule { tag: string; pattern: RegExp }

const ci = (src: string) => new RegExp(`\\b(?:${src})\\b`, 'i')
const cs = (src: string) => new RegExp(`\\b(?:${src})\\b`)

export const KEYWORD_RULES: Rule[] = [
  // People (same list as supabase/autotag.sql — only applied if the tag already exists, or shown as a create-suggestion)
  { tag: 'Lusho', pattern: ci('lusho') },
  { tag: 'Diego', pattern: ci('diego') },
  { tag: 'Maria', pattern: ci('maria') },
  { tag: 'Luisa', pattern: ci('luisa') },
  { tag: 'Tonka', pattern: ci('tonka') },
  { tag: 'Pau', pattern: ci('pau') },
  { tag: 'Silvana', pattern: ci('silvana') },
  { tag: 'Carolina', pattern: ci('carolina') },
  { tag: 'Dii', pattern: ci('dii') },
  { tag: 'Juan', pattern: ci('juan') },
  { tag: 'Angel', pattern: ci('angel') },
  { tag: 'Mariana', pattern: ci('mariana') },
  { tag: 'Fiona', pattern: ci('fiona') },
  { tag: 'Paula', pattern: ci('paula') },
  { tag: 'Ariana', pattern: ci('ariana') },
  { tag: 'Alejandro', pattern: ci('alejandro') },
  { tag: 'Vicente', pattern: ci('vicente') },
  { tag: 'Tevin', pattern: ci('tevin') },
  { tag: 'Megan', pattern: ci('megan') },
  { tag: 'Laura', pattern: ci('laura') },
  { tag: 'Alvaro', pattern: ci('alvaro') },
  // Places
  { tag: 'Venezuela', pattern: ci('venezuela') },
  { tag: 'Canada', pattern: ci('canada') },
  { tag: 'Miami', pattern: ci('miami') },
  { tag: 'Calgary', pattern: ci('calgary') },
  { tag: 'Florida', pattern: ci('florida') },
  // Themes
  { tag: 'zombies', pattern: ci('zombies?') },
  { tag: 'apocalypse', pattern: ci('apocalypse') },
  { tag: 'flying', pattern: ci('fly|flying|flew|flies') },
  { tag: 'school', pattern: ci('school|class|classes|teacher|university|college|exam|exams') },
  { tag: 'family', pattern: ci('family|mom|mother|dad|father|brother|sister|grandma|grandpa|abuela|abuelo') },
  { tag: 'house', pattern: ci('house|home') },
  { tag: 'beach', pattern: ci('beach(?:es)?') },
  { tag: 'ocean', pattern: ci('ocean|sea|waves?') },
  { tag: 'surfing', pattern: ci('surf|surfing|surfed|surfboard') },
  { tag: 'fighting', pattern: ci('fight|fighting|fought|guns?|shoot|shooting|shot|knife|knives|swords?|kill|killed|killing') },
  { tag: 'dogs', pattern: ci('dogs?') },
  { tag: 'shark', pattern: ci('sharks?') },
  { tag: 'party', pattern: ci('party|parties') },
  { tag: 'hotel', pattern: ci('hotels?') },
  { tag: 'soccer', pattern: ci('soccer|football') },
  { tag: 'driving', pattern: ci('driving|drove|drive') },
  { tag: 'video games', pattern: ci('video ?games?|zelda|goku|dbz|dragon ?ball|assassin\'?s creed|minecraft|pokemon|mario') },
  { tag: 'taekwondo', pattern: ci('taekwondo') },
  { tag: 'intimacy', pattern: ci('kiss|kissed|kissing|sex|making out|made out') },
  { tag: 'teleportation', pattern: ci('teleport|teleported|teleporting|teleportation') },
  { tag: 'nightmare', pattern: ci('nightmares?') },
  // Lucid-dreaming technique (acronyms are case-sensitive)
  { tag: 'false awakening', pattern: cs('FAs?|[Ff]alse [Aa]wakenings?') },
  { tag: 'reality check', pattern: cs('RCs?|[Rr]eality [Cc]hecks?') },
  { tag: 'sleep paralysis', pattern: cs('SP|[Ss]leep [Pp]aralysis') },
  { tag: 'DILD', pattern: cs('DILD') },
  { tag: 'WILD', pattern: cs('WILD') },
  { tag: 'DEILD', pattern: cs('DEILD') },
  { tag: 'MILD', pattern: cs('MILD') },
  { tag: 'WBTB', pattern: cs('WBTB') },
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export interface Suggestion { name: string; exists: boolean }

/**
 * Returns tag names implied by `text`, excluding ones already in `selected`.
 * Existing tag names come first (most used first), then keyword-rule tags that don't exist yet.
 */
export function suggestTags(text: string, allTags: Tag[], selected: string[]): Suggestion[] {
  if (!text.trim()) return []
  const taken = new Set(selected.map((s) => s.toLowerCase()))
  const byLower = new Map(allTags.map((t) => [t.name.toLowerCase(), t]))
  const out = new Map<string, Suggestion>()

  const add = (name: string) => {
    const key = name.toLowerCase()
    if (taken.has(key) || out.has(key)) return
    const existing = byLower.get(key)
    out.set(key, { name: existing?.name ?? name, exists: !!existing })
  }

  // 1. Existing tag names as whole words. Skip very short names to avoid noise ("a", "it").
  for (const t of [...allTags].sort((a, b) => (b.dream_count ?? 0) - (a.dream_count ?? 0))) {
    if (t.name.length < 3) continue
    if (new RegExp(`\\b${escapeRe(t.name)}\\b`, 'i').test(text)) add(t.name)
  }
  // 2. Keyword rules
  for (const r of KEYWORD_RULES) if (r.pattern.test(text)) add(r.tag)

  return [...out.values()].sort((a, b) => Number(b.exists) - Number(a.exists))
}
