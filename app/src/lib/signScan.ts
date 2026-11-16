import { supabase } from './supabase'

/** Keep in sync with claim_sign_scan() in supabase/dream-signs.sql */
export const SIGN_SCAN_DAILY_LIMIT = 1
/** A scan with no result after this long is treated as dead. Keep in sync with claim_sign_scan(). */
const SCAN_STALE_MS = 5 * 60 * 1000
export const SIGN_SCAN_SIZES = [10, 25, 50] as const
export type SignScanSize = (typeof SIGN_SCAN_SIZES)[number]

export type SignCategory = 'recurring' | 'awareness' | 'action' | 'form' | 'context'

export const SIGN_CATEGORY_LABELS: Record<SignCategory, string> = {
  recurring: 'Recurring',
  awareness: 'Awareness',
  action: 'Action',
  form: 'Form',
  context: 'Context',
}

export interface ScannedSign {
  name: string
  category: SignCategory
  detail: string
  cue: string
  dream_ids: string[]
}

export interface SignScanResult {
  signs: ScannedSign[]
  dream_count: number
  from: string
  to: string
}

export interface SignScan {
  result: SignScanResult | null
  scannedAt: string | null
  /** False once today's (UTC) scan is used. */
  canScan: boolean
  /** A scan was started (here or elsewhere) and has not saved its result yet. */
  running: boolean
}

export interface SignDreamRef {
  id: string
  title: string
  date: string
}

const utcToday = () => new Date().toISOString().slice(0, 10)

/** The last saved scan, and whether today's is still available. */
export async function fetchSignScan(): Promise<SignScan> {
  const { data, error } = await supabase.from('dream_sign_scans').select('day, result, scanned_at, started_at').maybeSingle()
  if (error) throw error
  const started = data?.started_at ? Date.parse(data.started_at as string) : NaN
  const scanned = data?.scanned_at ? Date.parse(data.scanned_at as string) : NaN
  const usedToday = !!data && (data.day as string) >= utcToday()
  const unfinished = usedToday && Number.isFinite(started) && !(scanned >= started)
  const stale = unfinished && Date.now() - started > SCAN_STALE_MS
  return {
    result: (data?.result as SignScanResult | null) ?? null,
    scannedAt: (data?.scanned_at as string | null) ?? null,
    // A dead scan gives the day's use back; the server applies the same rule.
    canScan: !usedToday || stale,
    running: unfinished && !stale,
  }
}

/** Sends the last `limit` visible dreams to the dream-signs Edge Function. Uses today's scan. */
export async function runSignScan(limit: SignScanSize): Promise<SignScan> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Unlock the journal first.')
  const url = import.meta.env.VITE_SUPABASE_URL
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('App is not configured.')

  const r = await fetch(`${url}/functions/v1/dream-signs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anon,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ limit }),
  })
  const data = await r.json().catch(() => ({})) as { result?: SignScanResult; scanned_at?: string; error?: string; msg?: string }
  if (r.status === 404) throw new Error('Dream signs are not deployed yet. See the README for the one-time setup.')
  if (!r.ok || !data.result) throw new Error(data.error || data.msg || 'The analysis failed.')
  return { result: data.result, scannedAt: data.scanned_at ?? new Date().toISOString(), canScan: false, running: false }
}

/** A saved sign quotes moments from its dreams, so it only counts while every one of them is still visible. */
export function visibleSigns(result: SignScanResult | null, refs: Map<string, SignDreamRef>): ScannedSign[] {
  return (result?.signs ?? []).filter((s) => s.dream_ids.every((id) => refs.has(id)))
}

/** Signs from the last scan that can still be shown, most useful first. Empty when there is no scan. */
export async function fetchVisibleSigns(): Promise<ScannedSign[]> {
  const { result } = await fetchSignScan()
  if (!result?.signs.length) return []
  return visibleSigns(result, await fetchSignDreams(result.signs.flatMap((s) => s.dream_ids)))
}

/** Titles for the dreams a scan points at. Read through visible_dreams, so locked or deleted ones drop out. */
export async function fetchSignDreams(ids: string[]): Promise<Map<string, SignDreamRef>> {
  const unique = [...new Set(ids)]
  if (!unique.length) return new Map()
  const { data, error } = await supabase.from('visible_dreams').select('id, title, date').in('id', unique)
  if (error) throw error
  return new Map(((data ?? []) as SignDreamRef[]).map((d) => [d.id, d]))
}
