import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Flame, Moon, Sparkles, Star, TrendingUp, Trophy } from 'lucide-react'
import clsx from 'clsx'
import { fetchAllLite } from '@/lib/api'
import { EMOTIONS } from '@/lib/emotions'
import type { DreamLite, Lucidity } from '@/lib/types'
import { computeStats, trendSeries, type Granularity, type Range } from '@/lib/stats'
import { fmtDate } from '@/lib/format'
import { EmotionRadar, HBarList, Legend, Ring, StackedBars, type Slice } from '@/components/charts'
import { RecallCalendar } from '@/components/RecallCalendar'
import { RecallTipsCard } from '@/components/RecallTips'
import { ErrorBox, PageHeader, Segmented, Skeleton, Switch } from '@/components/ui'

type Panel = 'recall' | 'lucid' | 'patterns'

const PREF_KEY = 'ldj.stats.prefs'
interface Prefs { range: Range; includeNotes: boolean; series: Record<Lucidity, boolean>; granularity: Granularity | 'auto'; panel: Panel }
const DEFAULT_PREFS: Prefs = { range: 'all', includeNotes: false, series: { lucid: true, 'semi-lucid': true, 'non-lucid': true }, granularity: 'auto', panel: 'lucid' }

const COLORS = { lucid: 'var(--lucid)', semi: 'var(--semi)', non: 'var(--nonlucid)' }
const METHOD_PALETTE = ['var(--accent)', 'var(--lucid)', 'var(--semi)', '#34d399', '#fb7185', '#e879f9', '#94a3b8', '#f97316']

function panelFromHash(hash: string): Panel | null {
  if (hash === '#recall' || hash === '#recall-tips') return 'recall'
  if (hash === '#lucid') return 'lucid'
  if (hash === '#patterns') return 'patterns'
  return null
}

