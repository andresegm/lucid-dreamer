import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth'
import { loadPractice, onPracticeChanged, practiceDays, type PracticeDay } from './practice'

/** Practice days from `since` on, kept current as checks and sessions are logged anywhere in the app. */
export function usePractice(since: string): { uid: string; days: PracticeDay[]; loaded: boolean; setupNeeded: boolean; error: unknown } {
  const { session } = useAuth()
  const uid = session!.user.id
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<{ loaded: boolean; setupNeeded: boolean; error: unknown }>({ loaded: false, setupNeeded: false, error: null })

  useEffect(() => onPracticeChanged(() => setTick((n) => n + 1)), [])

  useEffect(() => {
    let cancelled = false
    loadPractice(uid, since)
      .then((r) => { if (!cancelled) setState({ loaded: true, setupNeeded: r.setupNeeded, error: null }) })
      .catch((error) => { if (!cancelled) setState({ loaded: true, setupNeeded: false, error }) })
    return () => { cancelled = true }
  }, [uid, since])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const days = useMemo(() => practiceDays(uid, since), [uid, since, tick, state])
  return { uid, days, ...state }
}
