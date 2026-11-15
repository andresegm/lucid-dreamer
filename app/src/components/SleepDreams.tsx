import { useEffect, useState } from 'react'
import { fetchAllLite } from '@/lib/api'
import { MIN_NIGHTS_TO_COMPARE, compareSleepToDreams, fetchSleepLogs, type NightGroup, type SleepComparison } from '@/lib/sleep'

const pct = (n: number) => `${Math.round(n * 100)}%`

function Row({ g, other }: { g: NightGroup; other: NightGroup }) {
  return (
    <tr>
      <th scope="row" className="text-left font-normal py-1 pr-3">{g.label}</th>
      <td className="text-right tabular-nums text-muted py-1 px-2">{g.nights}</td>
      <td className="text-right tabular-nums py-1 px-2" style={g.recall > other.recall ? { color: 'var(--accent)', fontWeight: 600 } : undefined}>{pct(g.recall)}</td>
      <td className="text-right tabular-nums py-1 pl-2" style={g.lucid > other.lucid ? { color: 'var(--lucid)', fontWeight: 600 } : undefined}>{pct(g.lucid)}</td>
    </tr>
  )
}

/** Do WBTB, alarm-free mornings, or longer nights line up with more remembered or lucid dreams? */
export function SleepDreams({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<SleepComparison[] | null>(null)
  const [nights, setNights] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchSleepLogs(365), fetchAllLite()])
      .then(([logs, dreams]) => {
        if (cancelled) return
        setNights(logs.length)
        setRows(compareSleepToDreams(logs, dreams))
      })
      .catch(() => { if (!cancelled) setRows(null) })
    return () => { cancelled = true }
  }, [refreshKey])

  if (!rows || nights === 0) return null
  const ready = rows.filter((r) => r.enough)

  return (
    <section className="card mt-8">
      <h2 className="font-semibold mb-1">Sleep and dreams</h2>
      <p className="text-xs text-muted mb-4">
        How often a kind of night ended with a remembered dream, and with a lucid one. From your last {nights} logged {nights === 1 ? 'night' : 'nights'}; a pattern, not proof.
      </p>
      {ready.length === 0 ? (
        <p className="text-sm text-muted">
          Not enough yet. Each comparison needs at least {MIN_NIGHTS_TO_COMPARE} nights on both sides, for example {MIN_NIGHTS_TO_COMPARE} with WBTB and {MIN_NIGHTS_TO_COMPARE} without.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
          {ready.map((r) => (
            <div key={r.title} className="min-w-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-faint">
                    <th scope="col" className="text-left font-semibold pb-1 pr-3">{r.title}</th>
                    <th scope="col" className="text-right font-medium pb-1 px-2">Nights</th>
                    <th scope="col" className="text-right font-medium pb-1 px-2">Recall</th>
                    <th scope="col" className="text-right font-medium pb-1 pl-2">Lucid</th>
                  </tr>
                </thead>
                <tbody>
                  <Row g={r.a} other={r.b} />
                  <Row g={r.b} other={r.a} />
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      {ready.length > 0 && ready.length < rows.length && (
        <p className="text-xs text-faint mt-4">
          Still gathering: {rows.filter((r) => !r.enough).map((r) => r.title.toLowerCase()).join(', ')}.
        </p>
      )}
    </section>
  )
}
