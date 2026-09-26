import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, subDays, subWeeks } from 'date-fns'
import { BookOpen, Flame, Mic, Moon, Plus, Sparkles, Tags } from 'lucide-react'
import clsx from 'clsx'
import { fetchAllLite, fetchDreams, fetchRecallContext, setFavorite } from '@/lib/api'
import { fetchVoiceQuota, VOICE_DAILY_LIMIT } from '@/lib/voice'
import { pickMorningLine, type RecallContext } from '@/lib/recallTips'
import { computeStreaks } from '@/lib/stats'
import { useSettings } from '@/lib/settings'
import { EMPTY_FILTERS, type Dream, type DreamLite } from '@/lib/types'
import { fmtDate, todayISO } from '@/lib/format'
import { DreamCard } from '@/components/DreamCard'
import { ErrorBox, Skeleton } from '@/components/ui'

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
  const [cue, setCue] = useState<RecallContext | null>(null)
  const [voiceLeft, setVoiceLeft] = useState<number | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchAllLite(),
      fetchDreams({ ...EMPTY_FILTERS, includeNotes: settings.showNotesInList, sort: 'newest' }, 1, 4),
      fetchRecallContext(),
      fetchVoiceQuota(),
    ])
      .then(([all, page, ctx, quota]) => {
        if (cancelled) return
        setLite(all)
        setRecent(page.rows)
        setCue(ctx)
        setVoiceLeft(quota.remaining)
      })
      .catch((e) => { if (!cancelled) setError(e) })
    return () => { cancelled = true }
  }, [settings.showNotesInList])

  const today = todayISO()
  const wroteToday = (cue?.todayCount ?? 0) > 0
  const morning = cue ? pickMorningLine(cue) : null

  const kpis = useMemo(() => {
    if (!lite) return null
    const dreams = lite.filter((d) => d.entry_type === 'dream')
    const weekStart = subDays(new Date(), 6)
    const thisWeek = dreams.filter((d) => parseISO(d.date) >= weekStart).length
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
            {wroteToday ? 'You already caught tonight. Add another if more comes back.' : 'The first minute is the one that keeps the dream.'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/capture')}>
          <Plus size={16} /> Write now
        </button>
      </div>

      {morning && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}>
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--accent) 18%, transparent)', color: 'var(--accent)' }}>
              <Moon size={16} />
            </span>
            <div>
              <div className="font-medium">No dream yet today</div>
              <p className="text-sm text-muted mt-0.5">{morning}</p>
            </div>
          </div>
          <Link to="/stats#recall-tips" className="btn btn-ghost text-sm shrink-0">Recall tips</Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--gap)] mb-5">
        <Kpi icon={<Flame size={16} />} label="Streak" value={`${kpis.streak}d`} sub={kpis.streak ? 'keep the mornings going' : 'write tonight to start'} accent="#fb7185" />
        <Kpi icon={<BookOpen size={16} />} label="This week" value={String(kpis.thisWeek)} sub={`${kpis.total.toLocaleString()} dreams in all`} />
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
            <div className="grid gap-[var(--gap)]">
              {recent.map((d) => (
                <DreamCard key={d.id} dream={d} showPreview={settings.showPreview} onToggleFavorite={toggleFav} />
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
              <Link to="/stats#patterns" className="btn justify-start"><BookOpen size={16} /> Patterns</Link>
            </div>
          </section>
        </div>
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
    const map = new Map<string, { count: number; lucid: number }>()
    for (const d of dreams) {
      const cur = map.get(d.date) ?? { count: 0, lucid: 0 }
      cur.count++
      if (d.entry_type === 'dream' && d.lucidity !== 'non-lucid') cur.lucid++
      map.set(d.date, cur)
    }
    return { days: eachDayOfInterval({ start, end }), byDate: map }
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
              const level = !info ? 0 : info.count >= 3 ? 3 : info.count
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
