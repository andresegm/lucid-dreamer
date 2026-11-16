import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlarmClock, Check, MoonStar } from 'lucide-react'
import clsx from 'clsx'
import { fetchAllLite, fetchDreams, fetchTags } from '@/lib/api'
import { fetchSleepLogs, fmtMinutes, type SleepLog } from '@/lib/sleep'
import {
  SLEEP_LATENCY_MIN,
  WEEKDAYS,
  addDays,
  attemptStats,
  loggedThisMorning,
  nextPlannedEvening,
  nightsDone,
  suggestWbtb,
  upcomingEvening,
  weekNights,
} from '@/lib/practice'
import { usePractice } from '@/lib/usePractice'
import { useSettings } from '@/lib/settings'
import { signsFromTags, type DreamSign } from '@/lib/signs'
import { useScannedSigns } from '@/lib/useScannedSigns'
import { findNearMisses } from '@/lib/nearMiss'
import { fmtDate, todayISO } from '@/lib/format'
import { EMPTY_FILTERS, type Dream, type DreamLite } from '@/lib/types'
import { ErrorBox, PageHeader, Segmented } from '@/components/ui'
import { RealityCheck } from '@/components/RealityCheck'

const ALL_TIME = '1970-01-01'
const MIN_ATTEMPTS = 3
const HISTORY_WEEKS = 8
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—')

