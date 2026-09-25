import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Star, StickyNote, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { deleteDream, fetchDream, fetchRelatedDreams, setFavorite } from '@/lib/api'
import type { Dream, Tag } from '@/lib/types'
import { INDUCTION_DESCRIPTIONS, type InductionMethod } from '@/lib/types'
import { excerpt, fmtDate, lucidityClass, lucidityLabel, wordCount } from '@/lib/format'
import { ErrorBox, Skeleton } from '@/components/ui'

export function DreamDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const captured = Boolean((useLocation().state as { captured?: boolean } | null)?.captured)
  const [dream, setDream] = useState<Dream | null>(null)
  const [related, setRelated] = useState<{ dream: Dream; shared: Tag[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setRelated([])
    fetchDream(id)
      .then(async (d) => {
        setDream(d)
        if (d?.tags.length) setRelated(await fetchRelatedDreams(d.id, d.tags.map((t) => t.id)))
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [id])

  async function toggleFav() {
    if (!dream) return
    setDream({ ...dream, favorite: !dream.favorite })
    try { await setFavorite(dream.id, !dream.favorite) } catch { setDream(dream) }
  }

  async function remove() {
    if (!dream) return
    await deleteDream(dream.id)
    navigate('/', { replace: true })
  }

  if (error) return <ErrorBox error={error} />
  if (loading || !dream)
    return (
      <div className="max-w-3xl">
        <Skeleton className="h-5 w-24 mb-6" />
        <Skeleton className="h-8 w-2/3 mb-3" />
        <Skeleton className="h-4 w-1/3 mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    )

  const isNote = dream.entry_type === 'note'
  const paragraphs = dream.description.split(/\n{2,}/).filter((p) => p.trim())

  return (
    <div className="max-w-3xl fade-in">
      <div className="flex items-center justify-between gap-2 mb-5">
        <button className="btn btn-ghost -ml-2" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-1">
          <button className={clsx('btn btn-icon', dream.favorite && 'text-lucid')} onClick={toggleFav} aria-label="Toggle favorite">
            <Star size={18} className={dream.favorite ? 'fill-current' : ''} />
          </button>
          <Link to={`/dream/${dream.id}/edit`} className="btn">
            <Pencil size={16} /> Edit
          </Link>
          <button className="btn btn-icon btn-danger" onClick={() => setConfirm(true)} aria-label="Delete">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="text-sm text-muted">{fmtDate(dream.date, 'EEEE, MMMM d, yyyy')}</div>
      <h1 className="text-3xl font-semibold tracking-tight mt-1 leading-tight">{dream.title || 'Untitled'}</h1>

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {isNote ? (
          <span className="chip pill-note"><StickyNote size={11} /> Note</span>
        ) : (
          <span className={clsx('chip', lucidityClass(dream.lucidity))}>{lucidityLabel(dream.lucidity)}</span>
        )}
        {dream.induction_method && (
          <span className="chip" title={INDUCTION_DESCRIPTIONS[dream.induction_method as InductionMethod] ?? ''}>
            {dream.induction_method}
          </span>
        )}
        {dream.tags.map((t) => (
          <Link key={t.id} to={`/?tags=${t.id}`} className="chip chip-btn">
            {t.name}
          </Link>
        ))}
        <span className="ml-auto text-xs text-faint">{wordCount(dream.description)} words</span>
      </div>

      {dream.induction_notes && (
        <div className="card mt-5 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)' }}>
          <div className="label">Induction notes</div>
          <div className="text-muted leading-relaxed">{dream.induction_notes}</div>
        </div>
      )}

      <article className="card mt-5 prose-dream" style={{ padding: 'calc(var(--card-pad) * 1.4)' }}>
        {paragraphs.length ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : <p className="text-faint italic">No description.</p>}
      </article>

      {captured && (
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 fade-in" style={{ borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)' }}>
          <div>
            <div className="font-medium">Saved. Add details while it’s fresh?</div>
            <p className="text-sm text-muted mt-0.5">Lucidity, induction method, extra tags — or leave it as-is.</p>
          </div>
          <Link to={`/dream/${dream.id}/edit`} className="btn btn-primary"><Pencil size={16} /> Add details</Link>
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold mb-1">Related dreams</h2>
          <p className="text-xs text-muted mb-3">Same people, places, or themes.</p>
          <div className="grid gap-2">
            {related.map(({ dream: r, shared }) => (
              <Link key={r.id} to={`/dream/${r.id}`} className="card card-hover block">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-medium truncate">{r.title || 'Untitled'}</div>
                  <div className="text-xs text-faint shrink-0 tabular-nums">{fmtDate(r.date, 'MMM d, yyyy')}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className={clsx('chip', lucidityClass(r.lucidity))}>{lucidityLabel(r.lucidity)}</span>
                  {shared.slice(0, 4).map((t) => (
                    <span key={t.id} className="chip chip-active">{t.name}</span>
                  ))}
                  {shared.length > 4 && <span className="chip text-faint">+{shared.length - 4}</span>}
                </div>
                {r.description && <p className="text-sm text-muted mt-1.5 line-clamp-2">{excerpt(r.description, 160)}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="text-xs text-faint mt-4 flex flex-wrap gap-x-4">
        <span>Added {fmtDate(dream.created_at.slice(0, 10), 'MMM d, yyyy')}</span>
        {dream.updated_at !== dream.created_at && <span>Edited {fmtDate(dream.updated_at.slice(0, 10), 'MMM d, yyyy')}</span>}
        <span>Source: {dream.source}</span>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.55)' }} onClick={() => setConfirm(false)}>
          <div className="card max-w-sm w-full fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold">Delete this dream?</div>
            <p className="text-sm text-muted mt-1">“{dream.title}” will be permanently removed.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={remove}><Trash2 size={16} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
