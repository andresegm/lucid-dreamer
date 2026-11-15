import { addDays as addDaysFn, startOfWeek } from 'date-fns'
import { supabase } from './supabase'
import { isOfflineError } from './outbox'
import { localISO, parseLocalISO } from './format'
import { minutesOfDay, type SleepLog } from './sleep'

/**
 * One day of lucid practice. `date` is the morning a night ended on (same as a dream's date),
 * so a MILD session at 4 a.m. and the dream that followed share a date. Reality checks count on the calendar day.
 */
export interface PracticeDay {
  date: string
  rc_count: number
  mild_at: string | null
  mild_cue: string
  mild_dream_id: string | null
}

const TABLE = 'practice_days'
const COLUMNS = 'date, rc_count, mild_at, mild_cue, mild_dream_id'
const RC_MAX = 500

// ---------- Waiting on this device ----------
// Every change lands here first and uploads right after, so a session finished at 4 a.m. in airplane mode is kept.

interface PendingMild { at: string; cue: string; dream_id: string | null }
interface Pending { rc: Record<string, number>; mild: Record<string, PendingMild> }

const key = (userId: string) => `ldj.practice.${userId}`
const EVENT = 'ldj-practice'

function readPending(userId: string): Pending {
  try {
    const raw = JSON.parse(localStorage.getItem(key(userId)) ?? 'null') as Partial<Pending> | null
    return { rc: { ...(raw?.rc ?? {}) }, mild: { ...(raw?.mild ?? {}) } }
  } catch {
    return { rc: {}, mild: {} }
  }
}

function writePending(userId: string, p: Pending) {
  try {
    if (Object.keys(p.rc).length || Object.keys(p.mild).length) localStorage.setItem(key(userId), JSON.stringify(p))
    else localStorage.removeItem(key(userId))
  } catch { /* private mode: the change still shows until reload */ }
}

function announce() {
  window.dispatchEvent(new Event(EVENT))
}

export function onPracticeChanged(reload: () => void) {
  window.addEventListener(EVENT, reload)
  return () => window.removeEventListener(EVENT, reload)
}

// ---------- What the server is known to hold ----------

const cache = new Map<string, Map<string, PracticeDay>>()
function cacheFor(userId: string): Map<string, PracticeDay> {
  let m = cache.get(userId)
  if (!m) cache.set(userId, (m = new Map()))
  return m
}

const clampRc = (n: number) => Math.min(RC_MAX, Math.max(0, n))

function normalize(row: PracticeDay): PracticeDay {
  return { date: row.date, rc_count: row.rc_count ?? 0, mild_at: row.mild_at ?? null, mild_cue: row.mild_cue ?? '', mild_dream_id: row.mild_dream_id ?? null }
}

/** Saved days plus anything still waiting to upload, oldest first. Reads memory only. */
export function practiceDays(userId: string, since: string): PracticeDay[] {
  const pending = readPending(userId)
  const out = new Map<string, PracticeDay>()
  for (const [date, row] of cacheFor(userId)) if (date >= since) out.set(date, row)
  for (const date of new Set([...Object.keys(pending.rc), ...Object.keys(pending.mild)])) {
    if (date < since) continue
    const cur = out.get(date) ?? { date, rc_count: 0, mild_at: null, mild_cue: '', mild_dream_id: null }
    const m = pending.mild[date]
    out.set(date, {
      date,
      rc_count: clampRc(cur.rc_count + (pending.rc[date] ?? 0)),
      mild_at: m?.at ?? cur.mild_at,
      mild_cue: m?.cue ?? cur.mild_cue,
      mild_dream_id: m ? m.dream_id : cur.mild_dream_id,
    })
  }
  return [...out.values()].filter((d) => d.rc_count > 0 || d.mild_at).sort((a, b) => a.date.localeCompare(b.date))
}

type FlushState = 'ok' | 'offline' | 'setup' | 'error'

/** The database has no practice table yet: supabase/practice.sql hasn't been run. */
function isMissingTable(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null
  return err?.code === 'PGRST205' || err?.code === '42P01' || /could not find the table|relation .* does not exist/i.test(err?.message ?? '')
}

function classify(e: unknown): FlushState {
  if (isMissingTable(e)) return 'setup'
  return isOfflineError(e) ? 'offline' : 'error'
}

