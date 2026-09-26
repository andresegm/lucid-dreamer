import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { fetchDreams, fetchTags, setFavorite } from '@/lib/api'
import type { Dream, Tag } from '@/lib/types'
import { useSettings } from '@/lib/settings'
import { useFilters } from '@/lib/useFilters'
import { FilterBar } from '@/components/FilterBar'
import { DreamCard } from '@/components/DreamCard'
import { Pagination } from '@/components/Pagination'
import { EmptyState, ErrorBox, PageHeader, Skeleton } from '@/components/ui'

export function DreamsPage() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const { filters, page, setFilters, setPage, clear, activeCount } = useFilters(settings.defaultSort, settings.showNotesInList)
  const [rows, setRows] = useState<Dream[]>([])
  const [count, setCount] = useState(0)
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetchDreams(filters, page, settings.pageSize)
      setRows(r.rows)
      setCount(r.count)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [filters, page, settings.pageSize])

  useEffect(() => { void load() }, [load])
  useEffect(() => { fetchTags().then(setTags).catch(() => {}) }, [])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [page])

  async function toggleFav(d: Dream) {
    setRows((rs) => rs.map((r) => (r.id === d.id ? { ...r, favorite: !r.favorite } : r)))
    try {
      await setFavorite(d.id, !d.favorite)
    } catch {
      setRows((rs) => rs.map((r) => (r.id === d.id ? { ...r, favorite: d.favorite } : r)))
    }
  }

  return (
    <div className="min-w-0 max-w-full">
      <PageHeader
        title="Dreams"
        subtitle={loading ? 'Loading…' : `${count.toLocaleString()} ${count === 1 ? 'entry' : 'entries'}${activeCount ? ' match your filters' : ''}`}
        actions={
          <button className="btn btn-primary shrink-0" onClick={() => navigate('/new')}>
            <Plus size={16} /> New dream
          </button>
        }
      />

      <FilterBar filters={filters} onChange={setFilters} onClear={clear} tags={tags} activeCount={activeCount} total={count} />

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
          <div className="grid gap-[var(--gap)] min-w-0">
            {rows.map((d) => (
              <DreamCard key={d.id} dream={d} showPreview={settings.showPreview} onToggleFavorite={toggleFav} />
            ))}
          </div>
          <Pagination page={page} pageSize={settings.pageSize} total={count} onChange={setPage} />
        </>
      )}
    </div>
  )
}
