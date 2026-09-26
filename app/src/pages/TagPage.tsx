import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { fetchDreams, fetchTag, setFavorite } from '@/lib/api'
import { EMPTY_FILTERS, type Dream, type Lucidity, type Tag } from '@/lib/types'
import { fmtDate, lucidityLabel, tagChipStyle } from '@/lib/format'
import { useSettings } from '@/lib/settings'
import { DreamCard } from '@/components/DreamCard'
import { ErrorBox, Skeleton } from '@/components/ui'

export function TagPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [tag, setTag] = useState<Tag | null>(null)
  const [dreams, setDreams] = useState<Dream[] | null>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (!id) return
    setError(null)
    setDreams(null)
    Promise.all([
      fetchTag(id),
      fetchDreams({ ...EMPTY_FILTERS, tags: [id], includeNotes: true, sort: 'oldest' }, 1, 400),
    ])
      .then(([t, page]) => {
        setTag(t)
        setDreams(page.rows)
      })
      .catch(setError)
  }, [id])

  const stats = useMemo(() => {
    if (!dreams?.length) return null
    const only = dreams.filter((d) => d.entry_type === 'dream')
    const byLuc: Record<Lucidity, number> = { lucid: 0, 'semi-lucid': 0, 'non-lucid': 0 }
    for (const d of only) byLuc[d.lucidity]++
    const others = new Map<string, { tag: { id: string; name: string; color: string | null }; n: number }>()
    for (const d of dreams) {
      for (const t of d.tags) {
        if (t.id === id) continue
        const cur = others.get(t.id) ?? { tag: t, n: 0 }
        cur.n++
        others.set(t.id, cur)
      }
    }
    const related = [...others.values()].sort((a, b) => b.n - a.n).slice(0, 8)
    return {
      nights: new Set(dreams.map((d) => d.date)).size,
      first: dreams[0].date,
      last: dreams[dreams.length - 1].date,
      byLuc,
      related,
    }
  }, [dreams, id])

  async function toggleFav(d: Dream) {
    setDreams((rs) => rs?.map((r) => (r.id === d.id ? { ...r, favorite: !r.favorite } : r)) ?? null)
    try {
      await setFavorite(d.id, !d.favorite)
    } catch {
      setDreams((rs) => rs?.map((r) => (r.id === d.id ? { ...r, favorite: d.favorite } : r)) ?? null)
    }
  }

  if (error) return <ErrorBox error={error} />
  if (!tag || !dreams)
    return (
      <div>
        <Skeleton className="h-5 w-24 mb-6" />
        <Skeleton className="h-8 w-1/3 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    )

  return (
    <div className="fade-in">
      <button className="btn btn-ghost -ml-2 mb-4" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/tags'))}>
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={tag.color ? { color: tag.color } : undefined}>{tag.name}</h1>
          <p className="text-sm text-muted mt-1">
            {dreams.length.toLocaleString()} {dreams.length === 1 ? 'entry' : 'entries'}
            {stats ? ` · ${stats.nights} ${stats.nights === 1 ? 'night' : 'nights'}` : ''}
            {stats ? ` · ${fmtDate(stats.first, 'MMM yyyy')}–${fmtDate(stats.last, 'MMM yyyy')}` : ''}
          </p>
        </div>
        <Link to={`/dreams?tags=${tag.id}`} className="btn">Open in Dreams</Link>
      </div>

      {stats && (
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          <div className="card">
            <h2 className="font-semibold mb-2">Lucidity</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {(['lucid', 'semi-lucid', 'non-lucid'] as Lucidity[]).map((k) => (
                <span key={k} className="chip">{lucidityLabel(k)} · {stats.byLuc[k]}</span>
              ))}
            </div>
          </div>
          <div className="card">
            <h2 className="font-semibold mb-2">Also tagged</h2>
            {stats.related.length === 0 ? (
              <p className="text-sm text-faint">No other tags on these dreams yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {stats.related.map((r) => (
                  <Link key={r.tag.id} to={`/tag/${r.tag.id}`} className="chip chip-btn" style={tagChipStyle(r.tag.color)}>
                    {r.tag.name} · {r.n}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-[var(--gap)]">
        {dreams.map((d) => (
          <DreamCard key={d.id} dream={d} showPreview={settings.showPreview} onToggleFavorite={toggleFav} />
        ))}
      </div>
    </div>
  )
}
