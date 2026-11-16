import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye } from 'lucide-react'
import {
  fetchSignDreams, fetchSignScan, runSignScan,
  SIGN_CATEGORY_LABELS, SIGN_SCAN_SIZES, visibleSigns,
  type SignDreamRef, type SignScan, type SignScanSize,
} from '@/lib/signScan'
import { fmtDate, fmtDateRange } from '@/lib/format'
import { Segmented, Skeleton, Spinner } from '@/components/ui'

const message = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e))

/** AI scan of recent dreams for dream signs: recurring elements and oddities that can cue a reality check. Once a day. */
export function DreamSigns() {
  const [scan, setScan] = useState<SignScan | null>(null)
  const [refs, setRefs] = useState<Map<string, SignDreamRef> | null>(new Map())
  const [size, setSize] = useState<SignScanSize>(50)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  async function show(next: SignScan) {
    setScan(next)
    // Also the visibility check: a dream missing from here has been locked or deleted since the scan.
    setRefs(await fetchSignDreams(next.result?.signs.flatMap((s) => s.dream_ids) ?? []).catch(() => null))
  }

  useEffect(() => {
    fetchSignScan().then(show).catch((e) => {
      setError(message(e))
      setScan({ result: null, scannedAt: null, canScan: true, running: false })
    })
  }, [])

  // A scan started before this card was opened (another tab, or this one before navigating away)
  // keeps running on the server. Wait for it here instead of showing a spent, empty card.
  const waiting = !busy && !!scan?.running
  const showRef = useRef(show)
  showRef.current = show
  useEffect(() => {
    if (!waiting) return
    const t = window.setInterval(() => { fetchSignScan().then((s) => showRef.current(s)).catch(() => {}) }, 4000)
    return () => window.clearInterval(t)
  }, [waiting])
  const reading = busy || waiting

  async function run() {
    setBusy(true)
    setError(null)
    setOpen(null)
    try {
      await show(await runSignScan(size))
    } catch (e) {
      setError(message(e))
      // The limit may have been used on another device; pick up whatever is saved.
      await fetchSignScan().then(show).catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  const result = scan?.result ?? null
  // A saved sign quotes moments from its dreams, so it is only shown while every one of them is still visible.
  const signs = refs ? visibleSigns(result, refs) : []
  const hidden = result && refs ? result.signs.length - signs.length : 0

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold flex items-center gap-2"><Eye size={16} className="text-accent" /> Dream signs</h2>
          <p className="text-xs text-muted mt-0.5 max-w-prose">
            The people, places, themes, and oddities your dreams keep returning to, each with a cue for checking whether you’re dreaming.
          </p>
        </div>
        {scan?.canScan && !waiting && (
          <div className="flex items-center gap-2 shrink-0">
            <Segmented<`${SignScanSize}`>
              value={`${size}`}
              onChange={(v) => setSize(Number(v) as SignScanSize)}
              options={SIGN_SCAN_SIZES.map((n) => ({ value: `${n}` as `${SignScanSize}`, label: `${n}` }))}
            />
            <button className="btn btn-primary" disabled={busy} onClick={() => void run()}>
              {busy ? <Spinner /> : null} {busy ? 'Reading…' : result ? 'Look again' : 'Find my signs'}
            </button>
          </div>
        )}
      </div>

      {scan?.canScan && !waiting && (
        <p className="text-xs text-faint mt-2">
          Sends the text of your last {size} dreams to OpenAI for analysis. Dreams under a locked tag are left out. Once a day.
        </p>
      )}
      {error && <p className="text-sm text-danger mt-3 break-words">{error}</p>}

      {!scan ? (
        <Skeleton className="h-16 mt-3" />
      ) : reading ? (
        <p className="text-sm text-muted mt-4 flex items-center gap-2">{waiting && <Spinner />} Reading your dreams. This can take up to a minute. You can leave this page; the result is saved.</p>
      ) : !result ? (
        !error && <p className="text-sm text-faint mt-4">No scan yet. Pick how many recent dreams to read.</p>
      ) : !refs ? (
        <p className="text-sm text-muted mt-4">Couldn’t check which of these dreams are still visible. Reload to see your signs.</p>
      ) : result.signs.length === 0 ? (
        <p className="text-sm text-muted mt-4">Nothing recurring stood out in those {result.dream_count} dreams. Try again after a few more nights.</p>
      ) : (
        <ol className="mt-4 grid gap-2">
          {signs.map((s, i) => {
            const dreams = s.dream_ids.map((id) => refs.get(id)).filter((d): d is SignDreamRef => !!d)
            const expanded = open === i
            return (
              <li key={`${s.name}-${i}`} className="rounded-xl border" style={{ borderColor: 'var(--border)', padding: '.7rem .85rem' }}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{s.name}</span>
                  <span className="chip">{SIGN_CATEGORY_LABELS[s.category] ?? s.category}</span>
                  <button
                    type="button"
                    className="chip chip-btn ml-auto tabular-nums"
                    aria-expanded={expanded}
                    disabled={dreams.length === 0}
                    onClick={() => setOpen(expanded ? null : i)}
                  >
                    {s.dream_ids.length} {s.dream_ids.length === 1 ? 'dream' : 'dreams'}
                  </button>
                </div>
                <p className="text-sm text-muted mt-1.5">{s.detail}</p>
                {s.cue && <p className="text-sm mt-1.5">{s.cue}</p>}
                {expanded && (
                  <ul className="mt-2 grid gap-0.5">
                    {dreams.map((d) => (
                      <li key={d.id}>
                        <Link to={`/dream/${d.id}`} className="text-sm text-accent hover:underline">
                          {d.title || 'Untitled'} <span className="text-faint">· {fmtDate(d.date, 'MMM d')}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {hidden > 0 && !reading && (
        <p className="text-xs text-faint mt-3">
          {hidden} {hidden === 1 ? 'sign is' : 'signs are'} hidden because {hidden === 1 ? 'it draws' : 'they draw'} on dreams that have since been locked or deleted.
        </p>
      )}
      {result && !reading && (
        <p className="text-xs text-faint mt-3">
          From {result.dream_count} dreams, {fmtDateRange(result.from, result.to)}
          {scan?.scannedAt ? ` · scanned ${fmtDate(scan.scannedAt.slice(0, 10), 'MMM d')}` : ''}
          {scan && !scan.canScan ? ' · next scan tomorrow (UTC)' : ''}
        </p>
      )}
    </div>
  )
}
