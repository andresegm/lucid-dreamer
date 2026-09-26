import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useSettings } from './settings'

const redirectTo = () => `${window.location.origin}/`

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

  useEffect(() => {
    if (!session || settings.lockTimeoutMin <= 0 || recovery) return
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
  }, [session, settings.lockTimeoutMin, recovery])

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
