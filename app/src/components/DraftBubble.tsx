import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import clsx from 'clsx'
import { latestOpenDraft, subscribeDrafts, type OpenDraft } from '@/lib/drafts'

export function DraftBubble({
  userId,
  pathname,
  liftForNav,
}: {
  userId: string
  pathname: string
  liftForNav: boolean
}) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<OpenDraft | null>(null)

  useEffect(() => {
    const refresh = () => {
      const next = latestOpenDraft(userId)
      setDraft(next && next.to !== pathname ? next : null)
    }
    refresh()
    return subscribeDrafts(refresh)
  }, [userId, pathname])

  if (!draft) return null

  return (
    <div
      className={clsx(
        'fixed z-30 inset-x-0 flex justify-center pointer-events-none px-4 md:justify-end md:left-auto md:right-6',
        liftForNav
          ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] md:bottom-6'
          : 'bottom-[max(1rem,env(safe-area-inset-bottom,0px))]',
      )}
    >
      <button
        type="button"
        className="pointer-events-auto flex items-center gap-3 max-w-full min-h-11 rounded-2xl pl-2.5 pr-4 py-2 text-left fade-in"
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 12px 40px -12px rgba(0,0,0,.55)',
        }}
        onClick={() => navigate(draft.to)}
        aria-label={`Open draft: ${draft.preview}`}
      >
        <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent)' }}>
          <Pencil size={16} color="var(--accent-contrast)" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">Open draft</span>
          <span className="block text-sm truncate">{draft.preview}</span>
        </span>
      </button>
    </div>
  )
}
