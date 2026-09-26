import { useEffect, useState } from 'react'
import { ArrowUpDown, Calendar, ChevronDown, Search, SlidersHorizontal, Star, X } from 'lucide-react'
import clsx from 'clsx'
import { INDUCTION_METHODS, LUCIDITY_OPTIONS, type DreamFilters, type Lucidity, type SortOrder, type Tag } from '@/lib/types'
import { tagChipStyle } from '@/lib/format'
import { Segmented, Switch } from './ui'

interface Props {
  filters: DreamFilters
  onChange: (patch: Partial<DreamFilters>) => void
  onClear: () => void
  tags: Tag[]
  activeCount: number
  total: number
}

export function FilterBar({ filters, onChange, onClear, tags, activeCount, total }: Props) {
  const [open, setOpen] = useState(activeCount > 0 && !filters.q)
  const [q, setQ] = useState(filters.q)
  const [tagQuery, setTagQuery] = useState('')

  // debounce search
  useEffect(() => {
    if (q === filters.q) return
    const t = setTimeout(() => onChange({ q }), 350)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setQ(filters.q), [filters.q])

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
  }

  const visibleTags = tags
    .filter((t) => !tagQuery || t.name.toLowerCase().includes(tagQuery.toLowerCase()))
    .sort((a, b) => (b.dream_count ?? 0) - (a.dream_count ?? 0) || a.name.localeCompare(b.name))
    .slice(0, tagQuery ? 60 : 24)

  return (
    <div className="card mb-4 fade-in min-w-0 max-w-full overflow-hidden" style={{ padding: '0.75rem' }}>
      {/* Top row */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <div className="relative flex-1 min-w-0 basis-full sm:basis-auto sm:min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input pl-9 pr-8 min-w-0" placeholder="Search dreams…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-fg" onClick={() => setQ('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        <button className={clsx('btn shrink-0', filters.favorites && 'chip-active')} onClick={() => onChange({ favorites: !filters.favorites })} title="Favorites only">
          <Star size={16} className={filters.favorites ? 'fill-current' : ''} />
          <span className="hidden sm:inline">Favorites</span>
        </button>

        <SortMenu value={filters.sort} onChange={(sort) => onChange({ sort })} />

        <button className={clsx('btn shrink-0', open && 'chip-active')} onClick={() => setOpen((o) => !o)}>
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="ml-0.5 rounded-full px-1.5 text-[11px] font-semibold" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>
              {activeCount}
            </span>
          )}
          <ChevronDown size={14} className={clsx('transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {/* Quick lucidity chips always visible */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3 min-w-0">
        {LUCIDITY_OPTIONS.map((o) => (
          <button
            key={o.value}
            className={clsx('chip chip-btn', filters.lucidity.includes(o.value) && 'chip-active')}
            onClick={() => onChange({ lucidity: toggle(filters.lucidity, o.value) as Lucidity[] })}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: o.value === 'lucid' ? 'var(--lucid)' : o.value === 'semi-lucid' ? 'var(--semi)' : 'var(--nonlucid)' }} />
            {o.label}
          </button>
        ))}
        <span className="sm:ml-auto text-xs text-muted basis-full sm:basis-auto">{total.toLocaleString()} {total === 1 ? 'entry' : 'entries'}</span>
        {activeCount > 0 && (
          <button className="chip chip-btn" onClick={onClear}>
            <X size={12} /> Clear all
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {open && (
        <div className="grid gap-4 mt-4 pt-4 border-t fade-in" style={{ borderColor: 'var(--border)' }}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <span className="label flex items-center gap-1.5"><Calendar size={12} /> Date range</span>
              <div className="flex items-center gap-2 min-w-0">
                <input type="date" className="input min-w-0 flex-1" value={filters.from ?? ''} onChange={(e) => onChange({ from: e.target.value || null })} />
                <span className="text-faint text-xs shrink-0">to</span>
                <input type="date" className="input min-w-0 flex-1" value={filters.to ?? ''} onChange={(e) => onChange({ to: e.target.value || null })} />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  ['30d', 30], ['90d', 90], ['1y', 365], ['This year', 'ty'], ['All', 0],
                ].map(([label, v]) => (
                  <button
                    key={label as string}
                    className="chip chip-btn"
                    onClick={() => {
                      if (v === 0) return onChange({ from: null, to: null })
                      const now = new Date()
                      const from = v === 'ty' ? new Date(now.getFullYear(), 0, 1) : new Date(now.getTime() - (v as number) * 86400000)
                      onChange({ from: from.toISOString().slice(0, 10), to: null })
                    }}
                  >
                    {label as string}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label">Induction method</span>
              <div className="flex flex-wrap gap-1.5">
                {INDUCTION_METHODS.map((m) => (
                  <button key={m} className={clsx('chip chip-btn', filters.induction.includes(m) && 'chip-active')} onClick={() => onChange({ induction: toggle(filters.induction, m) })}>
                    {m}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <Switch checked={filters.includeNotes} onChange={(v) => onChange({ includeNotes: v })} label={<span className="text-muted">Include notes</span>} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="label mb-0">Tags {filters.tags.length ? `(${filters.tags.length})` : ''}</span>
              {filters.tags.length > 1 && (
                <Segmented value={filters.tagMode} onChange={(tagMode) => onChange({ tagMode })} options={[{ value: 'any', label: 'Any' }, { value: 'all', label: 'All' }]} />
              )}
            </div>
            <input className="input mb-2" placeholder="Find a tag…" value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} />
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto pr-1">
              {visibleTags.map((t) => (
                <button key={t.id} className={clsx('chip chip-btn', filters.tags.includes(t.id) && 'chip-active')} style={filters.tags.includes(t.id) ? undefined : tagChipStyle(t.color)} onClick={() => onChange({ tags: toggle(filters.tags, t.id) })}>
                  {t.name}
                  {t.dream_count != null && <span className="text-faint">{t.dream_count}</span>}
                </button>
              ))}
              {!visibleTags.length && <span className="text-xs text-faint">No tags match.</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SortMenu({ value, onChange }: { value: SortOrder; onChange: (v: SortOrder) => void }) {
  const labels: Record<SortOrder, string> = { newest: 'Newest', oldest: 'Oldest', title: 'Title' }
  return (
    <div className="relative">
      <select className="btn appearance-none pr-8 cursor-pointer" value={value} onChange={(e) => onChange(e.target.value as SortOrder)} aria-label="Sort">
        {(Object.keys(labels) as SortOrder[]).map((k) => (
          <option key={k} value={k}>
            {labels[k]}
          </option>
        ))}
      </select>
      <ArrowUpDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
    </div>
  )
}
