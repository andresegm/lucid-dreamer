import { supabase } from './supabase'

/** Hard cap so a forgotten Record tap cannot run all day. ~5 min ≈ $0.03. */
export const MAX_RECORD_MS = 5 * 60 * 1000

export function appendTranscript(prev: string, next: string): string {
  const t = next.trim()
  if (!t) return prev
  if (!prev.trim()) return t
  return `${prev.replace(/\s+$/, '')}\n\n${t}`
}

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function voiceSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
}

export async function transcribeBlob(blob: Blob): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Unlock the journal first.')
  const url = import.meta.env.VITE_SUPABASE_URL
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('App is not configured.')

  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('aac') ? 'm4a' : 'webm'
  const fd = new FormData()
  fd.append('audio', blob, `dream.${ext}`)

  const r = await fetch(`${url}/functions/v1/transcribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anon,
    },
    body: fd,
  })
  const data = await r.json().catch(() => ({})) as { text?: string; error?: string; msg?: string }
  if (r.status === 404) throw new Error('Voice is not deployed yet. See the README for the one-time setup.')
  if (!r.ok) throw new Error(data.error || data.msg || 'Transcription failed.')
  const text = (data.text ?? '').trim()
  if (!text) throw new Error('No words came through. Try again a little closer to the mic.')
  return text
}

export interface Recorder {
  stop: () => Promise<Blob>
  elapsed: () => number
}

export async function startRecorder(): Promise<Recorder> {
  if (!voiceSupported()) throw new Error('This browser cannot record audio.')
  const mime = pickMime()
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const chunks: BlobPart[] = []
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
  const started = Date.now()
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  rec.start(250)

  const limit = window.setTimeout(() => { if (rec.state === 'recording') rec.stop() }, MAX_RECORD_MS)

  return {
    elapsed: () => Date.now() - started,
    stop: () => new Promise((resolve, reject) => {
      window.clearTimeout(limit)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' })
        resolve(blob)
      }
      rec.onerror = () => {
        stream.getTracks().forEach((t) => t.stop())
        reject(new Error('Recording failed.'))
      }
      if (rec.state === 'recording') rec.stop()
      else {
        stream.getTracks().forEach((t) => t.stop())
        resolve(new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }))
      }
    }),
  }
}
