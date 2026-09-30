import { Check } from 'lucide-react'
import { VoiceRecord } from '@/components/VoiceRecord'
import { Spinner } from '@/components/ui'
import { useKeyboardInset } from '@/lib/useKeyboardInset'

/** Space to leave under page content so the sticky tray doesn’t cover it. */
export const WRITE_TRAY_RESERVE = '5.5rem'

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
}: WriteTrayProps) {
  const keyboardInset = useKeyboardInset()
  const keyboardOpen = keyboardInset > 60

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
      <div className="max-w-3xl mx-auto flex items-center gap-2">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {showDone && onDone && (
            <button type="button" className="btn btn-ghost text-sm" onClick={onDone}>
              Done
            </button>
          )}
        </div>
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
  )
}