async function flushOnce(userId: string): Promise<FlushState> {
  const snap = readPending(userId)
  const dates = [...new Set([...Object.keys(snap.rc), ...Object.keys(snap.mild)])]
  if (!dates.length) return 'ok'
  try {
    const { data, error } = await supabase.from(TABLE).select(COLUMNS).in('date', dates)
    if (error) return classify(error)
    const have = new Map((data ?? []).map((r) => [r.date as string, normalize(r as PracticeDay)]))
    const build = (keepDream: boolean) => dates.map((date) => {
      const cur = have.get(date)
      const m = snap.mild[date]
      return {
        date,
        rc_count: clampRc((cur?.rc_count ?? 0) + (snap.rc[date] ?? 0)),
        mild_at: m?.at ?? cur?.mild_at ?? null,
        mild_cue: m?.cue ?? cur?.mild_cue ?? '',
        mild_dream_id: m ? (keepDream ? m.dream_id : null) : cur?.mild_dream_id ?? null,
      }
    })
    let res = await supabase.from(TABLE).upsert(build(true), { onConflict: 'user_id,date' }).select(COLUMNS)
    // The dream a session pointed at was deleted since: keep the session, drop the link
    if (res.error?.code === '23503') res = await supabase.from(TABLE).upsert(build(false), { onConflict: 'user_id,date' }).select(COLUMNS)
    if (res.error) return classify(res.error)

    // Forget what was just uploaded, keep whatever was added while it was on its way
    const now = readPending(userId)
    for (const date of dates) {
      if (snap.rc[date]) {
        const left = (now.rc[date] ?? 0) - snap.rc[date]
        if (left) now.rc[date] = left
        else delete now.rc[date]
      }
      if (snap.mild[date] && now.mild[date]?.at === snap.mild[date].at) delete now.mild[date]
    }
    const rows = cacheFor(userId)
    for (const r of res.data ?? []) rows.set(r.date as string, normalize(r as PracticeDay))
    writePending(userId, now)
    announce()
    return 'ok'
  } catch (e) {
    return classify(e)
  }
}

let chain: Promise<unknown> = Promise.resolve()

/** Upload what is waiting. One at a time, never throws. */
export function flushPractice(userId: string): Promise<FlushState> {
  const run = chain.then(() => flushOnce(userId))
  chain = run.catch(() => {})
  return run
}

/** Refresh saved days from `since` on. `setupNeeded` means the table is missing and days live on this device only. */
export async function loadPractice(userId: string, since: string): Promise<{ setupNeeded: boolean }> {
  const flushed = await flushPractice(userId)
  if (flushed === 'setup') return { setupNeeded: true }
  const { data, error } = await supabase.from(TABLE).select(COLUMNS).gte('date', since).order('date', { ascending: true }).limit(1000)
  if (error) {
    if (isMissingTable(error)) return { setupNeeded: true }
    if (isOfflineError(error)) return { setupNeeded: false }
    throw error
  }
  const rows = cacheFor(userId)
  for (const date of [...rows.keys()]) if (date >= since) rows.delete(date)
  for (const r of data ?? []) rows.set(r.date as string, normalize(r as PracticeDay))
  announce()
  return { setupNeeded: false }
}

/** Count reality checks for a day. A negative `n` takes one back. */
export function addRealityCheck(userId: string, date: string, n = 1) {
  const p = readPending(userId)
  const next = (p.rc[date] ?? 0) + n
  if (next) p.rc[date] = next
  else delete p.rc[date]
  writePending(userId, p)
  announce()
  void flushPractice(userId)
}

/** Record a finished MILD session for the night ending on `date`. */
export function saveMildSession(userId: string, date: string, cue: string, dreamId: string | null): Promise<FlushState> {
  const p = readPending(userId)
  p.mild[date] = { at: new Date().toISOString(), cue: cue.trim().slice(0, 500), dream_id: dreamId }
  writePending(userId, p)
  announce()
  return flushPractice(userId)
}

// ---------- Nights and weeks ----------

export function addDays(iso: string, n: number): string {
  return localISO(addDaysFn(parseLocalISO(iso), n))
}

/** The morning a session done right now belongs to: before noon it is this morning's night, after noon it is tonight's. */
export function sessionDate(now = new Date()): string {
  const today = localISO(now)
  return now.getHours() < 12 ? today : addDays(today, 1)
}

/** The evening "tonight" means on Home. Until 4 a.m. it is still last evening's night. */
export function upcomingEvening(now = new Date()): string {
  const today = localISO(now)
  return now.getHours() < 4 ? addDays(today, -1) : today
}

/** A session was saved for this morning's night, and it is still morning. */
export function loggedThisMorning(days: PracticeDay[], now = new Date()): boolean {
  const today = localISO(now)
  return now.getHours() < 12 && days.some((d) => d.date === today && Boolean(d.mild_at))
}

export const WEEKDAYS = [
  { day: 1, short: 'Mon', long: 'Monday' },
  { day: 2, short: 'Tue', long: 'Tuesday' },
  { day: 3, short: 'Wed', long: 'Wednesday' },
  { day: 4, short: 'Thu', long: 'Thursday' },
  { day: 5, short: 'Fri', long: 'Friday' },
  { day: 6, short: 'Sat', long: 'Saturday' },
  { day: 0, short: 'Sun', long: 'Sunday' },
] as const

export type NightState = 'done' | 'tonight' | 'planned' | 'missed' | 'none'
export interface WeekNight { evening: string; weekday: number; planned: boolean; state: NightState }

/**
 * Monday-to-Sunday evenings of the week `weeksAgo` weeks back. A night counts as done when a session
 * was saved for the morning after it, planned or not.
 */
