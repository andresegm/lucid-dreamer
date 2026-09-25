import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Moon } from 'lucide-react'
import clsx from 'clsx'
import { pickMorningLine, RECALL_TIP_GROUPS, type RecallContext } from '@/lib/recallTips'

const OPEN_KEY = 'ldj.recallTips.open'

export function RecallTipsCard() {
  const location = useLocation()
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(OPEN_KEY)
      return v === null ? false : v === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0') } catch { /* ignore */ }
  }, [open])

  useEffect(() => {
    if (location.hash !== '#recall-tips') return
    setOpen(true)
    requestAnimationFrame(() => document.getElementById('recall')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [location.hash])

  return (
    <div id="recall" className="card scroll-mt-6">
      <button type="button" className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div>
          <h2 className="font-semibold">Tips to increase recall</h2>
          <p className="text-xs text-muted mt-0.5">Protect REM, catch the dream on waking, then practice — lucidity later.</p>
        </div>
        <ChevronDown size={18} className={clsx('text-muted shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid md:grid-cols-3 gap-5 mt-5 fade-in">
          {RECALL_TIP_GROUPS.map((g) => (
            <div key={g.id}>
              <div className="font-medium">{g.title}</div>
              <p className="text-xs text-muted mt-0.5 mb-2">{g.blurb}</p>
              <ul className="text-sm text-muted space-y-2 leading-relaxed">
                {g.items.map((item) => (
                  <li key={item} className="pl-3.5 relative before:content-[''] before:absolute before:left-0 before:top-[0.55em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-accent">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MorningCue({ ctx }: { ctx: RecallContext | null }) {
  if (!ctx) return null
  const line = pickMorningLine(ctx)
  if (!line) return null
  return (
    <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 fade-in" style={{ borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}>
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--accent) 18%, transparent)', color: 'var(--accent)' }}>
          <Moon size={16} />
        </span>
        <div>
          <div className="font-medium">No dream yet today</div>
          <p className="text-sm text-muted mt-0.5">{line}</p>
        </div>
      </div>
      <Link to="/stats#recall-tips" className="btn btn-ghost text-sm shrink-0">All recall tips</Link>
    </div>
  )
}
