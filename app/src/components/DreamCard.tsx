import { Link } from 'react-router-dom'
import { Check, Star, StickyNote } from 'lucide-react'
import clsx from 'clsx'
import type { Dream } from '@/lib/types'
import { excerptAround, fmtDate, lucidityClass, lucidityLabel, tagChipStyle } from '@/lib/format'
import { Highlight } from '@/components/Highlight'
import { groupNights } from '@/lib/nights'

export interface CardSelection {
  picked: Set<string>
  onToggle: (d: Dream) => void
}

export function DreamCard({ dream, showPreview, onToggleFavorite, hideDate, selection, highlight }: { dream: Dream; showPreview: boolean; onToggleFavorite?: (d: Dream) => void; hideDate?: boolean; selection?: CardSelection; highlight?: string[] }) {
  const isNote = dream.entry_type === 'note'
  const picked = selection?.picked.has(dream.id) ?? false
  return (
    <Link
      to={`/dream/${dream.id}`}
      className={clsx('card card-hover block fade-in group min-w-0 max-w-full overflow-hidden', picked && 'border-[var(--accent)]')}
      onClick={selection ? (e) => { e.preventDefault(); selection.onToggle(dream) } : undefined}
      role={selection ? 'checkbox' : undefined}
      aria-checked={selection ? picked : undefined}
    >
      <div className="flex items-start gap-3 min-w-0">
        {selection && (
          <span
            className="shrink-0 mt-1 h-5 w-5 rounded-md flex items-center justify-center"
            style={{ border: `1.5px solid ${picked ? 'var(--accent)' : 'var(--border-strong)'}`, background: picked ? 'var(--accent)' : 'transparent' }}
            aria-hidden
          >
            {picked && <Check size={14} color="var(--accent-contrast)" />}
          </span>
        )}
        {!hideDate && <DateBadge iso={dream.date} />}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-start gap-2 min-w-0">
            <h3 className="font-semibold leading-snug flex-1 min-w-0 truncate"><Highlight text={dream.title || 'Untitled'} terms={highlight} /></h3>
            {onToggleFavorite && !selection && (
              <button
                className={clsx('shrink-0 -m-1 p-1 rounded-lg transition-colors', dream.favorite ? 'text-lucid' : 'text-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-60 hover:text-fg')}
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
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 min-w-0">
            {isNote ? (
              <span className="chip pill-note max-w-full truncate"><StickyNote size={11} className="shrink-0" /> Note</span>
            ) : (
              <span className={clsx('chip max-w-full truncate', lucidityClass(dream.lucidity))}>{lucidityLabel(dream.lucidity)}</span>
            )}
            {dream.induction_method && <span className="chip max-w-full truncate">{dream.induction_method}</span>}
            {dream.tags.slice(0, 4).map((t) => (
              <span key={t.id} className="chip max-w-full truncate" style={tagChipStyle(t.color)}>{t.name}</span>
            ))}
            {dream.tags.length > 4 && <span className="chip text-faint">+{dream.tags.length - 4}</span>}
          </div>
          {showPreview && dream.description && (
            <p className="text-sm text-muted mt-2 leading-relaxed line-clamp-3 break-words">
              <Highlight text={excerptAround(dream.description, highlight, 300)} terms={highlight} />
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

export function DreamNightList({
  dreams,
  showPreview,
  onToggleFavorite,
  grouped = true,
  selection,
  highlight,
}: {
  dreams: Dream[]
  showPreview: boolean
  onToggleFavorite?: (d: Dream) => void
  grouped?: boolean
  selection?: CardSelection
  highlight?: string[]
}) {
  const nights = grouped ? groupNights(dreams) : [{ date: '', items: dreams }]
  return (
    <div className="grid gap-6 min-w-0">
      {nights.map((night) => (
        <section key={night.date || 'list'} className="min-w-0">
          {night.date && night.items.length > 1 && (
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              {fmtDate(night.date, 'EEE, MMM d')} · {night.items.length} entries
            </h2>
          )}
          <div className="grid gap-[var(--gap)] min-w-0">
            {night.items.map((d, i) => (
              <DreamCard
                key={d.id}
                dream={d}
                showPreview={showPreview}
                onToggleFavorite={onToggleFavorite}
                selection={selection}
                highlight={highlight}
                hideDate={Boolean(night.date && night.items.length > 1 && i > 0)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function DateBadge({ iso }: { iso: string }) {
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
