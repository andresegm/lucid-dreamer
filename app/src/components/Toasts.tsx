import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { dismissToast, subscribeToasts, type Toast } from '@/lib/toast'

export function Toasts() {
  const [list, setList] = useState<Toast[]>([])
  useEffect(() => subscribeToasts(setList), [])
  if (!list.length) return null
  return (
    <div
      className="fixed z-50 inset-x-0 flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ top: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      role="status"
      aria-live="polite"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 max-w-md w-full rounded-2xl pl-4 pr-2 py-2 text-sm fade-in"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--border-strong)', boxShadow: '0 12px 40px -12px rgba(0,0,0,.55)' }}
        >
          <span className="flex-1 min-w-0 break-words">{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="btn btn-ghost text-accent shrink-0"
              onClick={() => { dismissToast(t.id); void t.action!.run() }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="btn btn-icon btn-ghost shrink-0" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
