import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, GitMerge, MoreHorizontal, Pencil, Search, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import { deleteTag, fetchTags, mergeTags, renameTag, setTagColor } from '@/lib/api'
import type { Tag } from '@/lib/types'
import { TAG_COLOR_PRESETS, tagChipStyle } from '@/lib/format'
import { EmptyState, ErrorBox, PageHeader, Skeleton } from '@/components/ui'

export function TagsPage() {
  const [tags, setTags] = useState<Tag[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirm, setConfirm] = useState<Tag | null>(null)
  const [merging, setMerging] = useState<Tag | null>(null)
  const [mergeInto, setMergeInto] = useState('')
  const [colorFor, setColorFor] = useState<string | null>(null)
  const [menu, setMenu] = useState<string | null>(null)

  const load = () => fetchTags().then(setTags).catch(setError)
  useEffect(() => { void load() }, [])

  const list = useMemo(
    () => (tags ?? []).filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (b.dream_count ?? 0) - (a.dream_count ?? 0) || a.name.localeCompare(b.name)),
    [tags, q],
  )
  const mergeTargets = useMemo(
    () => (tags ?? []).filter((t) => merging && t.id !== merging.id).sort((a, b) => a.name.localeCompare(b.name)),
    [tags, merging],
  )

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
  async function color(t: Tag, hex: string | null) {
    setTags((cur) => cur?.map((x) => (x.id === t.id ? { ...x, color: hex } : x)) ?? null)
    try { await setTagColor(t.id, hex) } catch (e) { setError(e); await load() }
  }
  async function doMerge() {
    if (!merging || !mergeInto) return
    const from = merging
    setMerging(null)
    try { await mergeTags(from.id, mergeInto); await load() } catch (e) { setError(e) }
  }

  if (error) return <ErrorBox error={error} retry={() => { setError(null); void load() }} />

  return (
    <div className="fade-in">
      <PageHeader title="Tags" subtitle={tags ? `${tags.length} tags` : 'Loading…'} />
      <p className="text-sm text-muted -mt-2 mb-4">Click the swatch to color a tag. Merge two names that mean the same thing (Pau → Paula).</p>
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
            <div
              key={t.id}
              className={clsx(
                'card card-hover flex items-center gap-2 group relative',
                (menu === t.id || colorFor === t.id) && 'z-30',
              )}
              style={{ padding: '.6rem .8rem' }}
            >
              {editing === t.id ? (
                <>
                  <input className="input py-1.5" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void saveRename(t); if (e.key === 'Escape') setEditing(null) }} />
                  <button className="btn btn-icon" onClick={() => void saveRename(t)} aria-label="Save"><Check size={16} /></button>
                  <button className="btn btn-icon" onClick={() => setEditing(null)} aria-label="Cancel"><X size={16} /></button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="h-5 w-5 rounded-full shrink-0 border"
                    style={{ background: t.color ?? 'transparent', borderColor: t.color ?? 'var(--border-strong)' }}
                    title={t.color ? 'Change color' : 'Set color'}
                    onClick={() => setColorFor((id) => (id === t.id ? null : t.id))}
                    aria-label={`Color ${t.name}`}
                  />
                  <Link to={`/dreams?tags=${t.id}`} className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="truncate font-medium" style={t.color ? { color: t.color } : undefined}>{t.name}</span>
                    <span className="chip tabular-nums shrink-0" style={tagChipStyle(t.color)}>{t.dream_count ?? 0}</span>
                  </Link>
                  <button className="btn btn-icon btn-ghost shrink-0" onClick={() => setMenu((id) => (id === t.id ? null : t.id))} aria-label={`More for ${t.name}`}>
                    <MoreHorizontal size={16} />
                  </button>
                  {menu === t.id && (
                    <div className="absolute z-40 right-2 top-full mt-1 card py-1 min-w-[140px] shadow-xl" style={{ padding: '.35rem', background: 'var(--bg-elev)' }}>
                      <button className="nav-item w-full text-sm" onClick={() => { setMenu(null); setMerging(t); setMergeInto('') }}><GitMerge size={14} /> Merge</button>
                      <button className="nav-item w-full text-sm" onClick={() => { setMenu(null); setEditing(t.id); setDraft(t.name) }}><Pencil size={14} /> Rename</button>
                      <button className="nav-item w-full text-sm text-danger" onClick={() => { setMenu(null); setConfirm(t) }}><Trash2 size={14} /> Delete</button>
                    </div>
                  )}
                </>
              )}
              {colorFor === t.id && (
                <div className="absolute z-40 top-full left-2 mt-1 card flex flex-wrap items-center gap-1.5 shadow-xl" style={{ padding: '.5rem', background: 'var(--bg-elev)' }} onMouseLeave={() => setColorFor(null)}>
                  {TAG_COLOR_PRESETS.map((hex) => (
                    <button key={hex} type="button" className="h-6 w-6 rounded-full border" style={{ background: hex, borderColor: t.color === hex ? 'var(--text)' : 'transparent' }} onClick={() => { void color(t, hex); setColorFor(null) }} aria-label={hex} />
                  ))}
                  <label className="h-6 w-6 rounded-full overflow-hidden border cursor-pointer" style={{ borderColor: 'var(--border)' }} title="Custom">
                    <input type="color" className="h-8 w-8 -m-1 cursor-pointer border-0 p-0" value={t.color ?? '#7c6cf6'} onChange={(e) => void color(t, e.target.value)} />
                  </label>
                  {t.color && <button type="button" className="text-xs text-muted px-1" onClick={() => { void color(t, null); setColorFor(null) }}>Clear</button>}
                </div>
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

      {merging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.55)' }} onClick={() => setMerging(null)}>
          <div className="card max-w-sm w-full fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold">Merge “{merging.name}”</div>
            <p className="text-sm text-muted mt-1">Dreams keep the tag you merge into. “{merging.name}” is then deleted.</p>
            <label className="label mt-4">Merge into</label>
            <select className="input" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
              <option value="">Choose a tag…</option>
              {mergeTargets.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.dream_count ?? 0})</option>
              ))}
            </select>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn" onClick={() => setMerging(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!mergeInto} onClick={() => void doMerge()}><GitMerge size={16} /> Merge</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
