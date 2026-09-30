import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, subDays, subWeeks } from 'date-fns'
import { BookOpen, Check, Flame, GraduationCap, Mic, Pencil, Plus, Sparkles, Tags } from 'lucide-react'
import clsx from 'clsx'
import { fetchAllLite, fetchDreams, setFavorite } from '@/lib/api'
import { fetchVoiceQuota, VOICE_DAILY_LIMIT } from '@/lib/voice'
import { computeStreaks, heatLevel, recallByDate } from '@/lib/stats'
import { useSettings } from '@/lib/settings'
import { EMPTY_FILTERS, type Dream, type DreamLite } from '@/lib/types'
import { fmtDate, todayISO } from '@/lib/format'
import { groupNights } from '@/lib/nights'
import { DreamCard } from '@/components/DreamCard'
import { MorningCue } from '@/components/RecallTips'
import { ErrorBox, Skeleton } from '@/components/ui'
import type { RecallContext } from '@/lib/recallTips'

function greeting(now = new Date()) {
  const h = now.getHours()
  if (h < 5) return 'Still night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [lite, setLite] = useState<DreamLite[] | null>(null)
  const [recent, setRecent] = useState<Dream[]>([])
  const [voiceLeft, setVoiceLeft] = useState<number | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchAllLite(),
      fetchDreams({ ...EMPTY_FILTERS, includeNotes: settings.showNotesInList, sort: 'newest' }, 1, 4),
      fetchVoiceQuota(),
    ])
      .then(([all, page, quota]) => {
        if (cancelled) return
        setLite(all)
        setRecent(page.rows)
        setVoiceLeft(quota.remaining)
      })
      .catch((e) => { if (!cancelled) setError(e) })
    return () => { cancelled = true }
  }, [settings.showNotesInList])

  const today = todayISO()
  const cue = useMemo<RecallContext | null>(() => {
    if (!lite) return null
    const dreams = lite.filter((d) => d.entry_type === 'dream')
    const recentDreams = dreams.slice(-30)
    return {
      todayCount: lite.filter((d) => d.date === today).length,
      lastDate: dreams.length ? dreams[dreams.length - 1].date : null,
      recentCount: recentDreams.length,
      recentLucid: recentDreams.filter((d) => d.lucidity !== 'non-lucid').length,
    }
  }, [lite, today])
  const wroteToday = (cue?.todayCount ?? 0) > 0

  const kpis = useMemo(() => {
    if (!lite) return null
    const dreams = lite.filter((d) => d.entry_type === 'dream')
    const weekStart = subDays(new Date(), 6)
    const thisWeek = new Set(dreams.filter((d) => parseISO(d.date) >= weekStart).map((d) => d.date)).size
    const lucid = dreams.filter((d) => d.lucidity !== 'non-lucid').length
    const lucidPct = dreams.length ? Math.round((lucid / dreams.length) * 100) : 0
    const streaks = computeStreaks(lite.filter((d) => settings.showNotesInList || d.entry_type === 'dream').map((d) => d.date))
    return { total: dreams.length, thisWeek, lucidPct, streak: streaks.current }
  }, [lite, settings.showNotesInList])

  async function toggleFav(d: Dream) {
    setRecent((rs) => rs.map((r) => (r.id === d.id ? { ...r, favorite: !r.favorite } : r)))
    try {
      await setFavorite(d.id, !d.favorite)
    } catch {
      setRecent((rs) => rs.map((r) => (r.id === d.id ? { ...r, favorite: d.favorite } : r)))
    }
  }

  if (error) return <ErrorBox error={error} />
  if (!lite || !kpis)
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--gap)] mb-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    )

  return (
    <div className="fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted mb-1">{fmtDate(today, 'EEEE, MMM d')}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{greeting()}</h1>
          <p className="text-sm text-muted mt-1">
            {wroteToday
              ? cue && cue.todayCount > 1
                ? `You’ve logged ${cue.todayCount} dreams for today. Add another if more comes back.`
                : 'You’ve already logged a dream for today. Add another if more comes back.'
              : 'The first minute after waking is the one that keeps the dream.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/capture')}>
          <Plus size={16} /> Write now
        </button>
      </div>

      <TonightCard />

      <MorningCue ctx={cue} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--gap)] mb-5">
        <Kpi icon={<Flame size={16} />} label="Streak" value={`${kpis.streak}d`} sub={kpis.streak ? 'keep the mornings going' : 'write tonight to start'} accent="#fb7185" />
        <Kpi icon={<BookOpen size={16} />} label="Nights this week" value={String(kpis.thisWeek)} sub={`${kpis.total.toLocaleString()} dreams in all`} />
        <Kpi icon={<Sparkles size={16} />} label="Lucid" value={`${kpis.lucidPct}%`} sub="of every dream" accent="var(--lucid)" />
        <Kpi icon={<Mic size={16} />} label="Voice today" value={voiceLeft == null ? '—' : `${voiceLeft}`} sub={`${VOICE_DAILY_LIMIT} recordings / day`} />
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4 mb-5">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent</h2>
            <Link to="/dreams" className="text-sm text-muted hover:text-fg">All dreams</Link>
          </div>
          {recent.length === 0 ? (
            <div className="card text-center py-10">
              <p className="font-medium">Nothing written yet</p>
              <p className="text-sm text-muted mt-1 mb-4">A single image is enough for the first entry.</p>
              <button className="btn btn-primary" onClick={() => navigate('/capture')}><Plus size={16} /> Write now</button>
            </div>
          ) : (
            <div className="grid gap-5">
              {groupNights(recent).map((night) => (
                <section key={night.date}>
                  {night.items.length > 1 && (
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                      {fmtDate(night.date, 'EEE, MMM d')} · {night.items.length} entries
                    </h3>
                  )}
                  <div className="grid gap-[var(--gap)]">
                    {night.items.map((d, i) => (
                      <DreamCard
                        key={d.id}
                        dream={d}
                        showPreview={settings.showPreview}
                        onToggleFavorite={toggleFav}
                        hideDate={night.items.length > 1 && i > 0}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4 content-start">
          <section className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Last 12 weeks</h2>
              <Link to="/stats#recall" className="text-xs text-muted hover:text-fg">Full calendar</Link>
            </div>
            <SparkRecall dreams={lite} onSelect={(iso) => navigate(`/dreams?from=${iso}&to=${iso}`)} />
          </section>

          <section className="card">
            <h2 className="font-semibold mb-3">Jump</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/new" className="btn justify-start"><Plus size={16} /> New dream</Link>
              <Link to="/tags" className="btn justify-start"><Tags size={16} /> Tags</Link>
              <Link to="/stats#lucid" className="btn justify-start"><Sparkles size={16} /> Lucid</Link>
              <Link to="/learn" className="btn justify-start"><GraduationCap size={16} /> Learn</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function TonightCard() {
  const { settings, update } = useSettings()
  const today = todayISO()
  const locked = settings.tonightWrittenOn === today
  const text = settings.tonightText.trim()
  const canLock = text.length > 0

  function lock() {
    if (!canLock) return
    update({ tonightText: text, tonightWrittenOn: today })
  }

  function unlock() {
    update({ tonightWrittenOn: null })
  }

  return (
    <div
      className="card mb-4"
      style={locked ? { borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)' } : undefined}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-semibold">Tonight’s intention</h2>
        {locked && (
          <span className="inline-flex items-center gap-1 text-xs font-medium shrink-0" style={{ color: 'var(--accent)' }}>
            <Check size={14} /> Set for tonight
          </span>
        )}
      </div>
      <p className="text-xs text-muted mb-3">
        {locked
          ? 'Locked until tomorrow. Hold this as you fall asleep.'
          : 'One short line to remember as you fall asleep — then lock it so it stays put.'}
      </p>

      {locked ? (
        <div className="rounded-xl px-3.5 py-3 text-sm leading-relaxed" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}>
          {text || '—'}
        </div>
      ) : (
        <input
          className="input"
          placeholder="When I see a clock, I’ll ask if I’m dreaming"
          value={settings.tonightText}
          onChange={(e) => update({ tonightText: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              lock()
            }
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        {locked ? (
          <button type="button" className="btn btn-ghost text-sm" onClick={unlock}>
            <Pencil size={14} /> Edit intention
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!canLock} onClick={lock}>
            <Check size={16} /> Lock for tonight
          </button>
        )}
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, sub, accent }: { icon: ReactNode; label: string; value: string; sub: string; accent?: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-xs text-muted mb-2">
        <span style={{ color: accent ?? 'var(--accent)' }}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      <div className="text-xs text-faint mt-1">{sub}</div>
    </div>
  )
}

function SparkRecall({ dreams, onSelect }: { dreams: DreamLite[]; onSelect: (iso: string) => void }) {
  const { days, byDate } = useMemo(() => {
    const end = endOfWeek(new Date(), { weekStartsOn: 1 })
    const start = startOfWeek(subWeeks(end, 11), { weekStartsOn: 1 })
    return { days: eachDayOfInterval({ start, end }), byDate: recallByDate(dreams) }
  }, [dreams])

  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  return (
    <div>
      <div className="cal-year flex gap-[3px]">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-rows-7 gap-[3px] flex-1 min-w-0">
            {week.map((d) => {
              const iso = format(d, 'yyyy-MM-dd')
              const info = byDate.get(iso)
              const level = heatLevel(info?.count ?? 0)
              return (
                <button
                  key={iso}
                  type="button"
                  title={info ? `${fmtDate(iso, 'MMM d')} · ${info.count}` : fmtDate(iso, 'MMM d')}
                  className={clsx('cal-cell w-full')}
                  data-level={level}
                  data-lucid={info?.lucid ? 'true' : undefined}
                  disabled={!info}
                  onClick={() => info && onSelect(iso)}
                />
              )
            })}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-faint mt-3">Gold marks a lucid or semi-lucid morning.</p>
    </div>
  )
}
