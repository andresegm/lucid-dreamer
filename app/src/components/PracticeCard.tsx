import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MoonStar, Target } from 'lucide-react'
import { fetchTags } from '@/lib/api'
import { fetchSleepLogs, type SleepLog } from '@/lib/sleep'
import { addDays, loggedThisMorning, nextPlannedEvening, nightsDone, suggestWbtb, upcomingEvening, weekNights } from '@/lib/practice'
import { usePractice } from '@/lib/usePractice'
import { useSettings } from '@/lib/settings'
import { signsFromTags, type DreamSign } from '@/lib/signs'
import { useScannedSigns } from '@/lib/useScannedSigns'
import { findNearMisses } from '@/lib/nearMiss'
import { fmtDate, todayISO } from '@/lib/format'
import type { Dream } from '@/lib/types'
import { RealityCheck } from '@/components/RealityCheck'

/** Home: is tonight a practice night, today's reality-check trigger, and a cue missed in this morning's dream. */
export function PracticeCard({ recent }: { recent: Dream[] }) {
  const { settings } = useSettings()
  const today = todayISO()
  const since = useMemo(() => addDays(today, -14), [today])
  const { uid, days } = usePractice(since)
  const [signs, setSigns] = useState<DreamSign[]>([])
  const scanned = useScannedSigns()
  const [logs, setLogs] = useState<SleepLog[]>([])

  useEffect(() => {
    let cancelled = false
    fetchTags().then((tags) => { if (!cancelled) setSigns(signsFromTags(tags)) }).catch(() => {})
    fetchSleepLogs(14).then((rows) => { if (!cancelled) setLogs(rows) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const plan = settings.practiceNights
  const week = useMemo(() => weekNights(days, plan), [days, plan])
  const done = nightsDone(week)
  const tonight = upcomingEvening()
  const tonightState = week.find((n) => n.evening === tonight)?.state
  const next = nextPlannedEvening(plan)
  const alarm = useMemo(() => suggestWbtb(logs, settings.bedTime, settings.wakeTime).alarm, [logs, settings.bedTime, settings.wakeTime])
  const missed = useMemo(() => findNearMisses(recent.filter((d) => d.date === today), 1)[0] ?? null, [recent, today])

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="font-semibold flex items-center gap-2"><Target size={16} className="text-accent" /> Practice</h2>
        <Link to="/practice" className="text-xs text-muted hover:text-fg">
          {plan.length ? `${done} of ${plan.length} nights this week` : 'Plan the week'}
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="text-sm min-w-0 flex-1 basis-56">
          {loggedThisMorning(days) ? (
            'Last night’s session is logged. Write down whatever you remember, even if it’s nothing.'
          ) : tonightState === 'done' ? (
            'Tonight’s session is logged. Keep the phrase as you fall asleep.'
          ) : tonightState === 'tonight' ? (
            <>Tonight is a practice night. Set an alarm for <span className="font-semibold tabular-nums">{alarm}</span>, then open the night session when it rings.</>
          ) : next ? (
            <>Next practice night: <span className="font-semibold">{fmtDate(next, 'EEEE')}</span>. Tonight, sleep.</>
          ) : (
            'No practice nights planned. Two or three a week is where attempts start to add up.'
          )}
        </p>
        <Link to="/night" className="btn shrink-0"><MoonStar size={16} /> Night session</Link>
      </div>

      <div className="border-t mt-4 pt-4" style={{ borderColor: 'var(--border)' }}>
        <RealityCheck uid={uid} days={days} signs={signs} scanned={scanned} goal={settings.rcGoal} />
      </div>

      {missed && (
        <Link
          to={`/dream/${missed.dream.id}`}
          className="block rounded-xl px-3.5 py-3 mt-4 text-sm hover:border-[var(--border-strong)]"
          style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}
        >
          <span className="text-[11px] uppercase tracking-wide text-faint block mb-0.5">Missed cue this morning · {missed.moments[0].label.toLowerCase()}</span>
          <span className="break-words">“{missed.moments[0].text}”</span>
          <span className="text-xs text-muted block mt-1">That was your chance to notice. Rehearse catching it in tonight’s session.</span>
        </Link>
      )}
    </div>
  )
}
