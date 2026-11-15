import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useSettings } from './settings'

const redirectTo = () => `${window.location.origin}/`

/** Last time the journal was used, so auto-lock still applies after the tab was closed or the phone slept. */
const ACTIVE_KEY = 'ldj.lastActive'
function readActive(): number {
  try { return Number(localStorage.getItem(ACTIVE_KEY)) || 0 } catch { return 0 }
}
function writeActive(at: number | null) {
  try {
    if (at == null) localStorage.removeItem(ACTIVE_KEY)
    else localStorage.setItem(ACTIVE_KEY, String(at))
  } catch { /* private mode */ }
}

export function authMessage(error: { message: string }): string {
  const m = error.message
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.'
  if (/email not confirmed/i.test(m)) return 'Confirm your email first — check your inbox for the link.'
  if (/user already registered/i.test(m)) return 'That email already has an account. Sign in instead.'
  if (/password/i.test(m) && /least|characters|weak/i.test(m)) return 'Password must be at least 6 characters.'
  if (/rate limit/i.test(m)) return 'Too many tries. Wait a minute and try again.'
  return m
}

interface AuthCtx {
  session: Session | null
  loading: boolean
  recovery: boolean
  email: string | null
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<'check-email' | string | null>
  signOut: () => Promise<void>
  requestReset: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
  resendSignup: (email: string) => Promise<string | null>
  clearRecovery: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const { settings } = useSettings()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signedIn = !!session
  useEffect(() => {
    if (loading) return
    if (!signedIn || settings.lockTimeoutMin <= 0 || recovery) {
      writeActive(null)
      return
    }
    const limit = settings.lockTimeoutMin * 60_000
    const lock = () => {
      writeActive(null)
      void supabase.auth.signOut()
    }
    const expired = () => {
      const last = readActive()
      return last > 0 && Date.now() - last > limit
    }
    if (expired()) {
      lock()
      return
    }
    let t: number
    let stamped = 0
    const reset = () => {
      window.clearTimeout(t)
      t = window.setTimeout(lock, limit)
      const now = Date.now()
      if (now - stamped > 5000) {
        stamped = now
        writeActive(now)
      }
    }
    // Timers don't run while the phone sleeps, so check the clock on the way back
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (expired()) lock()
      else reset()
    }
    const evs = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll']
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    document.addEventListener('visibilitychange', onVisible)
    reset()
    return () => {
      window.clearTimeout(t)
      evs.forEach((e) => window.removeEventListener(e, reset))
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loading, signedIn, settings.lockTimeoutMin, recovery])

  const value = useMemo<AuthCtx>(
    () => ({
      session,
      loading,
      recovery,
      email: session?.user.email ?? null,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        return error ? authMessage(error) : null
      },
      signUp: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo() },
        })
        if (error) return authMessage(error)
        if (data.user && !data.session) return 'check-email'
        return null
      },
      signOut: async () => {
        setRecovery(false)
        await supabase.auth.signOut()
      },
      requestReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() })
        return error ? authMessage(error) : null
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) return authMessage(error)
        setRecovery(false)
        return null
      },
      resendSignup: async (email) => {
        const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectTo() } })
        return error ? authMessage(error) : null
      },
      clearRecovery: () => setRecovery(false),
    }),
    [session, loading, recovery],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
