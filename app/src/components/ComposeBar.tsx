import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Check } from 'lucide-react'
import { VoiceRecord } from '@/components/VoiceRecord'
import { Spinner } from '@/components/ui'
import { useKeyboardInset } from '@/lib/useKeyboardInset'

export const COMPOSE_TEXTAREA_MAX_PX = 220

/** Approximate height reserved under scrollable content for the fixed composer. */
export const COMPOSE_BAR_RESERVE = 'calc(7.5rem + env(safe-area-inset-bottom, 0px))'

type ComposeBarProps = {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  canSave: boolean
  saving?: boolean
  placeholder?: string
  onTranscript: (text: string) => void
  leftAction?: ReactNode
  textareaRef?: RefObject<HTMLTextAreaElement>
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  saveLabel?: string
}

/** Chat-style composer pinned above the keyboard / home indicator. */
export function ComposeBar({
  value,
  onChange,
  onSave,
  canSave,
  saving = false,
  placeholder = 'I was in…',
  onTranscript,
  leftAction,
  textareaRef,
  onFocus,
  onBlur,
  onKeyDown,
  saveLabel = 'Save',
}: ComposeBarProps) {
  const keyboardInset = useKeyboardInset()
  const keyboardOpen = keyboardInset > 60
  const localRef = useRef<HTMLTextAreaElement>(null)
  const ref = textareaRef ?? localRef

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(Math.max(el.scrollHeight, 44), COMPOSE_TEXTAREA_MAX_PX)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > COMPOSE_TEXTAREA_MAX_PX ? 'auto' : 'hidden'
  }, [value, ref])

  return (
    <div
      className="fixed inset-x-0 z-20"
      style={{
        bottom: 'max(var(--keyboard-inset, 0px), env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        paddingBottom: keyboardOpen ? '0.5rem' : '0.65rem',
        paddingTop: '0.35rem',
        background: 'linear-gradient(to top, var(--bg) 70%, transparent)',
      }}
    >
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        <div
          className="flex-1 min-w-0 rounded-[1.35rem] px-3 pt-2.5 pb-2"
          style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}
        >
          <textarea
            ref={ref}
            rows={1}
            className="w-full bg-transparent border-0 outline-none resize-none text-base leading-relaxed px-0.5 py-0.5"
            style={{ minHeight: '1.5rem', maxHeight: COMPOSE_TEXTAREA_MAX_PX, boxShadow: 'none' }}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
          />
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="min-w-10">{leftAction}</div>
            <VoiceRecord variant="icon" onTranscript={onTranscript} />
          </div>
        </div>

        <button
          type="button"
          className="shrink-0 h-11 w-11 mb-0.5 rounded-full flex items-center justify-center disabled:opacity-40"
          style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
          disabled={!canSave}
          onClick={onSave}
          aria-label={saving ? 'Saving' : saveLabel}
          title={saveLabel}
        >
          {saving ? <Spinner className="h-4 w-4" /> : <Check size={22} strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  )
}
