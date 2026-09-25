import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import clsx from 'clsx'
import { startRecorder, transcribeBlob, voiceSupported, type Recorder } from '@/lib/voice'
import { Spinner } from '@/components/ui'

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function VoiceRecord({ onTranscript }: { onTranscript: (text: string) => void }) {
  const rec = useRef<Recorder | null>(null)
  const [phase, setPhase] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [tick, setTick] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const supported = voiceSupported()

  useEffect(() => {
    if (phase !== 'recording') return
    const id = window.setInterval(() => setTick((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [phase])

  useEffect(() => () => { void rec.current?.stop() }, [])

  async function toggle() {
    setError(null)
    if (phase === 'transcribing') return
    if (phase === 'recording') {
      const r = rec.current
      rec.current = null
      setPhase('transcribing')
      try {
        const blob = r ? await r.stop() : null
        if (!blob || blob.size < 200) throw new Error('That take was empty. Hold a moment after you tap Record.')
        const text = await transcribeBlob(blob)
        onTranscript(text)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setPhase('idle')
      }
      return
    }
    try {
      rec.current = await startRecorder()
      setTick(0)
      setPhase('recording')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(/denied|notallowed|permission/i.test(msg) ? 'Microphone access was blocked.' : msg)
    }
  }

  if (!supported) return null

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={clsx('btn', phase === 'recording' && 'btn-danger')}
        onClick={() => void toggle()}
        disabled={phase === 'transcribing'}
        aria-pressed={phase === 'recording'}
      >
        {phase === 'transcribing' ? <Spinner /> : phase === 'recording' ? <Square size={16} /> : <Mic size={16} />}
        {phase === 'transcribing' ? 'Transcribing…' : phase === 'recording' ? `Stop · ${fmtElapsed(rec.current?.elapsed() ?? tick)}` : 'Record'}
      </button>
      {error && <p className="text-xs text-danger max-w-xs text-right">{error}</p>}
    </div>
  )
}
