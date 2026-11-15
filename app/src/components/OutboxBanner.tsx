import { useCallback, useEffect, useState } from 'react'
import { CloudOff } from 'lucide-react'
import { flushOutbox, readOutbox, subscribeOutbox } from '@/lib/outbox'
import { announceDreamsChanged, showToast } from '@/lib/toast'
import { Spinner } from '@/components/ui'

/** Entries written offline: shows how many are waiting and uploads them when the connection is back. */
export function OutboxBanner({ userId }: { userId: string }) {
  const [waiting, setWaiting] = useState(() => readOutbox(userId).length)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const sync = useCallback(async () => {
    if (!readOutbox(userId).length) return
    setBusy(true)
    const { sent, error } = await flushOutbox(userId)
    setBusy(false)
    setProblem(error ? (error instanceof Error ? error.message : String((error as { message?: unknown }).message ?? error)) : null)
    if (sent) {
      showToast(sent === 1 ? 'Uploaded the dream you wrote offline.' : `Uploaded ${sent} dreams you wrote offline.`)
      announceDreamsChanged()
    }
  }, [userId])

  useEffect(() => {
    const refresh = () => setWaiting(readOutbox(userId).length)
    refresh()
    return subscribeOutbox(refresh)
  }, [userId])

  useEffect(() => {
    void sync()
    const onVisible = () => { if (document.visibilityState === 'visible') void sync() }
    const onOnline = () => void sync()
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sync])

  if (!waiting) return null
  return (
    <div className="card mb-4 flex flex-wrap items-center gap-3 fade-in" style={{ padding: '.7rem 1rem', borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)' }}>
      <CloudOff size={18} className="text-accent shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {waiting === 1 ? '1 dream is saved on this device' : `${waiting} dreams are saved on this device`}
        </div>
        <p className="text-xs text-muted break-words">
          {problem ? `Upload failed: ${problem}` : 'It uploads by itself once you’re back online.'}
        </p>
      </div>
      <button type="button" className="btn shrink-0" disabled={busy} onClick={() => void sync()}>
        {busy ? <Spinner /> : null} Try now
      </button>
    </div>
  )
}
