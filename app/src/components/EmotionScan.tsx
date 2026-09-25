import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ScanSearch } from 'lucide-react'
import clsx from 'clsx'
import { appendDreamTags, ensureTags, fetchAllFull } from '@/lib/api'
import { EMOTIONS, emotionLabel, proposeEmotionTags, type EmotionName, type EmotionProposal } from '@/lib/emotions'
import { fmtDate } from '@/lib/format'
import { Spinner } from '@/components/ui'

type Key = `${string}:${EmotionName}`
const keyOf = (id: string, e: EmotionName): Key => `${id}:${e}`

export function EmotionScan() {
  const [scanning, setScanning] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposals, setProposals] = useState<EmotionProposal[] | null>(null)
  const [selected, setSelected] = useState<Set<Key>>(new Set())
  const [applied, setApplied] = useState<{ tags: number; dreams: number } | null>(null)

  const selectedCount = selected.size
  const dreamCount = useMemo(() => new Set([...selected].map((k) => k.split(':')[0])).size, [selected])

  async function scan() {
    setScanning(true)
    setError(null)
    setApplied(null)
    try {
      const rows = await fetchAllFull()
      const found = proposeEmotionTags(rows)
      setProposals(found)
      setSelected(new Set(found.flatMap((p) => p.emotions.map((e) => keyOf(p.id, e)))))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setScanning(false)
    }
  }

  function toggle(id: string, e: EmotionName) {
    const k = keyOf(id, e)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  function toggleDream(p: EmotionProposal) {
    const keys = p.emotions.map((e) => keyOf(p.id, e))
    const allOn = keys.every((k) => selected.has(k))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const k of keys) {
        if (allOn) next.delete(k)
        else next.add(k)
      }
      return next
    })
  }

  function setAll(on: boolean) {
    if (!proposals) return
    setSelected(on ? new Set(proposals.flatMap((p) => p.emotions.map((e) => keyOf(p.id, e)))) : new Set())
  }

  async function apply() {
    if (!proposals || !selectedCount) return
    setApplying(true)
    setError(null)
    try {
      const names = EMOTIONS.map((e) => e.name).filter((n) => [...selected].some((k) => k.endsWith(`:${n}`)))
      const tags = await ensureTags(names)
      const byName = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]))
      const rows: { dream_id: string; tag_id: string }[] = []
      for (const k of selected) {
        const [dreamId, name] = k.split(':') as [string, EmotionName]
        const tag_id = byName.get(name)
        if (tag_id) rows.push({ dream_id: dreamId, tag_id })
      }
      await appendDreamTags(rows)
      setApplied({ tags: rows.length, dreams: dreamCount })
      setProposals(null)
      setSelected(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }

  return (
    <div id="emotion-scan">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="font-semibold">Scan past dreams</h2>
        <span className="text-[10px] uppercase tracking-wide text-faint px-1.5 py-0.5 rounded-md" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}>Beta</span>
      </div>
      <p className="text-xs text-muted mb-4">
        Looks for feeling words (fear, anxiety, anger, shame, sadness, confusion, awe, joy) in older dreams and proposes tags. Review before anything is saved. People, places, and themes are left alone for now.
      </p>

      {(!proposals || proposals.length === 0) && (
        <button type="button" className="btn" disabled={scanning} onClick={() => void scan()}>
          {scanning ? <Spinner /> : <ScanSearch size={16} />} {scanning ? 'Scanning…' : proposals ? 'Scan again' : 'Scan journal for emotions'}
        </button>
      )}

      {applied && (
        <div className="card text-sm mb-3" style={{ padding: '.75rem 1rem' }}>
          <div className="flex items-center gap-2 font-medium"><Check size={16} className="text-accent" /> Added {applied.tags} emotion {applied.tags === 1 ? 'tag' : 'tags'} on {applied.dreams} {applied.dreams === 1 ? 'dream' : 'dreams'}.</div>
          <Link to="/stats#patterns" className="text-xs text-accent hover:underline mt-1 inline-block">See the feeling map on Stats</Link>
        </div>
      )}

      {error && <div className="card text-sm text-danger mt-3">{error}</div>}

      {proposals && (
        <div className="mt-1">
          {proposals.length === 0 ? (
            <p className="text-sm text-muted">Nothing new to add — either the words aren’t there, or those dreams already have the matching feeling tags.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-sm text-muted">{selectedCount} tags on {dreamCount} dreams · {proposals.length} reviewed</span>
                <button type="button" className="text-xs text-accent hover:underline ml-auto" onClick={() => setAll(true)}>Select all</button>
                <button type="button" className="text-xs text-accent hover:underline" onClick={() => setAll(false)}>Clear</button>
              </div>
              <ul className="grid gap-2 max-h-[28rem] overflow-auto pr-1 mb-3">
                {proposals.map((p) => {
                  const keys = p.emotions.map((e) => keyOf(p.id, e))
                  const on = keys.filter((k) => selected.has(k)).length
                  return (
                    <li key={p.id} className="card" style={{ padding: '.7rem .85rem' }}>
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          className={clsx('chip chip-btn shrink-0 mt-0.5', on === p.emotions.length && 'chip-active')}
                          onClick={() => toggleDream(p)}
                          aria-label={on ? 'Deselect dream' : 'Select dream'}
                        >
                          {on}/{p.emotions.length}
                        </button>
                        <div className="min-w-0 flex-1">
                          <Link to={`/dream/${p.id}`} className="font-medium hover:text-accent truncate block">{p.title}</Link>
                          <div className="text-xs text-faint">{fmtDate(p.date, 'MMM d, yyyy')}</div>
                          {p.excerpt && <p className="text-xs text-muted mt-1 line-clamp-2">{p.excerpt}</p>}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {p.emotions.map((e) => (
                              <button
                                key={e}
                                type="button"
                                className={clsx('chip chip-btn', selected.has(keyOf(p.id, e)) && 'chip-active')}
                                onClick={() => toggle(p.id, e)}
                              >
                                {emotionLabel(e)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" disabled={!selectedCount || applying} onClick={() => void apply()}>
                  {applying ? <Spinner /> : <Check size={16} />} Apply {selectedCount || ''} {selectedCount === 1 ? 'tag' : 'tags'}
                </button>
                <button type="button" className="btn" disabled={applying} onClick={() => { setProposals(null); setSelected(new Set()) }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
