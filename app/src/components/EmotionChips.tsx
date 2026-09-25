import clsx from 'clsx'
import { EMOTIONS } from '@/lib/emotions'

export function EmotionChips({ selected, onToggle }: { selected: string[]; onToggle: (name: string) => void }) {
  const on = new Set(selected.map((s) => s.toLowerCase()))
  return (
    <div>
      <div className="text-xs text-muted mb-1.5">Feeling <span className="text-faint">optional</span></div>
      <div className="flex flex-wrap gap-1.5">
        {EMOTIONS.map((e) => (
          <button
            key={e.name}
            type="button"
            className={clsx('chip chip-btn', on.has(e.name) && 'chip-active')}
            onClick={() => onToggle(e.name)}
          >
            {e.label}
          </button>
        ))}
      </div>
    </div>
  )
}
