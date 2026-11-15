import { supabase } from './supabase'

export const SLEEP_CHECKLIST = [
  { key: 'same_wake', label: 'Woke within ~30 minutes of my usual time', hint: 'Same wake-up time every day, weekends included.' },
  { key: 'time_in_bed', label: 'Gave myself 8–8.5 hours in bed', hint: 'A realistic chance at 8 hours of sleep.' },
  { key: 'light', label: 'Outdoor light soon after waking, dim evening', hint: 'Light in the morning, low light at night.' },
  { key: 'caffeine', label: 'No caffeine in the 8 hours before bed', hint: 'Longer if you’re sensitive.' },
  { key: 'alcohol_exercise', label: 'No alcohol near bedtime, exercise at my usual time', hint: 'Keep exercise timing consistent.' },
] as const

export type ChecklistKey = (typeof SLEEP_CHECKLIST)[number]['key']

export interface SleepLog {
  id?: string
  date: string
  bed_time: string | null
  wake_time: string | null
  alarm: boolean | null
  wbtb: boolean | null
  awakenings: number | null
  total_sleep_min: number | null
  rem_min: number | null
  rested: number | null
  checklist: Partial<Record<ChecklistKey, boolean>>
  notes: string
}

export function emptySleepLog(date: string): SleepLog {
  return {
    date,
    bed_time: null,
    wake_time: null,
    alarm: null,
    wbtb: null,
    awakenings: null,
    total_sleep_min: null,
    rem_min: null,
    rested: null,
    checklist: {},
    notes: '',
  }
}

const COLUMNS = 'id, date, bed_time, wake_time, alarm, wbtb, awakenings, total_sleep_min, rem_min, rested, checklist, notes'

/** Postgres returns `HH:MM:SS`; time inputs want `HH:MM`. */
function normalize(row: SleepLog): SleepLog {
  return {
    ...row,
    bed_time: row.bed_time ? row.bed_time.slice(0, 5) : null,
    wake_time: row.wake_time ? row.wake_time.slice(0, 5) : null,
    checklist: row.checklist ?? {},
    notes: row.notes ?? '',
  }
}

export async function fetchSleepLog(date: string): Promise<SleepLog | null> {
  const { data, error } = await supabase.from('sleep_logs').select(COLUMNS).eq('date', date).maybeSingle()
  if (error) throw error
  return data ? normalize(data as SleepLog) : null
}

export async function fetchSleepLogs(limit = 30): Promise<SleepLog[]> {
  const { data, error } = await supabase.from('sleep_logs').select(COLUMNS).order('date', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => normalize(r as SleepLog))
}

export async function saveSleepLog(log: SleepLog): Promise<SleepLog> {
  const { id: _id, ...fields } = log
  void _id
  const { data, error } = await supabase
    .from('sleep_logs')
    .upsert(fields, { onConflict: 'user_id,date' })
    .select(COLUMNS)
    .single()
  if (error) throw error
  return normalize(data as SleepLog)
}

export async function deleteSleepLog(date: string): Promise<void> {
  const { error } = await supabase.from('sleep_logs').delete().eq('date', date)
  if (error) throw error
}

export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Bed time is usually the evening before the wake time. */
export function timeInBed(bed: string | null, wake: string | null): number | null {
  if (!bed || !wake) return null
  let diff = minutesOfDay(wake) - minutesOfDay(bed)
  if (diff <= 0) diff += 24 * 60
  return diff
}

export function fmtMinutes(min: number | null | undefined): string {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

export function checklistDone(log: Pick<SleepLog, 'checklist'>): number {
  return SLEEP_CHECKLIST.filter((c) => log.checklist[c.key]).length
}

export interface SleepSummary {
  nights: number
  avgInBed: number | null
  avgSleep: number | null
  avgRested: number | null
  wakeSpread: number | null
}

/** Averages over the given logs; wake spread is earliest-to-latest wake time in minutes. */
export function summarize(logs: SleepLog[]): SleepSummary {
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const inBed = logs.map((l) => timeInBed(l.bed_time, l.wake_time)).filter((n): n is number => n != null)
  const sleep = logs.map((l) => l.total_sleep_min).filter((n): n is number => n != null)
  const rested = logs.map((l) => l.rested).filter((n): n is number => n != null)
  const wakes = logs.map((l) => (l.wake_time ? minutesOfDay(l.wake_time) : null)).filter((n): n is number => n != null)
  return {
    nights: logs.length,
    avgInBed: avg(inBed),
    avgSleep: avg(sleep),
    avgRested: avg(rested),
    wakeSpread: wakes.length >= 2 ? Math.max(...wakes) - Math.min(...wakes) : null,
  }
}

export interface NightGroup { label: string; nights: number; recall: number; lucid: number }
export interface SleepComparison { title: string; a: NightGroup; b: NightGroup; enough: boolean }

/** Fewer nights than this on either side and a percentage is noise. */
export const MIN_NIGHTS_TO_COMPARE = 3

/**
 * Splits logged nights in two (WBTB or not, alarm or not, …) and compares how often each side
 * ended with a remembered dream and with a lucid one. A log's date is the morning, same as a dream's.
 */
export function compareSleepToDreams(
  logs: SleepLog[],
  dreams: { date: string; entry_type: string; lucidity: string }[],
): SleepComparison[] {
  const recalled = new Set<string>()
  const lucid = new Set<string>()
  for (const d of dreams) {
    if (d.entry_type !== 'dream') continue
    recalled.add(d.date)
    if (d.lucidity !== 'non-lucid') lucid.add(d.date)
  }
  const group = (label: string, rows: SleepLog[]): NightGroup => ({
    label,
    nights: rows.length,
    recall: rows.length ? rows.filter((l) => recalled.has(l.date)).length / rows.length : 0,
    lucid: rows.length ? rows.filter((l) => lucid.has(l.date)).length / rows.length : 0,
  })
  const split = (title: string, aLabel: string, bLabel: string, test: (l: SleepLog) => boolean | null): SleepComparison => {
    const a = group(aLabel, logs.filter((l) => test(l) === true))
    const b = group(bLabel, logs.filter((l) => test(l) === false))
    return { title, a, b, enough: a.nights >= MIN_NIGHTS_TO_COMPARE && b.nights >= MIN_NIGHTS_TO_COMPARE }
  }
  return [
    split('Wake Back To Bed', 'WBTB nights', 'Other nights', (l) => l.wbtb),
    split('Alarm', 'No alarm', 'Alarm', (l) => (l.alarm == null ? null : !l.alarm)),
    split('Time in bed', '8 hours or more', 'Under 8 hours', (l) => {
      const t = timeInBed(l.bed_time, l.wake_time)
      return t == null ? null : t >= 480
    }),
    split('How rested you felt', 'Rested (4–5)', 'Tired (1–3)', (l) => (l.rested == null ? null : l.rested >= 4)),
  ]
}
