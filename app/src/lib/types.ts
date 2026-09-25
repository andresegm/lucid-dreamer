export type Lucidity = 'non-lucid' | 'semi-lucid' | 'lucid'
export type EntryType = 'dream' | 'note'

export const LUCIDITY_OPTIONS: { value: Lucidity; label: string; short: string }[] = [
  { value: 'non-lucid', label: 'Non-lucid', short: 'Non' },
  { value: 'semi-lucid', label: 'Semi-lucid', short: 'Semi' },
  { value: 'lucid', label: 'Lucid', short: 'Lucid' },
]

export const INDUCTION_METHODS = ['DILD', 'MILD', 'WBTB', 'WILD', 'DEILD', 'EILD', 'SSILD', 'FILD'] as const
export type InductionMethod = (typeof INDUCTION_METHODS)[number]

export const INDUCTION_DESCRIPTIONS: Record<InductionMethod, string> = {
  DILD: 'Dream-Initiated — became lucid inside the dream',
  MILD: 'Mnemonic Induction — intention set before sleep',
  WBTB: 'Wake Back To Bed',
  WILD: 'Wake-Initiated — entered the dream consciously',
  DEILD: 'Dream-Exit Initiated — re-entered after waking',
  EILD: 'Externally Induced (cue / device)',
  SSILD: 'Senses-Initiated',
  FILD: 'Finger-Induced',
}

export interface Tag {
  id: string
  name: string
  color: string | null
  dream_count?: number
}

export interface Dream {
  id: string
  date: string // YYYY-MM-DD
  title: string
  description: string
  lucidity: Lucidity
  induction_method: string | null
  induction_notes: string | null
  entry_type: EntryType
  favorite: boolean
  source: string
  created_at: string
  updated_at: string
  tags: Tag[]
}

export type DreamInput = Omit<Dream, 'id' | 'created_at' | 'updated_at' | 'tags' | 'source'> & {
  tagIds: string[]
}

export type SortOrder = 'newest' | 'oldest' | 'title'

export interface DreamFilters {
  q: string
  from: string | null
  to: string | null
  lucidity: Lucidity[]
  induction: string[]
  tags: string[] // tag ids
  tagMode: 'any' | 'all'
  favorites: boolean
  includeNotes: boolean
  sort: SortOrder
}

export const EMPTY_FILTERS: DreamFilters = {
  q: '',
  from: null,
  to: null,
  lucidity: [],
  induction: [],
  tags: [],
  tagMode: 'any',
  favorites: false,
  includeNotes: true,
  sort: 'newest',
}

/** Lightweight shape used for stats (no descriptions). */
export interface DreamLite {
  id: string
  date: string
  lucidity: Lucidity
  induction_method: string | null
  entry_type: EntryType
  favorite: boolean
  tags: { id: string; name: string }[]
}
