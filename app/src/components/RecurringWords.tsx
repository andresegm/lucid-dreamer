import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { fetchDreamTexts } from '@/lib/api'
import { recurringWords, type RecurringWord } from '@/lib/autotag'
import type { Tag } from '@/lib/types'
import { Spinner } from '@/components/ui'

/** Recurring words that aren't tags yet. Tapping one opens Tag by phrase with it filled in. */
export function RecurringWords({ tags, onPick }: { tags: Tag[]; onPick: (word: string) => void }) {
  const [words, setWords] = useState<RecurringWord[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function look() {
    setBusy(true)
    setError(null)
    try {
      setWords(recurringWords(await fetchDreamTexts(), tags))
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mb-4" style={{ padding: '.8rem 1rem' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold flex items-center gap-2"><Sparkles size={16} className="text-accent" /> Recurring words</h2>
          <p className="text-xs text-muted mt-0.5">People, places, and things that keep coming back but aren’t tags yet.</p>
        </div>
        <button className="btn shrink-0" disabled={busy} onClick={() => void look()}>
          {busy ? <Spinner /> : null} {words ? 'Look again' : 'Look for them'}
        </button>
      </div>
      {error && <p className="text-sm text-danger mt-3 break-words">{error}</p>}
      {words && (
        words.length === 0 ? (
          <p className="text-sm text-muted mt-3">Nothing stands out yet. This needs a word to show up in at least three entries.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {words.map((w) => (
                <button key={w.word} type="button" className="chip chip-btn" onClick={() => onPick(w.word)} title={`In ${w.dreams} entries. Tap to tag them.`}>
                  {w.word} <span className="tabular-nums text-faint">{w.dreams}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-faint mt-2">The number is how many entries mention it. Tap one to tag them all.</p>
          </>
        )
      )}
    </div>
  )
}
