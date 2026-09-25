import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: auth } } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) return json({ error: 'Voice is not set up yet. Add OPENAI_API_KEY as a Supabase secret.' }, 503)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ error: 'Expected audio form data' }, 400)
  }
  const audio = form.get('audio')
  if (!(audio instanceof File) || audio.size === 0) return json({ error: 'Missing audio' }, 400)
  if (audio.size > 24 * 1024 * 1024) return json({ error: 'Recording is too long' }, 413)

  const body = new FormData()
  body.append('file', audio, audio.name || 'dream.webm')
  body.append('model', 'whisper-1')

  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body,
  })
  if (!r.ok) return json({ error: 'Transcription failed. Try again in a moment.' }, 502)
  const data = await r.json() as { text?: string }
  return json({ text: (data.text ?? '').trim() })
})