export function StatsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [data, setData] = useState<DreamLite[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [prefs, setPrefs] = useState<Prefs>(() => {
    let base = DEFAULT_PREFS
    try { base = { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') } } catch { /* ignore */ }
    return panelFromHash(window.location.hash) ? { ...base, panel: panelFromHash(window.location.hash)! } : base
  })
  useEffect(() => localStorage.setItem(PREF_KEY, JSON.stringify(prefs)), [prefs])
  useEffect(() => { fetchAllLite().then(setData).catch(setError) }, [])
  useEffect(() => {
    const next = panelFromHash(location.hash)
    if (next && next !== prefs.panel) setPrefs((p) => ({ ...p, panel: next }))
  }, [location.hash]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => (data ? computeStats({ dreams: data, range: prefs.range, includeNotes: prefs.includeNotes, series: prefs.series }) : null), [data, prefs])
  const granularity: Granularity = prefs.granularity === 'auto' ? stats?.autoGranularity ?? 'month' : prefs.granularity
  const trend = useMemo(() => (stats ? trendSeries(stats.shown, granularity, prefs.range) : []), [stats, granularity, prefs.range])

  if (error) return <ErrorBox error={error} />
  if (!stats)
    return (
      <div>
        <PageHeader title="Stats" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-[var(--gap)]">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    )

  const { byLucidity, onlyDreams, shown, lucidCount, induction, streaks, weekday, topTags, pairs, perWeek, bestMonth, favorites } = stats
  const total = onlyDreams.length
  const lucidPct = total ? Math.round((lucidCount / total) * 100) : 0
  const emotionCounts = EMOTIONS.map((e) => ({
    ...e,
    n: shown.filter((d) => d.tags.some((t) => t.name.toLowerCase() === e.name)).length,
  }))
  const emotionHits = emotionCounts.filter((e) => e.n > 0)
  const emotionDreams = shown.filter((d) => d.tags.some((t) => EMOTIONS.some((e) => e.name === t.name.toLowerCase()))).length

  const lucSlices: Slice[] = [
    { name: 'Lucid', value: byLucidity.lucid, color: COLORS.lucid },
    { name: 'Semi-lucid', value: byLucidity['semi-lucid'], color: COLORS.semi },
    { name: 'Non-lucid', value: byLucidity['non-lucid'], color: COLORS.non },
  ].filter((s) => prefs.series[s.name === 'Lucid' ? 'lucid' : s.name === 'Semi-lucid' ? 'semi-lucid' : 'non-lucid'])

  const indSlices: Slice[] = Array.from(induction.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: METHOD_PALETTE[i % METHOD_PALETTE.length] }))

  const seriesDefs = [
    { key: 'non', color: COLORS.non, name: 'Non-lucid', on: prefs.series['non-lucid'] },
    { key: 'semi', color: COLORS.semi, name: 'Semi-lucid', on: prefs.series['semi-lucid'] },
    { key: 'lucid', color: COLORS.lucid, name: 'Lucid', on: prefs.series.lucid },
  ].filter((s) => s.on)

  const toggleSeries = (k: Lucidity) => setPrefs((p) => ({ ...p, series: { ...p.series, [k]: !p.series[k] } }))
  const setPanel = (panel: Panel) => {
    setPrefs((p) => ({ ...p, panel }))
    if (location.hash !== `#${panel}`) navigate({ pathname: '/stats', hash: panel }, { replace: true })
  }
  const openTag = (name: string) => {
    const id = shown.flatMap((d) => d.tags).find((t) => t.name.toLowerCase() === name)?.id
    if (id) navigate(`/?tags=${id}`)
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Stats"
        subtitle={`${total.toLocaleString()} dreams${prefs.range !== 'all' ? ' in range' : ''} · ${lucidPct}% lucid`}
        actions={
          <Segmented<Range>
            value={prefs.range}
            onChange={(range) => setPrefs((p) => ({ ...p, range }))}
            options={[{ value: '30d', label: '30d' }, { value: '3m', label: '3m' }, { value: '6m', label: '6m' }, { value: '1y', label: '1y' }, { value: 'all', label: 'All' }]}
          />
        }
      />

      <div className="card mb-4 flex flex-wrap items-center gap-x-5 gap-y-3" style={{ padding: '.75rem 1rem' }}>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted mr-1">Show</span>
          {(['lucid', 'semi-lucid', 'non-lucid'] as Lucidity[]).map((k) => (
            <button key={k} className={clsx('chip chip-btn', prefs.series[k] && 'chip-active')} onClick={() => toggleSeries(k)}>
              <span className="h-2 w-2 rounded-full" style={{ background: k === 'lucid' ? COLORS.lucid : k === 'semi-lucid' ? COLORS.semi : COLORS.non, opacity: prefs.series[k] ? 1 : 0.4 }} />
              {k === 'lucid' ? 'Lucid' : k === 'semi-lucid' ? 'Semi' : 'Non-lucid'}
            </button>
          ))}
        </div>
        {prefs.panel === 'lucid' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Trend</span>
            <Segmented<Granularity | 'auto'> value={prefs.granularity} onChange={(granularity) => setPrefs((p) => ({ ...p, granularity }))} options={[{ value: 'auto', label: 'Auto' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }]} />
          </div>
        )}
        <div className="ml-auto">
          <Switch checked={prefs.includeNotes} onChange={(includeNotes) => setPrefs((p) => ({ ...p, includeNotes }))} label={<span className="text-muted text-xs">Count notes in streaks</span>} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--gap)] mb-4">
        <Kpi icon={<Moon size={16} />} label="Dreams" value={total.toLocaleString()} sub={`${perWeek.toFixed(1)} / week`} />
        <Kpi icon={<Sparkles size={16} />} label="Lucid" value={lucidCount.toLocaleString()} sub={`${lucidPct}% of dreams`} accent="var(--lucid)" />
        <Kpi icon={<Flame size={16} />} label="Current streak" value={`${streaks.current}d`} sub={streaks.lastEntry ? `last: ${fmtDate(streaks.lastEntry, 'MMM d')}` : '—'} accent="#fb7185" />
        <Kpi icon={<Trophy size={16} />} label="Longest streak" value={`${streaks.longest}d`} sub={bestMonth ? `best month: ${fmtDate(bestMonth[0] + '-01', 'MMM yyyy')} (${bestMonth[1]})` : '—'} accent="#34d399" />
      </div>

      <div className="mb-4">
        <Segmented<Panel>
          className="w-full max-w-md [&>button]:flex-1"
          value={prefs.panel}
          onChange={setPanel}
          options={[
            { value: 'recall', label: 'Recall' },
            { value: 'lucid', label: 'Lucid' },
            { value: 'patterns', label: 'Patterns' },
          ]}
        />
      </div>

      {prefs.panel === 'recall' && (
        <div className="grid gap-4 fade-in">
          <p className="text-sm text-muted -mt-1">Mornings you remembered — and how to remember more.</p>
          <RecallCalendar
            dreams={(data ?? []).filter((d) => prefs.includeNotes || d.entry_type === 'dream')}
            range={prefs.range}
            onSelectDay={(iso) => navigate(`/?from=${iso}&to=${iso}`)}
          />
          <div className="card">
            <h2 className="font-semibold mb-1">By weekday</h2>
            <p className="text-xs text-muted mb-3">Which mornings you remember — and when lucidity happens.</p>
            <StackedBars
              data={weekday.map((w) => ({ label: w.label, non: w.total - w.lucid, lucid: w.lucid }))}
              series={[{ key: 'non', color: COLORS.non, name: 'Non-lucid' }, { key: 'lucid', color: COLORS.lucid, name: 'Lucid' }]}
              height={200}
            />
          </div>
          <RecallTipsCard />
        </div>
      )}

      {prefs.panel === 'lucid' && (
        <div className="grid gap-4 fade-in">
          <p className="text-sm text-muted -mt-1">How often you notice you’re dreaming, and which methods show up.</p>
          <div className="grid lg:grid-cols-2 gap-[var(--gap)]">
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Lucidity</h2>
                <span className="text-xs text-muted">{total} dreams</span>
              </div>
              <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-center">
                <Ring data={lucSlices} center={`${lucidPct}%`} sub="lucid or semi" />
                <Legend data={lucSlices} />
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Induction methods</h2>
                <span className="text-xs text-muted">{lucidCount} lucid dreams</span>
              </div>
              {indSlices.length ? (
                <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-center">
                  <Ring data={indSlices} center={indSlices[0]?.name ?? '—'} sub="most common" />
                  <Legend data={indSlices} />
                </div>
              ) : (
                <div className="text-sm text-faint py-10 text-center">No lucid dreams in this range yet.</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2"><TrendingUp size={16} className="text-accent" /> Dreams over time</h2>
              <span className="text-xs text-muted">per {granularity}</span>
            </div>
            {seriesDefs.length ? <StackedBars data={trend} series={seriesDefs} height={240} /> : <div className="text-sm text-faint py-10 text-center">Turn on at least one series above.</div>}
          </div>
        </div>
      )}

      {prefs.panel === 'patterns' && (
        <div className="grid gap-4 fade-in">
          <p className="text-sm text-muted -mt-1">Feelings, recurring tags, and pairs that show up together more than chance.</p>
          <div className="grid lg:grid-cols-2 gap-[var(--gap)]">
            <div className="card">
              <h2 className="font-semibold mb-1">How dreams felt</h2>
              <p className="text-xs text-muted mb-3">
                The shape stretches toward whatever you tagged most.
                {emotionDreams ? ` ${emotionDreams} ${emotionDreams === 1 ? 'dream' : 'dreams'} tagged.` : ''}
              </p>
              {emotionHits.length ? (
                <div>
                  <EmotionRadar items={emotionCounts} onSelect={openTag} />
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {emotionHits.map((e) => (
                      <button key={e.name} type="button" className="chip chip-btn" onClick={() => openTag(e.name)}>
                        {e.label} <span className="tabular-nums text-faint">{e.n}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-faint py-10 text-center">
                  No feeling tags in this range yet.{' '}
                  <Link to="/settings#emotion-scan" className="text-accent hover:underline">Scan older dreams</Link>
                  {' '}or tap chips the next time you write.
                </div>
              )}
            </div>
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Top tags</h2>
                <span className="text-xs text-muted flex items-center gap-1"><Star size={12} /> {favorites} favorites</span>
              </div>
              {topTags.length ? (
                <HBarList items={topTags.map((t) => ({ label: t.name, value: t.n, onClick: () => navigate(`/?tags=${t.id}`) }))} />
              ) : (
                <div className="text-sm text-faint py-10 text-center">No tags yet — add some when you record a dream.</div>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold mb-1">What shows up together</h2>
            <p className="text-xs text-muted mb-3">× is lift — 2× means twice the independent rate. Click a pair to open those dreams.</p>
            {pairs.length ? (
              <ul className="grid sm:grid-cols-2 gap-2">
                {pairs.map((p) => (
                  <li key={`${p.a.id}-${p.b.id}`}>
                    <button
                      type="button"
                      className="w-full text-left card card-hover"
                      style={{ padding: '.65rem .8rem' }}
                      onClick={() => navigate(`/?tags=${p.a.id},${p.b.id}&tm=all`)}
                    >
                      <div className="font-medium truncate">{p.a.name} <span className="text-faint font-normal">·</span> {p.b.name}</div>
                      <div className="text-xs text-muted mt-0.5 tabular-nums">{p.together} dreams · {p.lift.toFixed(1)}×</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-faint py-8 text-center">Need more overlapping tags in this range.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${accent ?? 'var(--accent)'} 18%, transparent)`, color: accent ?? 'var(--accent)' }}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-2 leading-none">{value}</div>
      {sub && <div className="text-xs text-faint mt-1.5 truncate">{sub}</div>}
    </div>
  )
}
