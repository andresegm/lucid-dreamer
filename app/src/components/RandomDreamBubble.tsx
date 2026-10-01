import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dices } from 'lucide-react'
import clsx from 'clsx'
import { fetchRandomDream } from '@/lib/api'
import { latestOpenDraft, subscribeDrafts } from '@/lib/drafts'

function dreamIdFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/dream\/([^/]+)$/)
  return m?.[1] ?? null
}

/** Floating “next random” chip — only while browsing via Random dream. */
export function RandomDreamBubble({
  userId,
  pathname,
  active,
  liftForNav,
}: {
  userId: string
  pathname: string
  active: boolean
  liftForNav: boolean
}) {
  const navigate = useNavigate()
  const currentId = dreamIdFromPath(pathname)
  const [draftOpen, setDraftOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!active) {
      setDraftOpen(false)
      return
    }
    const refresh = () => {
      const next = latestOpenDraft(userId)
      setDraftOpen(Boolean(next && next.to !== pathname))
    }
    refresh()
    return subscribeDrafts(refresh)
  }, [userId, pathname, active])

  if (!active) return null

  async function nextRandom() {
    if (busy) return
    setBusy(true)
    try {
      const dream = await fetchRandomDream(currentId ?? undefined)
      if (!dream) return
      navigate(`/dream/${dream.id}`, { state: { fromRandom: true } })
    } finally {
      setBusy(false)
    }
  }

  // Sit above the draft bubble when both are visible so neither covers the other.
  const stackAboveDraft = draftOpen

  return (
    <div
      className={clsx(
        'fixed z-30 inset-x-0 flex justify-center pointer-events-none px-4 md:justify-end md:left-auto md:right-6',
        stackAboveDraft
          ? liftForNav
            ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+6.5rem+4.75rem)] md:bottom-[calc(1.5rem+4.75rem)]'
            : 'bottom-[calc(max(1rem,env(safe-area-inset-bottom,0px))+4.75rem)]'
          : liftForNav
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
        disabled={busy}
        onClick={() => void nextRandom()}
        aria-label="Open another random dream"
      >
        <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent)' }}>
          <Dices size={16} color="var(--accent-contrast)" />
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
            {busy ? 'Picking…' : 'Random dream'}
          </span>
          <span className="block text-sm truncate">Tap for another</span>
        </span>
      </button>
    </div>
  )
}
