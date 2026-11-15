import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckSquare, Plus, Tags, Trash2, X } from 'lucide-react'
import { appendDreamTags, deleteDreams, ensureTags, fetchDreams, fetchTags, restoreDream } from '@/lib/api'
import { searchTerms } from '@/lib/format'
import { offerUndoDelete, onDreamsChanged, showToast } from '@/lib/toast'
import { TagPicker } from '@/components/TagPicker'
import { toggleListFavorite } from '@/lib/favorite'
import type { Dream, Tag } from '@/lib/types'
import { useSettings } from '@/lib/settings'
import { useFilters } from '@/lib/useFilters'
import { FilterBar } from '@/components/FilterBar'
import { DreamNightList } from '@/components/DreamCard'
import { Pagination } from '@/components/Pagination'
import { EmptyState, ErrorBox, Modal, PageHeader, Skeleton, Spinner } from '@/components/ui'

export function DreamsPage() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const { filters, page, setFilters, setPage, clear, activeCount } = useFilters(settings.defaultSort, settings.showNotesInList)
  const [rows, setRows] = useState<Dream[]>([])
  const [count, setCount] = useState(0)
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const request = useRef(0)
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<null | 'tag' | 'delete'>(null)
  const [tagNames, setTagNames] = useState<string[]>([])
  const [working, setWorking] = useState(false)
  const highlight = useMemo(() => searchTerms(filters.q), [filters.q])

  const load = useCallback(async () => {
    const id = ++request.current
    setLoading(true)
    setError(null)
    try {
      const r = await fetchDreams(filters, page, settings.pageSize)
      if (id !== request.current) return
      setRows(r.rows)
      setCount(r.count)
    } catch (e) {
      if (id !== request.current) return
      setError(e)
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [filters, page, settings.pageSize])

  useEffect(() => { void load() }, [load])
  useEffect(() => onDreamsChanged(() => void load()), [load])
  const loadTags = useCallback(() => { fetchTags().then(setTags).catch(() => {}) }, [])
  useEffect(() => { loadTags() }, [loadTags])
  // A selection only makes sense for the rows on screen
  useEffect(() => { setPicked(new Set()) }, [filters, page])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [page])

  function toggleFav(d: Dream) {
    void toggleListFavorite(d, setRows)
  }

  function togglePick(d: Dream) {
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(d.id)) next.delete(d.id)
      else next.add(d.id)
      return next
    })
  }

  function stopSelecting() {
    setSelecting(false)
    setPicked(new Set())
    setDialog(null)
  }

  const chosen = rows.filter((d) => picked.has(d.id))
  const allPicked = rows.length > 0 && chosen.length === rows.length
  const nDreams = (n: number) => `${n} ${n === 1 ? 'dream' : 'dreams'}`

  async function tagChosen() {
    if (!chosen.length || !tagNames.length || working) return
    setWorking(true)
    try {
      const made = await ensureTags(tagNames)
      await appendDreamTags(chosen.flatMap((d) => made.map((t) => ({ dream_id: d.id, tag_id: t.id }))))
      showToast(`Tagged ${nDreams(chosen.length)} ${made.map((t) => `“${t.name}”`).join(', ')}.`)
      setTagNames([])
      stopSelecting()
      loadTags()
      await load()
    } catch (e) {
      setDialog(null)
      setError(e)
    } finally {
      setWorking(false)
    }
  }

  async function deleteChosen() {
    if (!chosen.length || working) return
    const gone = chosen
    setWorking(true)
    try {
      await deleteDreams(gone.map((d) => d.id))
      offerUndoDelete(gone.length, async () => { for (const d of gone) await restoreDream(d) })
      stopSelecting()
      loadTags()
      await load()
    } catch (e) {
      setDialog(null)
      setError(e)
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="min-w-0 max-w-full">
      <PageHeader
        title="Dreams"
        subtitle={loading ? 'Loading…' : `${count.toLocaleString()} ${count === 1 ? 'entry' : 'entries'}${activeCount ? ' match your filters' : ''}`}
        actions={
          <div className="flex items-center gap-2 shrink-0">
            {rows.length > 0 && (
              <button className="btn" onClick={() => (selecting ? stopSelecting() : setSelecting(true))} aria-pressed={selecting}>
                <CheckSquare size={16} /> <span className="hidden sm:inline">{selecting ? 'Done' : 'Select'}</span>
              </button>
            )}
            <Link to="/tags" className="btn"><Tags size={16} /> <span className="hidden sm:inline">Tags</span></Link>
            <button className="btn btn-primary" onClick={() => navigate('/new')}>
              <Plus size={16} /> New dream
            </button>
          </div>
        }
      />

      <FilterBar filters={filters} onChange={setFilters} onClear={clear} tags={tags} activeCount={activeCount} />

      {selecting && (
        <div className="card mb-4 flex flex-wrap items-center gap-2 fade-in sticky top-2 z-10" style={{ padding: '.6rem .8rem', borderColor: 'var(--accent)', background: 'var(--bg-elev)' }}>
          <span className="text-sm font-medium mr-1 tabular-nums">{chosen.length} selected</span>
          <button className="chip chip-btn" onClick={() => setPicked(allPicked ? new Set() : new Set(rows.map((d) => d.id)))}>
            {allPicked ? 'Clear' : 'Select page'}
          </button>
          <span className="ml-auto flex items-center gap-2">
            <button className="btn" disabled={!chosen.length} onClick={() => setDialog('tag')}><Tags size={16} /> Tag</button>
            <button className="btn btn-danger" disabled={!chosen.length} onClick={() => setDialog('delete')}><Trash2 size={16} /> Delete</button>
            <button className="btn btn-icon btn-ghost" onClick={stopSelecting} aria-label="Stop selecting"><X size={16} /></button>
          </span>
        </div>
      )}

      {error ? (
        <ErrorBox error={error} retry={load} />
      ) : loading ? (
        <div className="grid gap-[var(--gap)] min-w-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card flex gap-3 min-w-0 max-w-full overflow-hidden">
              <Skeleton className="h-16 w-14 shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={activeCount ? 'No dreams match these filters' : 'No dreams yet'}
          hint={activeCount ? 'Try loosening a filter or clearing them all.' : 'Record your first dream to get started.'}
          action={activeCount ? <button className="btn" onClick={clear}>Clear filters</button> : <button className="btn btn-primary" onClick={() => navigate('/new')}><Plus size={16} /> New dream</button>}
        />
      ) : (
        <>
          <DreamNightList
            dreams={rows}
            showPreview={settings.showPreview}
            onToggleFavorite={toggleFav}
            grouped={filters.sort !== 'title'}
            selection={selecting ? { picked, onToggle: togglePick } : undefined}
            highlight={highlight}
          />
          <Pagination page={page} pageSize={settings.pageSize} total={count} onChange={setPage} />
        </>
      )}

      {dialog === 'tag' && (
        <Modal onClose={() => setDialog(null)}>
          <div className="font-semibold">Tag {nDreams(chosen.length)}</div>
          <p className="text-sm text-muted mt-1 mb-3">Added on top of the tags they already have.</p>
          <TagPicker all={tags} selected={tagNames} onChange={setTagNames} />
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn" onClick={() => setDialog(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={!tagNames.length || working} onClick={() => void tagChosen()}>
              {working ? <Spinner /> : <Tags size={16} />} Add
            </button>
          </div>
        </Modal>
      )}

      {dialog === 'delete' && (
        <Modal onClose={() => setDialog(null)}>
          <div className="font-semibold">Delete {nDreams(chosen.length)}?</div>
          <p className="text-sm text-muted mt-1">They’ll be removed. You get a few seconds to undo.</p>
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn" onClick={() => setDialog(null)}>Cancel</button>
            <button className="btn btn-danger" disabled={working} onClick={() => void deleteChosen()}>
              {working ? <Spinner /> : <Trash2 size={16} />} Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
