import { Link } from 'react-router-dom'
import { Star, StickyNote } from 'lucide-react'
import clsx from 'clsx'
import type { Dream } from '@/lib/types'
import { excerpt, fmtDate, lucidityClass, lucidityLabel, tagChipStyle } from '@/lib/format'

export function DreamCard({ dream, showPreview, onToggleFavorite }: { dream: Dream; showPreview: boolean; onToggleFavorite?: (d: Dream) => void }) {
  const isNote = dream.entry_type === 'note'
  return (
    <Link to={`/dream/${dream.id}`} className="card card-hover block fade-in group">
      <div className="flex items-start gap-3">
        <DateBadge iso={dream.date} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="font-semibold leading-snug flex-1 min-w-0 truncate">{dream.title || 'Untitled'}</h3>
            {onToggleFavorite && (
              <button
                className={clsx('shrink-0 -m-1 p-1 rounded-lg transition-colors', dream.favorite ? 'text-lucid' : 'text-faint opacity-0 group-hover:opacity-100 hover:text-fg')}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleFavorite(dream)
                }}
                aria-label={dream.favorite ? 'Unfavorite' : 'Favorite'}
              >
                <Star size={16} className={dream.favorite ? 'fill-current' : ''} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {isNote ? (
              <span className="chip pill-note"><StickyNote size={11} /> Note</span>
            ) : (
              <span className={clsx('chip', lucidityClass(dream.lucidity))}>{lucidityLabel(dream.lucidity)}</span>
            )}
            {dream.induction_method && <span className="chip">{dream.induction_method}</span>}
            {dream.tags.slice(0, 4).map((t) => (
              <span key={t.id} className="chip" style={tagChipStyle(t.color)}>{t.name}</span>
            ))}
            {dream.tags.length > 4 && <span className="chip text-faint">+{dream.tags.length - 4}</span>}
          </div>
          {showPreview && dream.description && <p className="text-sm text-muted mt-2 leading-relaxed line-clamp-3">{excerpt(dream.description, 300)}</p>}
        </div>
      </div>
    </Link>
  )
}

export function DateBadge({ iso }: { iso: string }) {
  const day = fmtDate(iso, 'd')
  const mon = fmtDate(iso, 'MMM')
  const yr = fmtDate(iso, 'yyyy')
  return (
    <div className="shrink-0 w-14 rounded-xl text-center py-1.5 leading-tight" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}>
      <div className="text-lg font-semibold tabular-nums">{day}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{mon}</div>
      <div className="text-[10px] text-faint tabular-nums">{yr}</div>
    </div>
  )
}
