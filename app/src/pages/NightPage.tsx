import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { fetchDreams } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { saveNewDream } from '@/lib/outbox'
import { nearMissesIn } from '@/lib/nearMiss'
import { useScannedSigns } from '@/lib/useScannedSigns'
import { saveMildSession, sessionDate } from '@/lib/practice'
import { fmtDate, titleFromDump, todayISO } from '@/lib/format'
import { EMPTY_FILTERS } from '@/lib/types'
import { Spinner } from '@/components/ui'

type Step = 'wake' | 'write' | 'recall' | 'cue' | 'rehearse' | 'done'
const ORDER: Step[] = ['wake', 'recall', 'cue', 'rehearse']

interface SessionDream { id: string | null; date: string; title: string; description: string; tags: string[] }

const MANTRA = 'Next time I’m dreaming, I’ll remember I’m dreaming.'

/**
 * The Wake Back To Bed screen: recall a dream, find the moment you could have noticed, rehearse noticing it,
 * go back to sleep. Dim red on black so it costs as little night vision and alertness as possible.
 */
export function NightPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const uid = session!.user.id
  const [step, setStep] = useState<Step>('wake')
  const [dreams, setDreams] = useState<SessionDream[] | null>(null)
  const [pick, setPick] = useState(0)
  const [draft, setDraft] = useState('')
  const [cue, setCue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedOffline, setSavedOffline] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const [awakeMin, setAwakeMin] = useState(0)

  useEffect(() => {
    const t = window.setInterval(() => setAwakeMin(Math.floor((Date.now() - startedAt) / 60_000)), 15_000)
    return () => window.clearInterval(t)
  }, [startedAt])

  useEffect(() => {
    let cancelled = false
    fetchDreams({ ...EMPTY_FILTERS, includeNotes: false, sort: 'newest' }, 1, 5)
      .then((page) => {
        if (cancelled) return
        setDreams(page.rows.map((d) => ({ id: d.id, date: d.date, title: d.title, description: d.description, tags: d.tags.map((t) => t.name) })))
      })
      // Offline at 4 a.m. is normal; the session still works from a dream written now or a cue typed in
      .catch(() => { if (!cancelled) setDreams([]) })
    return () => { cancelled = true }
  }, [])

  const dream = dreams?.[pick] ?? null
  const moments = useMemo(() => (dream ? nearMissesIn(dream.description, 4) : []), [dream])
  // Scanned dream signs to rehearse: the ones found in this dream first, then the rest. None when offline or never scanned.
  const scanned = useScannedSigns()
  const signOptions = useMemo(() => {
    const here = scanned.filter((s) => !!dream?.id && s.dream_ids.includes(dream.id))
    return [...here.map((s) => ({ sign: s, here: true })), ...scanned.filter((s) => !here.includes(s)).map((s) => ({ sign: s, here: false }))].slice(0, 4)
  }, [scanned, dream])

  async function saveDraft() {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    try {
      const { dream: saved } = await saveNewDream(uid, {
        date: todayISO(),
        title: titleFromDump(text),
        description: text,
        lucidity: 'non-lucid',
        induction_method: null,
        induction_notes: null,
        entry_type: 'dream',
        favorite: false,
      }, [])
      setDreams((list) => [{ id: saved?.id ?? null, date: todayISO(), title: titleFromDump(text), description: text, tags: [] }, ...(list ?? [])])
      setPick(0)
      setDraft('')
      setCue('')
      setStep('cue')
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    if (busy) return
    setBusy(true)
    const state = await saveMildSession(uid, sessionDate(), cue, dream?.id ?? null)
    setSavedOffline(state !== 'ok')
    setBusy(false)
    setStep('done')
  }

  const progress = ORDER.indexOf(step === 'write' ? 'wake' : step)

  return (
    <div className="night">
      <div className="night-inner">
        <div className="flex items-center justify-between mb-8">
          <button type="button" className="btn btn-ghost btn-icon -ml-2" onClick={() => navigate('/')} aria-label="Close night session">
            <X size={18} />
          </button>
          {step !== 'done' && (
            <div className="flex items-center gap-1.5" aria-label={`Step ${progress + 1} of ${ORDER.length}`}>
              {ORDER.map((s, i) => (
                <span key={s} className="h-1.5 w-6 rounded-full" style={{ background: i <= progress ? 'var(--text)' : 'var(--border-strong)' }} />
              ))}
            </div>
          )}
          <span className="text-xs text-faint tabular-nums w-16 text-right">{step === 'done' ? '' : `${awakeMin} min up`}</span>
        </div>

        {step === 'wake' && (
          <Screen title="You’re up. Good." body="Sit up a little so you don’t drop straight back off. Five to ten minutes awake is enough.">
            <button type="button" className="btn btn-primary w-full" onClick={() => setStep('write')}>I just woke from a dream</button>
            <button type="button" className="btn w-full" onClick={() => setStep('recall')}>No dream right now</button>
          </Screen>
        )}

        {step === 'write' && (
          <Screen title="Write it before it goes" body="A few lines are enough. You can fill it in tomorrow.">
            <textarea
              className="input min-h-[10rem]"
              autoFocus
              placeholder="I was in…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            {error && <p className="text-sm break-words">{error}</p>}
            <button type="button" className="btn btn-primary w-full" disabled={!draft.trim() || busy} onClick={() => void saveDraft()}>
              {busy ? <Spinner /> : null} Save and use this dream
            </button>
            <button type="button" className="btn btn-ghost w-full" onClick={() => setStep('recall')}>Skip, use an earlier dream</button>
          </Screen>
        )}

        {step === 'recall' && (
          dreams == null ? (
            <div className="flex items-center gap-2 text-muted"><Spinner /> Finding a dream…</div>
          ) : dream ? (
            <Screen title="Go back into this one" body="Read it slowly. See the place, who was there, how it felt.">
              <div className="night-dream">
                <div className="text-xs text-faint mb-2">{fmtDate(dream.date, 'EEE, MMM d')} · {dream.title || 'Untitled'}</div>
                <p className="whitespace-pre-wrap break-words leading-relaxed">{dream.description || dream.title}</p>
              </div>
              <button type="button" className="btn btn-primary w-full" onClick={() => setStep('cue')}>I’m there</button>
              {dreams.length > 1 && (
                <button type="button" className="btn btn-ghost w-full" onClick={() => { setPick((p) => (p + 1) % dreams.length); setCue('') }}>
                  A different dream
                </button>
              )}
            </Screen>
          ) : (
            <Screen title="No dream to work from" body="That’s fine. Pick something that often shows up in your dreams, and rehearse noticing that.">
              <button type="button" className="btn btn-primary w-full" onClick={() => setStep('cue')}>Continue</button>
            </Screen>
          )
        )}

        {step === 'cue' && (
          <Screen
            title="Where could you have noticed?"
            body={dream ? 'Pick the moment that should have told you it was a dream, or write your own.' : 'Name the thing you’ll notice next time.'}
          >
            {moments.length > 0 && (
              <div className="grid gap-2">
                {moments.map((m) => (
                  <button
                    key={m.text}
                    type="button"
                    className="night-option"
                    data-active={cue === m.text}
                    onClick={() => setCue(m.text)}
                  >
                    <span className="text-[11px] uppercase tracking-wide text-faint block mb-0.5">{m.label}</span>
                    {m.text}
                  </button>
                ))}
              </div>
            )}
            {signOptions.length > 0 && (
              <div className="grid gap-2">
                {signOptions.map(({ sign, here }) => (
                  <button
                    key={sign.name}
                    type="button"
                    className="night-option"
                    data-active={cue === sign.name}
                    onClick={() => setCue(sign.name)}
                  >
                    <span className="text-[11px] uppercase tracking-wide text-faint block mb-0.5">{here ? 'Your dream sign · in this dream' : 'Your dream sign'}</span>
                    {sign.name}
                  </button>
                ))}
              </div>
            )}
            {dream && dream.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {dream.tags.slice(0, 8).map((t) => {
                  const text = `Noticing ${t}`
                  return (
                    <button key={t} type="button" className={cue === text ? 'chip chip-btn chip-active' : 'chip chip-btn'} onClick={() => setCue(text)}>
                      {t}
                    </button>
                  )
                })}
              </div>
            )}
            <input
              className="input"
              placeholder="The stairs that kept going up"
              value={cue}
              onChange={(e) => setCue(e.target.value)}
            />
            <button type="button" className="btn btn-primary w-full" disabled={!cue.trim()} onClick={() => setStep('rehearse')}>Rehearse it</button>
            <button type="button" className="btn btn-ghost w-full" onClick={() => setStep('recall')}>Back to the dream</button>
          </Screen>
        )}

        {step === 'rehearse' && (
          <Screen title="Now replay it, and catch it" body="Close your eyes. Run the dream again. When you reach this moment, this time you stop and know you’re dreaming.">
            <div className="night-dream">
              <p className="break-words leading-relaxed">{cue}</p>
            </div>
            <div className="flex items-center gap-4 py-2">
              <span className="night-pulse shrink-0" aria-hidden="true" />
              <p className="text-lg leading-snug font-medium">{MANTRA}</p>
            </div>
            <p className="text-sm text-muted">
              Say it and mean it, a few times through. Then put the phone down and let it be the last thing on your mind.
            </p>
            <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void finish()}>
              {busy ? <Spinner /> : null} Done. Back to sleep
            </button>
          </Screen>
        )}

        {step === 'done' && (
          <Screen
            title="Goodnight"
            body={savedOffline ? 'Kept on this device; it uploads by itself later.' : 'Tonight’s attempt is logged.'}
          >
            <p className="text-lg leading-snug font-medium">{MANTRA}</p>
            <p className="text-sm text-muted">Screen off now. In the morning, write down whatever you remember, even if it’s nothing.</p>
            <button type="button" className="btn btn-ghost w-full" onClick={() => navigate('/')}>Close</button>
          </Screen>
        )}
      </div>
    </div>
  )
}

function Screen({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="fade-in grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted mt-2 leading-relaxed">{body}</p>
      </div>
      {children}
    </div>
  )
}
