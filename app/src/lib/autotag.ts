import { INDUCTION_METHODS, type Tag } from './types'

/**
 * Auto-tagging: derive tag names from a dream's text.
 *
 * Two sources are combined:
 *  1. Every existing tag name, matched as a whole word (case-insensitive). "I saw Tonka" → Tonka.
 *  2. Keyword rules so that variants map to one tag:
 *     "flew" → flying, "my brother" → family, "RC" → reality check, …
 *
 * Acronym rules are case-sensitive so "RC"/"SP"/"FA" only match as abbreviations.
 * Locked tags are never suggested, so writing about them can't hide a new dream.
 */
interface Rule { tag: string; pattern: RegExp }

const ci = (src: string) => new RegExp(`\\b(?:${src})\\b`, 'i')
const cs = (src: string) => new RegExp(`\\b(?:${src})\\b`)

/** Acronym tags for every built-in induction method. Case-sensitive, same as the form. */
const METHOD_RULES: Rule[] = INDUCTION_METHODS.map((tag) => ({ tag, pattern: cs(tag) }))

export const KEYWORD_RULES: Rule[] = [
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
  // Emotions (optional analysis tags — also offered as chips when writing)
  { tag: 'fear', pattern: ci('fear|afraid|scared|terrified|frightening|horror') },
  { tag: 'anxiety', pattern: ci('anxiety|anxious|worried|panic|panicked') },
  { tag: 'anger', pattern: ci('anger|angry|furious|rage') },
  { tag: 'sadness', pattern: ci('sadness|sad|crying|grief|heartbroken') },
  { tag: 'joy', pattern: ci('joy|happy|happiness|elated|euphoric') },
  { tag: 'awe', pattern: ci('awe|wonder|amazed|wonderstruck') },
  { tag: 'confusion', pattern: ci('confusion|confused|disoriented') },
  { tag: 'shame', pattern: ci('shame|embarrassed|humiliated') },
  // Lucid-dreaming technique (acronyms are case-sensitive)
  { tag: 'false awakening', pattern: cs('FAs?|[Ff]alse [Aa]wakenings?') },
  { tag: 'reality check', pattern: cs('RCs?|[Rr]eality [Cc]hecks?') },
  { tag: 'sleep paralysis', pattern: cs('SP|[Ss]leep [Pp]aralysis') },
  ...METHOD_RULES,
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export interface Suggestion { name: string; exists: boolean }

/**
 * Returns tag names implied by `text`, excluding ones already in `selected` and any locked tag.
 * Existing tag names come first (most used first), then keyword-rule tags that don't exist yet.
 */
export function suggestTags(text: string, allTags: Tag[], selected: string[]): Suggestion[] {
  if (!text.trim()) return []
  const taken = new Set([...selected, ...allTags.filter((t) => t.locked).map((t) => t.name)].map((s) => s.toLowerCase()))
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

/**
 * Whole-word, case-insensitive match for a word or phrase: "red car" matches "Red  car." but not
 * "red sports car" or "redcar". Letters and digits in any script count as word characters.
 */
export function phrasePattern(phrase: string): RegExp | null {
  const words = phrase.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return null
  return new RegExp(`(?<![\\p{L}\\p{N}])${words.map(escapeRe).join('\\s+')}(?![\\p{L}\\p{N}])`, 'iu')
}

/** Everyday words that say nothing about a dream. English and Spanish, since journals mix both. */
const STOPWORDS = new Set(`
about above after again against almost along already also although always among another anyone anything around asked away back
became because become been before began behind being below between both bring came cannot come coming could couldn didn does
doesn doing done down during each either else enough even ever every everyone everything feel feeling felt find first found from
gave getting give goes going gone good great guess happen happened have having hear heard here herself himself however into just
keep kept kind knew know last later least left less like little look looked looking made make making many maybe mean might mine
more most much must myself near need never next nothing once only onto other others ours ourselves over part people place point
pretty probably quite rather really remember right said same seem seemed seems seen several shall should since some somehow someone
something sometimes somewhere soon sort started still stuff such sure take taken tell than that their theirs them themselves then there
these they thing things think this those though thought through time told took toward towards tried trying turn turned under until
upon used very walk walked walking want wanted wasn watch well went were weren what whatever when where whether which while whole
whom whose will with within without wonder would wouldn year years your yours yourself dream dreams dreamed dreamt dreaming woke wake
waking awake asleep sleep sleeping night morning suddenly somehow there's can't don't didn't wasn't couldn't
algo alguien algun alguna algunas alguno algunos alla alli ante antes aquel aquella aqui asi aunque bien cada casi como con contra
cosa cosas cual cuando cuanto debe decir del desde despues donde dos durante ella ellas ello ellos entonces entre era eran eres
esa esas ese eso esos esta estaba estaban estamos estan estar este esto estos estoy fue fueron fui habia hace hacer hacia hasta hay
luego mas mejor menos mientras mio mis mismo mucho muy nada nadie ningun nos nosotros nuestra nuestro nunca otra otras otro otros
para parece pero poco podia poder por porque puede pues que quien quiere quiza quizas saber segun ser sido siempre sin sobre solo
somos son soy sua sus tal tambien tampoco tan tanto tenia tener tengo tiene tienen toda todas todavia todo todos tras tus una unas
uno unos usted vamos van varios veces ver vez voy sueno sueño soñe soñé soñaba desperte desperté noche
`.split(/\s+/).filter(Boolean))

export interface RecurringWord { word: string; dreams: number; name: boolean }

/**
 * Words that keep coming back across entries but aren't tags yet: candidate dream signs.
 * Counts entries, not mentions, so one long dream can't dominate. Likely names sort first.
 */
export function recurringWords(
  texts: { title: string; description: string }[],
  tags: Tag[],
  limit = 18,
): RecurringWord[] {
  const tagNames = new Set(tags.map((t) => t.name.toLowerCase()))
  const seenIn = new Map<string, { dreams: number; capital: number; total: number }>()
  for (const t of texts) {
    const text = `${t.title}. ${t.description}`
    const inThis = new Set<string>()
    for (const m of text.matchAll(/[\p{L}][\p{L}'’]{3,}/gu)) {
      const raw = m[0]
      const word = raw.toLowerCase().replace(/['’]s$/, '')
      if (word.length < 4 || STOPWORDS.has(word) || tagNames.has(word)) continue
      const e = seenIn.get(word) ?? { dreams: 0, capital: 0, total: 0 }
      e.total++
      // Capitalised away from the start of a sentence: probably a person or place
      const before = text.slice(Math.max(0, m.index - 2), m.index)
      if (raw[0] !== raw[0].toLowerCase() && m.index > 0 && !/[.!?\n]\s?$/.test(before)) e.capital++
      if (!inThis.has(word)) { inThis.add(word); e.dreams++ }
      seenIn.set(word, e)
    }
  }
  const min = texts.length >= 60 ? 4 : 3
  return [...seenIn.entries()]
    .filter(([word, e]) => e.dreams >= min && !KEYWORD_RULES.some((r) => r.pattern.test(word)))
    .map(([word, e]) => ({ word, dreams: e.dreams, name: e.capital / e.total >= 0.6 }))
    .sort((a, b) => Number(b.name) - Number(a.name) || b.dreams - a.dreams || a.word.localeCompare(b.word))
    .slice(0, limit)
}
