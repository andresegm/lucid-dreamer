import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Lock, Mail, Moon } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Segmented, Spinner } from '@/components/ui'

type Mode = 'signin' | 'signup' | 'forgot' | 'check-email'

export function LoginPage() {
  const { signIn, signUp, requestReset, updatePassword, resendSignup, recovery, email: sessionEmail } = useAuth()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(() => (params.get('mode') === 'signup' ? 'signup' : 'signin'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => { emailRef.current?.focus() }, [mode, recovery])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setResent(false)

    if (recovery) {
      if (password.length < 6) { setError('Password must be at least 6 characters.'); setBusy(false); return }
      if (password !== confirm) { setError('Passwords do not match.'); setBusy(false); return }
      const err = await updatePassword(password)
      setBusy(false)
      if (err) setError(err)
      return
    }

    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) { setError('Enter a valid email.'); setBusy(false); return }

    if (mode === 'forgot') {
      const err = await requestReset(trimmed)
      setBusy(false)
      if (err) setError(err)
      else setMode('check-email')
      return
    }

    if (mode === 'signup') {
      if (password.length < 6) { setError('Password must be at least 6 characters.'); setBusy(false); return }
      if (password !== confirm) { setError('Passwords do not match.'); setBusy(false); return }
      const result = await signUp(trimmed, password)
      setBusy(false)
      if (result === 'check-email') setMode('check-email')
      else if (result) setError(result)
      return
    }

    if (!password) { setError('Enter your password.'); setBusy(false); return }
    const err = await signIn(trimmed, password)
    setBusy(false)
    if (err) setError(err)
  }

  async function resend() {
    if (!email.trim() || busy) return
    setBusy(true)
    setError(null)
    const err = await resendSignup(email.trim())
    setBusy(false)
    if (err) setError(err)
    else setResent(true)
  }

  const title = recovery ? 'Set a new password' : mode === 'signup' ? 'Create your journal' : mode === 'forgot' ? 'Reset password' : mode === 'check-email' ? 'Check your email' : 'Welcome back'
  const sub = recovery
    ? 'Choose a password for this journal.'
    : mode === 'signup'
      ? 'An email and a password is enough to start.'
      : mode === 'forgot'
        ? 'We’ll send a reset link if that email has an account.'
        : mode === 'check-email'
          ? `Open the link we sent to ${email || sessionEmail || 'your email'} to continue.`
          : 'Good to see you.'

  return (
    <div className="ambient min-h-full flex items-center justify-center p-6">
      <form onSubmit={submit} className="relative z-10 w-full max-w-sm fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-3xl flex items-center justify-center mb-4 shadow-lg" style={{ background: 'var(--accent)', boxShadow: '0 20px 50px -20px var(--accent)' }}>
            <Moon size={30} color="var(--accent-contrast)" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted mt-1 text-center">{sub}</p>
        </div>

        {!recovery && mode !== 'check-email' && mode !== 'forgot' && (
          <div className="flex justify-center mb-4">
            <Segmented<'signin' | 'signup'>
              value={mode === 'signup' ? 'signup' : 'signin'}
              onChange={(v) => { setMode(v); setError(null) }}
              options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Sign up' }]}
            />
          </div>
        )}

        <div className="card" style={{ padding: '1.25rem' }}>
          {mode === 'check-email' && !recovery ? (
            <div className="grid gap-3">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void resend()}>
                {busy ? <Spinner /> : resent ? 'Sent again' : 'Resend link'}
              </button>
              <button type="button" className="btn" onClick={() => { setMode('signin'); setError(null) }}>
                Back to sign in
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {!recovery && (
                <label className="block">
                  <span className="label">Email</span>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                    <input
                      ref={emailRef}
                      className="input pl-10"
                      type="email"
                      autoComplete="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={busy}
                      required
                    />
                  </div>
                </label>
              )}

              {mode !== 'forgot' && (
                <label className="block">
                  <span className="label">{recovery ? 'New password' : 'Password'}</span>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
                    <input
                      className="input pl-10"
                      type="password"
                      autoComplete={mode === 'signup' || recovery ? 'new-password' : 'current-password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy}
                      minLength={6}
                      required
                    />
                  </div>
                </label>
              )}

              {(mode === 'signup' || recovery) && (
                <label className="block">
                  <span className="label">Confirm password</span>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={busy}
                    minLength={6}
                    required
                  />
                </label>
              )}

              {error && <div className="text-sm text-danger text-center">{error}</div>}

              <button type="submit" className="btn btn-primary mt-1" disabled={busy}>
                {busy ? <Spinner /> : recovery ? 'Save password' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
              </button>

              {!recovery && mode === 'signin' && (
                <button type="button" className="text-xs text-muted hover:text-fg text-center" onClick={() => { setMode('forgot'); setError(null) }}>
                  Forgot password?
                </button>
              )}
              {!recovery && mode === 'forgot' && (
                <button type="button" className="text-xs text-muted hover:text-fg text-center" onClick={() => { setMode('signin'); setError(null) }}>
                  Back to sign in
                </button>
              )}
            </div>
          )}
        </div>
        {!recovery && (
          <p className="text-center text-xs text-faint mt-6">
            <Link to="/" className="hover:text-fg">← Back to Lucid</Link>
          </p>
        )}
      </form>
    </div>
  )
}
