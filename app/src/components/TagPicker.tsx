import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'
import clsx from 'clsx'
import type { Tag } from '@/lib/types'

/**
 * Tag picker: selected tags are shown as removable chips; type to search existing tags or
 * press Enter / comma to create a new one. Suggestions are ranked by usage.
 */
export function TagPicker({ all, selected, onChange }: { all: Tag[]; selected: string[]; onChange: (names: string[]) => void }) {
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const [hi, setHi] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const lowerSel = useMemo(() => new Set(selected.map((s) => s.toLowerCase())), [selected])
  const suggestions = useMemo(() => {
    const term = q.trim().toLowerCase()
    return all
      .filter((t) => !lowerSel.has(t.name.toLowerCase()) && (!term || t.name.toLowerCase().includes(term)))
      .sort((a, b) => (b.dream_count ?? 0) - (a.dream_count ?? 0) || a.name.localeCompare(b.name))
      .slice(0, 12)
  }, [all, q, lowerSel])

  const canCreate = q.trim().length > 0 && !all.some((t) => t.name.toLowerCase() === q.trim().toLowerCase()) && !lowerSel.has(q.trim().toLowerCase())
  const items = [...suggestions.map((t) => ({ kind: 'existing' as const, name: t.name, count: t.dream_count })), ...(canCreate ? [{ kind: 'create' as const, name: q.trim(), count: undefined }] : [])]

  function add(name: string) {
    if (!name.trim() || lowerSel.has(name.trim().toLowerCase())) return
    onChange([...selected, name.trim()])
    setQ('')
    setHi(0)
    inputRef.current?.focus()
  }
  function remove(name: string) {
    onChange(selected.filter((s) => s !== name))
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const pick = items[hi] ?? (canCreate ? { name: q.trim() } : null)
      if (pick) add(pick.name)
    } else if (e.key === 'Backspace' && !q && selected.length) {
      remove(selected[selected.length - 1])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); setHi((h) => Math.min(items.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setHi((h) => Math.max(0, h - 1))
    } else if (e.key === 'Escape') {
      setFocus(false)
    }
  }

  return (
    <div className="relative">
      <div className={clsx('input flex flex-wrap items-center gap-1.5 cursor-text min-h-[44px]', focus && 'ring-0')} style={focus ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)' } : undefined} onClick={() => inputRef.current?.focus()}>
        {selected.map((s) => (
          <span key={s} className="chip chip-active">
            {s}
            <button type="button" className="-mr-1 rounded-full hover:text-danger" onClick={(e) => { e.stopPropagation(); remove(s) }} aria-label={`Remove ${s}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm py-0.5"
          placeholder={selected.length ? '' : 'Add tags… (Enter to add)'}
          value={q}
          onChange={(e) => { setQ(e.target.value); setHi(0); setFocus(true) }}
          onKeyDown={onKey}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 120)}
        />
      </div>

      {focus && items.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1.5 card p-1.5 max-h-64 overflow-auto shadow-xl fade-in" style={{ background: 'var(--bg-elev)' }}>
          {items.map((it, i) => (
            <button
              key={it.kind + it.name}
              type="button"
              className={clsx('w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm text-left', i === hi ? 'bg-elev2' : 'hover:bg-elev2')}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(it.name)}
            >
              <span className="flex items-center gap-2 truncate">
                {it.kind === 'create' && <Plus size={14} className="text-accent" />}
                {it.kind === 'create' ? <>Create “<b>{it.name}</b>”</> : it.name}
              </span>
              {it.count != null && <span className="text-xs text-faint tabular-nums">{it.count}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
