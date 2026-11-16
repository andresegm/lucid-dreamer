import { Check, Undo2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { addRealityCheck, type PracticeDay } from '@/lib/practice'
import { genericTrigger, signOfDay, type DreamSign } from '@/lib/signs'
import type { ScannedSign } from '@/lib/signScan'
import { todayISO } from '@/lib/format'

/**
 * Today's trigger, taken from what recurs in your own dreams, and a one-tap counter.
 * A scanned dream sign comes with its own cue, so those are used when there are any; otherwise the most used tags.
 */
export function RealityCheck({ uid, days, signs, scanned = [], goal }: { uid: string; days: PracticeDay[]; signs: DreamSign[]; scanned?: ScannedSign[]; goal: number }) {
  const today = todayISO()
  const count = days.find((d) => d.date === today)?.rc_count ?? 0
  const scan = signOfDay(scanned, today)
  const sign = scan ? null : signOfDay(signs, today)
  const reached = count >= goal

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1 basis-56">
        <div className="text-sm">
          {scan ? (
            <>Today’s trigger: <Link to="/stats#lucid" className="font-semibold text-accent hover:underline">{scan.name}</Link></>
          ) : sign ? (
            <>
              Today’s trigger: <Link to={`/tag/${sign.id}`} className="font-semibold text-accent hover:underline">{sign.name}</Link>
              <span className="text-faint"> · in {sign.dreams} dreams</span>
            </>
          ) : (
            <>Today’s trigger: <span className="font-semibold">whenever {genericTrigger(today)}</span></>
          )}
        </div>
        <p className="text-xs text-muted mt-0.5">
          {scan ? `${scan.cue || 'When it happens, stop and ask if you’re dreaming.'}` : sign ? 'When you see it, hear it or think of it, stop and ask if you’re dreaming.' : 'Stop and ask if you’re dreaming.'} Pinch your nose and try to breathe.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm tabular-nums" style={reached ? { color: 'var(--accent)', fontWeight: 600 } : undefined}>
          {count} of {goal} today
        </span>
        {count > 0 && (
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => addRealityCheck(uid, today, -1)} aria-label="Take one back" title="Take one back">
            <Undo2 size={15} />
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={() => addRealityCheck(uid, today, 1)}>
          <Check size={16} /> Did a check
        </button>
      </div>
    </div>
  )
}
