import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Pencil, Search, Trash2, X } from 'lucide-react'
import { deleteTag, fetchTags, renameTag } from '@/lib/api'
import type { Tag } from '@/lib/types'
import { EmptyState, ErrorBox, PageHeader, Skeleton } from '@/components/ui'

export function TagsPage() {
  const [tags, setTags] = useState<Tag[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirm, setConfirm] = useState<Tag | null>(null)

  const load = () => fetchTags().then(setTags).catch(setError)
  useEffect(() => { void load() }, [])

  const list = useMemo(() => (tags ?? []).filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (b.dream_count ?? 0) - (a.dream_count ?? 0) || a.name.localeCompare(b.name)), [tags, q])

  async function saveRename(t: Tag) {
    const name = draft.trim()
    setEditing(null)
    if (!name || name === t.name) return
    try { await renameTag(t.id, name); await load() } catch (e) { setError(e) }
  }
  async function remove(t: Tag) {
    setConfirm(null)
    try { await deleteTag(t.id); await load() } catch (e) { setError(e) }
  }

  if (error) return <ErrorBox error={error} retry={() => { setError(null); void load() }} />

  return (
    <div className="fade-in">
      <PageHeader title="Tags" subtitle={tags ? `${tags.length} tags` : 'Loading…'} />
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input className="input pl-9" placeholder="Find a tag…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!tags ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[var(--gap)]">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState title={q ? 'No tags match' : 'No tags yet'} hint="Tags are created automatically when you add them to a dream." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[var(--gap)]">
          {list.map((t) => (
            <div key={t.id} className="card card-hover flex items-center gap-2 group" style={{ padding: '.6rem .8rem' }}>
              {editing === t.id ? (
                <>
                  <input className="input py-1.5" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void saveRename(t); if (e.key === 'Escape') setEditing(null) }} />
                  <button className="btn btn-icon" onClick={() => void saveRename(t)} aria-label="Save"><Check size={16} /></button>
                  <button className="btn btn-icon" onClick={() => setEditing(null)} aria-label="Cancel"><X size={16} /></button>
                </>
              ) : (
                <>
                  <Link to={`/?tags=${t.id}`} className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="truncate font-medium">{t.name}</span>
                    <span className="chip tabular-nums">{t.dream_count ?? 0}</span>
                  </Link>
                  <button className="btn btn-icon btn-ghost opacity-0 group-hover:opacity-100" onClick={() => { setEditing(t.id); setDraft(t.name) }} aria-label="Rename"><Pencil size={15} /></button>
                  <button className="btn btn-icon btn-ghost btn-danger opacity-0 group-hover:opacity-100" onClick={() => setConfirm(t)} aria-label="Delete"><Trash2 size={15} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.55)' }} onClick={() => setConfirm(null)}>
          <div className="card max-w-sm w-full fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold">Delete tag “{confirm.name}”?</div>
            <p className="text-sm text-muted mt-1">It will be removed from {confirm.dream_count ?? 0} {confirm.dream_count === 1 ? 'dream' : 'dreams'}. The dreams themselves are kept.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => void remove(confirm)}><Trash2 size={16} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