export function weekNights(days: PracticeDay[], plan: number[], now = new Date(), weeksAgo = 0): WeekNight[] {
  const tonight = upcomingEvening(now)
  const monday = addDaysFn(startOfWeek(parseLocalISO(tonight), { weekStartsOn: 1 }), -7 * weeksAgo)
  const done = new Set(days.filter((d) => d.mild_at).map((d) => d.date))
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysFn(monday, i)
    const evening = localISO(date)
    const planned = plan.includes(date.getDay())
    const state: NightState = done.has(addDays(evening, 1))
      ? 'done'
      : !planned ? 'none' : evening < tonight ? 'missed' : evening === tonight ? 'tonight' : 'planned'
    return { evening, weekday: date.getDay(), planned, state }
  })
}

export function nightsDone(nights: WeekNight[]): number {
  return nights.filter((n) => n.state === 'done').length
}

/** The next planned evening from tonight on, within a week. */
export function nextPlannedEvening(plan: number[], now = new Date()): string | null {
  const tonight = upcomingEvening(now)
  for (let i = 0; i < 7; i++) {
    const iso = addDays(tonight, i)
    if (plan.includes(parseLocalISO(iso).getDay())) return iso
  }
  return null
}

export interface AttemptStats {
  attempts: number
  attemptRecall: number
  attemptLucid: number
  otherNights: number
  otherLucid: number
}

/**
 * What practice nights returned, per attempt: every night with a session counts, remembered or not.
 * Other nights are ones with a remembered dream and no session. Semi-lucid counts as lucid, as elsewhere.
 */
export function attemptStats(
  days: PracticeDay[],
  dreams: { date: string; entry_type: string; lucidity: string }[],
  today = localISO(new Date()),
): AttemptStats {
  const recalled = new Set<string>()
  const lucid = new Set<string>()
  for (const d of dreams) {
    if (d.entry_type !== 'dream') continue
    recalled.add(d.date)
    if (d.lucidity !== 'non-lucid') lucid.add(d.date)
  }
  const attempts = days.filter((d) => d.mild_at && d.date <= today).map((d) => d.date)
  const attempted = new Set(attempts)
  const others = [...recalled].filter((d) => !attempted.has(d))
  return {
    attempts: attempts.length,
    attemptRecall: attempts.filter((d) => recalled.has(d)).length,
    attemptLucid: attempts.filter((d) => lucid.has(d)).length,
    otherNights: others.length,
    otherLucid: others.filter((d) => lucid.has(d)).length,
  }
}

// ---------- When to wake for WBTB ----------

/** Minutes assumed between lights out and sleep. */
export const SLEEP_LATENCY_MIN = 15
const MIN_LOGS_FOR_USUAL = 3

const hhmm = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export interface WbtbSuggestion {
  bed: string
  wake: string
  alarm: string
  /** Sleep before the alarm, in minutes. */
  sleepMin: number
  /** Minutes between the alarm and the usual wake-up. */
  leftMin: number
  /** Sleep logs the usual bedtime came from; 0 when it is the Settings bedtime. */
  fromLogs: number
  /** 1 when the alarm rings the calendar day after the practice evening. */
  alarmDayOffset: 0 | 1
}

/**
 * Wake after roughly three or four 90-minute cycles, where REM periods run long: six hours of sleep
 * when the night is long enough to leave 90 minutes after it, four and a half otherwise.
 */
export function suggestWbtb(logs: SleepLog[], fallbackBed: string, fallbackWake: string): WbtbSuggestion {
  const recent = logs.slice(0, 14)
  // Measured from noon so 23:40 and 00:20 average to midnight, not midday
  const beds = recent.filter((l) => l.bed_time).map((l) => (minutesOfDay(l.bed_time!) + 720) % 1440)
  const wakes = recent.filter((l) => l.wake_time).map((l) => minutesOfDay(l.wake_time!))
  const fromLogs = beds.length >= MIN_LOGS_FOR_USUAL ? beds.length : 0
  const bedFromNoon = fromLogs ? median(beds) : (minutesOfDay(fallbackBed) + 720) % 1440
  const wake = wakes.length >= MIN_LOGS_FOR_USUAL ? median(wakes) : minutesOfDay(fallbackWake)
  const bed = (bedFromNoon + 720) % 1440

  let inBed = wake - bed
  if (inBed <= 0) inBed += 1440
  const sleepMin = inBed - SLEEP_LATENCY_MIN - 360 >= 90 ? 360 : 270
  const alarmFromNoon = Math.round((bedFromNoon + SLEEP_LATENCY_MIN + sleepMin) / 5) * 5
  return {
    bed: hhmm(bed),
    wake: hhmm(wake),
    alarm: hhmm(alarmFromNoon + 720),
    sleepMin,
    leftMin: Math.max(0, inBed - SLEEP_LATENCY_MIN - sleepMin),
    fromLogs,
    // Noon-based minutes past 720 are past midnight
    alarmDayOffset: alarmFromNoon >= 720 ? 1 : 0,
  }
}
