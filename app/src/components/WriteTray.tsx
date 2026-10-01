import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { VoiceRecord } from '@/components/VoiceRecord'
import { Spinner } from '@/components/ui'
import { useKeyboardInset } from '@/lib/useKeyboardInset'

/** Space under the page so the word count and title hint clear the tray, including the home-indicator inset the tray sits on. */
export const WRITE_TRAY_RESERVE = 'calc(6.5rem + env(safe-area-inset-bottom, 0px))'

/** Cmd/Ctrl+Enter saves from a dream field. */
export function runSaveShortcut(e: { metaKey: boolean; ctrlKey: boolean; key: string; preventDefault: () => void }, save: () => void) {
  if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return
  e.preventDefault()
  save()
}

type WriteTrayProps = {
  onSave: () => void
  canSave: boolean
  saving?: boolean
  saveLabel?: string
  onTranscript: (text: string) => void
  /** Shown while a field is focused — dismisses the keyboard. */
  onDone?: () => void
  showDone?: boolean
  /** Leave the write screen. When `confirmDiscard` is set, this runs only after a second tap. */
  onDiscard: () => void
  /** Ask before discarding. Empty writes leave on the first tap. */
  confirmDiscard?: boolean
  discardTitle?: string
}

/**
 * Thin sticky action tray above the keyboard.
 * Keeps Mic + Save reachable without covering the form (tags, title, etc.).
 */
export function WriteTray({
  onSave,
  canSave,
  saving = false,
  saveLabel = 'Save',
  onTranscript,
  onDone,
  showDone = false,
  onDiscard,
  confirmDiscard = false,
  discardTitle = 'Discard this dream?',
}: WriteTrayProps) {
  const keyboardInset = useKeyboardInset()
  const keyboardOpen = keyboardInset > 60
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmed(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armed])

  useEffect(() => {
    if (!confirmDiscard) setArmed(false)
  }, [confirmDiscard])

  return (
    <div
      className="fixed inset-x-0 z-20 border-t"
      style={{
        bottom: 'max(var(--keyboard-inset, 0px), env(safe-area-inset-bottom, 0px))',
        background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(12px)',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        paddingTop: '0.55rem',
        paddingBottom: keyboardOpen ? '0.55rem' : '0.65rem',
      }}
    >
      {armed ? (
        <div className="max-w-3xl mx-auto">
          <p className="text-sm font-medium mb-2">{discardTitle}</p>
          <div className="flex items-center gap-3">
            <button type="button" className="btn flex-1" onClick={() => setArmed(false)}>
              Keep writing
            </button>
            <button type="button" className="btn btn-danger flex-1" onClick={onDiscard}>
              Discard
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <button type="button" className="btn min-h-11 shrink-0" onClick={() => (confirmDiscard ? setArmed(true) : onDiscard())}>
            Cancel
          </button>
          <div className="flex items-center gap-2 ml-auto min-w-0 pl-2">
            {showDone && onDone && (
              <button type="button" className="btn btn-ghost text-sm" onClick={onDone}>
                Done
              </button>
            )}
            <VoiceRecord variant="icon" onTranscript={onTranscript} />
            <button
              type="button"
              className="btn btn-primary shrink-0"
              disabled={!canSave}
              onClick={onSave}
            >
              {saving ? <Spinner /> : <Check size={16} />} {saveLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
