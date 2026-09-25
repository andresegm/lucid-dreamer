import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { APP_EMAIL, supabase } from './supabase'
import { useSettings } from './settings'

interface AuthCtx {
  session: Session | null
  loading: boolean
  signIn: (passcode: string) => Promise<string | null> // returns error message or null
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const { settings } = useSettings()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Optional auto-lock after inactivity
  useEffect(() => {
    if (!session || settings.lockTimeoutMin <= 0) return
    let t: number
    const reset = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => supabase.auth.signOut(), settings.lockTimeoutMin * 60_000)
    }
    const evs = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll']
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      window.clearTimeout(t)
      evs.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [session, settings.lockTimeoutMin])

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      loading,
      signIn: async (passcode) => {
        const { error } = await supabase.auth.signInWithPassword({ email: APP_EMAIL, password: passcode })
        if (!error) return null
        if (/invalid login credentials/i.test(error.message)) return 'Wrong passcode.'
        return error.message
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, loading],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
