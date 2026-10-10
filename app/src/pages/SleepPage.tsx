import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlarmClock, BedDouble, Check, Moon, Sun, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import {
  SLEEP_CHECKLIST,
  checklistDone,
  deleteSleepLog,
  emptySleepLog,
  fetchSleepLog,
  fetchSleepLogs,
  fmtMinutes,
  saveSleepLog,
  summarize,
  timeInBed,
  type ChecklistKey,
  type SleepLog,
} from '@/lib/sleep'
import { fmtDate, todayISO } from '@/lib/format'
import { ErrorBox, Field, Kpi, PageHeader, Segmented, Spinner, UseToday } from '@/components/ui'

const RESTED_LABELS = ['', 'Exhausted', 'Tired', 'Okay', 'Rested', 'Refreshed']

type YesNo = 'yes' | 'no' | ''
const toYesNo = (v: boolean | null): YesNo => (v == null ? '' : v ? 'yes' : 'no')
const fromYesNo = (v: YesNo): boolean | null => (v === '' ? null : v === 'yes')

export function SleepPage() {
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || todayISO()
  const [log, setLog] = useState<SleepLog | null>(null)
  const [saved, setSaved] = useState<SleepLog | null>(null)
  const [history, setHistory] = useState<SleepLog[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const loadHistory = useCallback(() => {
    fetchSleepLogs(30).then(setHistory).catch(setError)
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => {
    let cancelled = false
    setLog(null)
    setJustSaved(false)
    fetchSleepLog(date)
      .then((row) => {
        if (cancelled) return
        setLog(row ?? emptySleepLog(date))
        setSaved(row)
      })
      .catch((e) => { if (!cancelled) setError(e) })
    return () => { cancelled = true }
  }, [date])

  const dirty = useMemo(() => {
    if (!log) return false
    return fingerprint(log) !== fingerprint(saved ?? emptySleepLog(date))
  }, [log, saved, date])

  function set<K extends keyof SleepLog>(key: K, value: SleepLog[K]) {
    setJustSaved(false)
    setLog((l) => (l ? { ...l, [key]: value } : l))
  }

  function toggleCheck(key: ChecklistKey) {
    if (!log) return
    set('checklist', { ...log.checklist, [key]: !log.checklist[key] })
  }

  function setDate(next: string) {
    setParams(next === todayISO() ? {} : { date: next }, { replace: true })
  }

  async function save() {
    if (!log) return
    setSaving(true)
    setError(null)
    try {
      const row = await saveSleepLog(log)
      setLog(row)
      setSaved(row)
      setJustSaved(true)
      loadHistory()
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!saved || !window.confirm(`Delete the sleep log for ${fmtDate(date, 'MMM d')}?`)) return
    try {
      await deleteSleepLog(date)
      setLog(emptySleepLog(date))
      setSaved(null)
      loadHistory()
    } catch (e) {
      setError(e)
    }
  }

  const week = useMemo(() => summarize((history ?? []).slice(0, 7)), [history])
  const inBed = log ? timeInBed(log.bed_time, log.wake_time) : null
  const done = log ? checklistDone(log) : 0

  return (
    <div className="max-w-3xl fade-in">
      <PageHeader
        title="Sleep"
        subtitle="A short log each morning. Patterns show up after a week or two."
        actions={
          <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? <Spinner /> : <Check size={16} />} {justSaved && !dirty ? 'Saved' : 'Save'}
          </button>
        }
      />

      {error ? <div className="mb-4"><ErrorBox error={error} /></div> : null}

      {history && history.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--gap)] mb-5">
          <Kpi icon={<BedDouble size={16} />} label="Time in bed" value={fmtMinutes(week.avgInBed)} sub={`average, last ${week.nights} logs`} />
          <Kpi icon={<Moon size={16} />} label="Sleep" value={fmtMinutes(week.avgSleep)} sub="your estimate, average" />
          <Kpi icon={<Sun size={16} />} label="Rested" value={week.avgRested == null ? '—' : `${week.avgRested.toFixed(1)}/5`} sub="morning average" accent="var(--lucid)" />
          <Kpi
            icon={<AlarmClock size={16} />}
            label="Wake-up spread"
            value={fmtMinutes(week.wakeSpread)}
            sub={week.wakeSpread == null ? 'needs two logs' : week.wakeSpread <= 30 ? 'within 30 minutes' : 'aim for under 30 minutes'}
            accent={week.wakeSpread != null && week.wakeSpread > 30 ? '#fb7185' : undefined}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          Morning of
          <input type="date" className="input py-1.5 w-auto" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <UseToday date={date} onClick={() => setDate(todayISO())} />
        {saved && <span className="text-xs text-faint ml-auto">Logged</span>}
      </div>

      {!log ? (
        <div className="flex items-center gap-2 text-muted"><Spinner /> Loading…</div>
      ) : (
        <div className="grid gap-4">
          <section className="card">
            <h2 className="font-semibold mb-4">The night</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bed time">
                <input type="time" className="input" value={log.bed_time ?? ''} onChange={(e) => set('bed_time', e.target.value || null)} />
              </Field>
              <Field label="Wake-up time">
                <input type="time" className="input" value={log.wake_time ?? ''} onChange={(e) => set('wake_time', e.target.value || null)} />
              </Field>
            </div>
            <p className="text-xs text-muted mt-2">
              Time in bed: <span className="text-fg font-medium tabular-nums">{fmtMinutes(inBed)}</span>
              {inBed != null && (inBed >= 480 ? ' · enough room for 8 hours' : ' · short of the 8–8.5 hour window')}
            </p>
            <Field label="Woke up with" className="mt-4">
              <Segmented<YesNo>
                value={toYesNo(log.alarm)}
                onChange={(v) => set('alarm', fromYesNo(v))}
                options={[{ value: 'yes', label: 'Alarm' }, { value: 'no', label: 'No alarm' }]}
              />
            </Field>
          </section>

          <section className="card">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="font-semibold">Daily checklist</h2>
              <span className="text-xs text-muted tabular-nums">{done} of {SLEEP_CHECKLIST.length}</span>
            </div>
            <p className="text-xs text-muted mb-3">Yesterday evening and this morning.</p>
            <ul className="grid gap-1">
              {SLEEP_CHECKLIST.map((c) => {
                const on = Boolean(log.checklist[c.key])
                return (
                  <li key={c.key}>
                    <label className="flex items-start gap-3 rounded-xl px-2 py-2 cursor-pointer select-none hover:bg-[var(--bg-elev-2)]">
                      <input type="checkbox" className="mt-0.5 accent-[var(--accent)] h-4 w-4 shrink-0" checked={on} onChange={() => toggleCheck(c.key)} />
                      <span className="min-w-0">
                        <span className={clsx('text-sm block', on && 'text-muted line-through decoration-[var(--text-faint)]')}>{c.label}</span>
                        <span className="text-xs text-faint block">{c.hint}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="card">
            <h2 className="font-semibold mb-1">Lucid practice</h2>
            <p className="text-xs text-muted mb-3">
              Wake Back To Bed and other planned wake-ups cost sleep. Logging them shows whether they’re worth it.
            </p>
            <Field label="Did WBTB or a planned wake-up last night?">
              <Segmented<YesNo>
                value={toYesNo(log.wbtb)}
                onChange={(v) => set('wbtb', fromYesNo(v))}
                options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
              />
            </Field>
          </section>

          <section className="card">
            <h2 className="font-semibold mb-4">How it went</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Awakenings">
                <NumberInput value={log.awakenings} max={50} onChange={(v) => set('awakenings', v)} placeholder="0" />
              </Field>
              <Field label="Total sleep (est.)">
                <DurationInput value={log.total_sleep_min} onChange={(v) => set('total_sleep_min', v)} />
              </Field>
              <Field label="Garmin REM">
                <DurationInput value={log.rem_min} onChange={(v) => set('rem_min', v)} />
              </Field>
            </div>
            <Field label="Morning restedness" className="mt-4">
              <Segmented<string>
                value={log.rested == null ? '' : String(log.rested)}
                onChange={(v) => set('rested', log.rested === Number(v) ? null : Number(v))}
                options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
              />
              <p className="text-xs text-faint mt-1.5">{log.rested ? RESTED_LABELS[log.rested] : '1 is exhausted, 5 is fully refreshed.'}</p>
            </Field>
            <Field label="Notes" className="mt-4">
              <textarea
                className="input min-h-[5rem]"
                placeholder="Late screen, noisy street, woke from a dream at 4…"
                value={log.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </Field>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? <Spinner /> : <Check size={16} />} {justSaved && !dirty ? 'Saved' : 'Save'}
            </button>
            {saved && (
              <button type="button" className="btn btn-ghost btn-danger ml-auto" onClick={() => void remove()}>
                <Trash2 size={16} /> Delete log
              </button>
            )}
          </div>
        </div>
      )}

      {history && history.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold mb-3">Recent nights</h2>
          <ul className="grid gap-2">
            {history.map((h) => {
              const bed = timeInBed(h.bed_time, h.wake_time)
              return (
                <li key={h.date}>
                  <button
                    type="button"
                    onClick={() => { setDate(h.date); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    className={clsx('card card-hover w-full text-left flex flex-wrap items-center gap-x-4 gap-y-1', h.date === date && 'border-[var(--accent)]')}
                    style={{ padding: '.7rem 1rem' }}
                  >
                    <span className="font-medium w-24 shrink-0">{fmtDate(h.date, 'EEE, MMM d')}</span>
                    <span className="text-sm text-muted tabular-nums">{h.bed_time ?? '—'} → {h.wake_time ?? '—'}</span>
                    <span className="text-sm tabular-nums">{fmtMinutes(bed)}</span>
                    {h.rested != null && <span className="text-sm text-muted">rested {h.rested}/5</span>}
                    {h.rem_min != null && <span className="text-sm text-muted">REM {fmtMinutes(h.rem_min)}</span>}
                    <span className="ml-auto flex items-center gap-1.5">
                      {h.alarm && <span className="chip"><AlarmClock size={11} /> alarm</span>}
                      {h.wbtb && <span className="chip">WBTB</span>}
                      <span className="chip tabular-nums">{checklistDone(h)}/{SLEEP_CHECKLIST.length}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function fingerprint(l: SleepLog): string {
  return JSON.stringify([
    l.bed_time, l.wake_time, l.alarm, l.wbtb, l.awakenings, l.total_sleep_min, l.rem_min, l.rested, l.notes,
    SLEEP_CHECKLIST.map((c) => Boolean(l.checklist[c.key])),
  ])
}

function NumberInput({ value, onChange, max, placeholder }: { value: number | null; onChange: (v: number | null) => void; max: number; placeholder?: string }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      className="input"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const n = e.target.value === '' ? null : Math.min(max, Math.max(0, Math.round(Number(e.target.value))))
        onChange(n != null && Number.isFinite(n) ? n : null)
      }}
    />
  )
}

/** Hours and minutes, stored as total minutes. */
function DurationInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const h = value == null ? '' : String(Math.floor(value / 60))
  const m = value == null ? '' : String(value % 60)
  function update(nextH: string, nextM: string) {
    if (nextH === '' && nextM === '') return onChange(null)
    const hours = Math.min(24, Math.max(0, Number(nextH) || 0))
    const mins = Math.min(59, Math.max(0, Number(nextM) || 0))
    onChange(hours * 60 + mins)
  }
  return (
    <div className="flex items-center gap-1.5">
      <input type="number" inputMode="numeric" min={0} max={24} className="input min-w-0 px-2 text-center" placeholder="h" value={h} onChange={(e) => update(e.target.value, m)} aria-label="Hours" />
      <span className="text-faint text-xs">h</span>
      <input type="number" inputMode="numeric" min={0} max={59} className="input min-w-0 px-2 text-center" placeholder="m" value={m} onChange={(e) => update(h, e.target.value)} aria-label="Minutes" />
      <span className="text-faint text-xs">m</span>
    </div>
  )
}