export function PracticePage() {
  const { settings, update } = useSettings()
  const { uid, days, setupNeeded, error } = usePractice(ALL_TIME)
  const [signs, setSigns] = useState<DreamSign[]>([])
  const scanned = useScannedSigns()
  const [logs, setLogs] = useState<SleepLog[]>([])
  const [lite, setLite] = useState<DreamLite[]>([])
  const [recent, setRecent] = useState<Dream[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchTags().then((tags) => { if (!cancelled) setSigns(signsFromTags(tags, 12)) }).catch(() => {})
    fetchSleepLogs(14).then((rows) => { if (!cancelled) setLogs(rows) }).catch(() => {})
    fetchAllLite().then((rows) => { if (!cancelled) setLite(rows) }).catch(() => {})
    fetchDreams({ ...EMPTY_FILTERS, includeNotes: false, sort: 'newest' }, 1, 40)
      .then((page) => { if (!cancelled) setRecent(page.rows) })
      .catch(() => { if (!cancelled) setRecent([]) })
    return () => { cancelled = true }
  }, [])

  const plan = settings.practiceNights
  const week = useMemo(() => weekNights(days, plan), [days, plan])
  const done = nightsDone(week)
  const tonight = upcomingEvening()
  const tonightState = week.find((n) => n.evening === tonight)?.state
  const next = nextPlannedEvening(plan)
  const wbtb = useMemo(() => suggestWbtb(logs, settings.bedTime, settings.wakeTime), [logs, settings.bedTime, settings.wakeTime])
  const stats = useMemo(() => attemptStats(days, lite), [days, lite])
  const history = useMemo(
    () => Array.from({ length: HISTORY_WEEKS }, (_, i) => {
      const nights = weekNights(days, plan, new Date(), HISTORY_WEEKS - 1 - i)
      return { start: nights[0].evening, done: nightsDone(nights) }
    }),
    [days, plan],
  )
  const missed = useMemo(() => findNearMisses(recent ?? []).slice(0, 8), [recent])
  const today = todayISO()
  const last7 = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i - 6)
      return { date, count: days.find((d) => d.date === date)?.rc_count ?? 0 }
    }),
    [days, today],
  )
  const rcPeak = Math.max(settings.rcGoal, ...last7.map((d) => d.count))

  function toggleNight(day: number) {
    update({ practiceNights: plan.includes(day) ? plan.filter((d) => d !== day) : [...plan, day].sort((a, b) => a - b) })
  }

  return (
    <div className="max-w-3xl fade-in">
      <PageHeader title="Practice" subtitle="Journaling builds recall. Lucidity comes from attempts, so plan them, do them, and see what they return." />

      {error ? <div className="mb-4"><ErrorBox error={error} /></div> : null}
      {setupNeeded && (
        <div className="card mb-4 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--lucid) 40%, transparent)' }}>
          <div className="font-medium mb-1">Kept on this device for now</div>
          <p className="text-muted">
            The database has no practice table yet, so sessions and reality checks are saved on this device only. Run <code>supabase/practice.sql</code> in
            the Supabase SQL Editor and they’ll upload by themselves.
          </p>
        </div>
      )}

      <section className="card mb-4">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="font-semibold">Practice nights</h2>
          <span className="text-xs text-muted tabular-nums">{plan.length ? `${done} of ${plan.length} this week` : `${done} this week`}</span>
        </div>
        <p className="text-xs text-muted mb-3">
          Nights you’ll wake after a few hours and do the session. Tap a night to plan or unplan it. Two or three a week is plenty; every night costs too much sleep.
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w) => {
            const night = week.find((n) => n.weekday === w.day)!
            return (
              <button
                key={w.day}
                type="button"
                onClick={() => toggleNight(w.day)}
                aria-pressed={night.planned}
                title={`${w.long} night: ${night.state === 'none' ? 'not planned' : night.state}`}
                className={clsx('rounded-xl border px-1 py-2 text-center transition-colors', night.evening === tonight && 'ring-1 ring-[var(--border-strong)]')}
                style={{
                  borderColor: night.planned || night.state === 'done' ? 'var(--accent)' : 'var(--border)',
                  background: night.state === 'done' ? 'var(--accent)' : night.planned ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'var(--bg-elev-2)',
                  color: night.state === 'done' ? 'var(--accent-contrast)' : undefined,
                }}
              >
                <span className="block text-xs font-medium">{w.short}</span>
                <span className="flex items-center justify-center h-5 text-[11px]" style={night.state === 'missed' ? { color: 'var(--danger)' } : undefined}>
                  {night.state === 'done' ? <Check size={14} /> : night.state === 'missed' ? 'missed' : night.state === 'tonight' ? 'tonight' : night.planned ? 'planned' : '·'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t mt-4 pt-4" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0 flex-1 basis-64">
            <div className="text-sm flex items-center gap-2">
              <AlarmClock size={16} className="text-accent shrink-0" />
              <span>
                {loggedThisMorning(days)
                  ? 'Last night’s session is logged.'
                  : tonightState === 'done'
                    ? 'Tonight’s session is logged.'
                    : tonightState === 'tonight'
                    ? 'Tonight is a practice night.'
                    : next ? `Next practice night: ${fmtDate(next, 'EEEE')}.` : 'On a practice night:'}{' '}
                Wake at <span className="font-semibold tabular-nums">{wbtb.alarm}</span>.
              </span>
            </div>
            <p className="text-xs text-muted mt-1.5">
              Usual bedtime {wbtb.bed} ({wbtb.fromLogs ? `from your last ${wbtb.fromLogs} sleep logs` : 'from Settings; log a few nights in Sleep to use your real one'}),
              {' '}{SLEEP_LATENCY_MIN} minutes to fall asleep, then {fmtMinutes(wbtb.sleepMin)} of sleep, which is where REM periods get long.
              That leaves about {fmtMinutes(wbtb.leftMin)} before your usual {wbtb.wake} wake-up. Use a real alarm; a calendar alert won’t wake you.
            </p>
          </div>
          <Link to="/night" className="btn btn-primary shrink-0"><MoonStar size={16} /> Start night session</Link>
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="font-semibold mb-1">What attempts return</h2>
        <p className="text-xs text-muted mb-4">Counted per attempt: every night you did the session, whether or not you remembered a dream after it.</p>
        {stats.attempts < MIN_ATTEMPTS ? (
          <p className="text-sm text-muted">
            {stats.attempts === 0 ? 'No sessions yet.' : `${stats.attempts} ${stats.attempts === 1 ? 'session' : 'sessions'} so far.`} A rate means something from about {MIN_ATTEMPTS} attempts on; expect roughly one lucid dream in five to ten good attempts.
          </p>
        ) : (
          <dl className="grid grid-cols-3 gap-4">
            <Stat label="Attempts" value={String(stats.attempts)} sub="nights with a session" />
            <Stat label="Lucid after" value={pct(stats.attemptLucid, stats.attempts)} sub={`${stats.attemptLucid} of ${stats.attempts} attempts`} accent />
            <Stat label="Other nights" value={pct(stats.otherLucid, stats.otherNights)} sub={`${stats.otherLucid} of ${stats.otherNights} with a dream`} />
          </dl>
        )}
        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-wide text-faint mb-2">Sessions per week, last {HISTORY_WEEKS} weeks</div>
          <div className="flex items-end gap-1.5 h-16">
            {history.map((w, i) => (
              <div key={w.start} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`Week of ${fmtDate(w.start, 'MMM d')}: ${w.done}`}>
                <div
                  className="w-full rounded-md"
                  style={{
                    height: `${Math.max(6, (w.done / 7) * 100)}%`,
                    background: w.done ? 'var(--accent)' : 'var(--bg-elev-2)',
                    opacity: i === history.length - 1 ? 1 : 0.7,
                  }}
                />
                <span className="text-[10px] text-faint tabular-nums">{w.done}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="font-semibold mb-1">Reality checks</h2>
        <p className="text-xs text-muted mb-4">
          A check only carries into dreams if you really doubt for a second. Tie it to things from your own dreams, not to the clock.
        </p>
        <RealityCheck uid={uid} days={days} signs={signs} scanned={scanned} goal={settings.rcGoal} />

        <div className="flex items-end gap-1.5 h-14 mt-5">
          {last7.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${fmtDate(d.date, 'EEE, MMM d')}: ${d.count}`}>
              <div
                className="w-full rounded-md"
                style={{
                  height: `${Math.max(6, (d.count / rcPeak) * 100)}%`,
                  background: d.count >= settings.rcGoal ? 'var(--accent)' : d.count ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--bg-elev-2)',
                }}
              />
              <span className="text-[10px] text-faint">{fmtDate(d.date, 'EEEEE')}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <span className="text-sm text-muted">Daily goal</span>
          <Segmented<string>
            value={String(settings.rcGoal)}
            onChange={(v) => update({ rcGoal: Number(v) })}
            options={[3, 5, 10].map((n) => ({ value: String(n), label: String(n) }))}
          />
          <Link to="/settings#reminders" className="text-xs text-accent hover:underline ml-auto">Add calendar nudges</Link>
        </div>

        <div className="border-t mt-4 pt-4" style={{ borderColor: 'var(--border)' }}>
          <div className="text-[11px] uppercase tracking-wide text-faint mb-2">Your dream signs</div>
          {scanned.length > 0 ? (
            <>
              <ul className="grid gap-2">
                {scanned.map((s) => (
                  <li key={s.name} className="text-sm">
                    <span className="font-medium">{s.name}</span>
                    {s.cue && <span className="text-muted block">{s.cue}</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-faint mt-3">
                From your last dream-sign scan. Each day one of them is the trigger.{' '}
                <Link to="/stats#lucid" className="text-accent hover:underline">See the dreams behind them or scan again</Link>
              </p>
            </>
          ) : signs.length === 0 ? (
            <p className="text-sm text-muted">
              None yet. A tag becomes a sign once it’s on two dreams, or <Link to="/stats#lucid" className="text-accent hover:underline">scan your recent dreams</Link> for signs with a cue each.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {signs.map((s) => (
                  <Link key={s.id} to={`/tag/${s.id}`} className="chip chip-btn">
                    {s.name} <span className="tabular-nums text-faint">{s.dreams}</span>
                  </Link>
                ))}
              </div>
              <p className="text-xs text-faint mt-2">
                Your most used tags. Each day one of them is the trigger.{' '}
                <Link to="/stats#lucid" className="text-accent hover:underline">Scan your recent dreams</Link> for signs with a cue each.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold mb-1">Missed cues</h2>
        <p className="text-xs text-muted mb-4">
          Moments in recent non-lucid dreams where something was off, or where you nearly asked the question. Found by keywords, so read them as prompts. These are what the night session rehearses.
        </p>
        {recent == null ? (
          <p className="text-sm text-muted">Looking…</p>
        ) : missed.length === 0 ? (
          <p className="text-sm text-muted">Nothing flagged in your last {recent.length} dreams. Writing down what felt strange, even in passing, gives this something to find.</p>
        ) : (
          <ul className="grid gap-2">
            {missed.map(({ dream, moments }) => (
              <li key={dream.id}>
                <Link to={`/dream/${dream.id}`} className="block rounded-xl px-3.5 py-3 hover:border-[var(--border-strong)]" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 mb-1">
                    <span className="text-sm font-medium truncate">{dream.title || 'Untitled'}</span>
                    <span className="text-xs text-faint shrink-0">{fmtDate(dream.date, 'MMM d')}</span>
                  </div>
                  {moments.map((m) => (
                    <p key={m.text} className="text-sm text-muted break-words mt-1">
                      <span className="chip mr-1.5 align-middle">{m.label}</span>“{m.text}”
                    </p>
                  ))}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-faint">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums tracking-tight mt-1" style={accent ? { color: 'var(--lucid)' } : undefined}>{value}</dd>
      <dd className="text-xs text-faint mt-0.5">{sub}</dd>
    </div>
  )
}
