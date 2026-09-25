import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Delete, Lock, Moon } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Spinner } from '@/components/ui'

export function LoginPage() {
  const { signIn } = useAuth()
  const [code, setCode] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!code || busy) return
    setBusy(true)
    setError(null)
    const err = await signIn(code)
    setBusy(false)
    if (err) {
      setError(err)
      setShake(true)
      setTimeout(() => setShake(false), 450)
      setCode('')
      inputRef.current?.focus()
    }
  }

  function press(k: string) {
    if (k === 'del') setCode((c) => c.slice(0, -1))
    else if (k === 'ok') void submit()
    else setCode((c) => (c.length < 32 ? c + k : c))
  }

  return (
    <div className="ambient min-h-full flex items-center justify-center p-6">
      <form onSubmit={submit} className="relative z-10 w-full max-w-sm fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-3xl flex items-center justify-center mb-4 shadow-lg" style={{ background: 'var(--accent)', boxShadow: '0 20px 50px -20px var(--accent)' }}>
            <Moon size={30} color="var(--accent-contrast)" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Dream Journal</h1>
          <p className="text-sm text-muted mt-1">Enter your passcode to unlock</p>
        </div>

        <div className={`card ${shake ? 'animate-[shake_.4s_ease]' : ''}`} style={{ padding: '1.25rem' }}>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              ref={inputRef}
              className="input pl-10 pr-16 text-center tracking-[0.35em] text-lg"
              type={show ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={busy}
            />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-fg px-2 py-1" onClick={() => setShow((s) => !s)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>

          {error && <div className="text-sm text-danger mt-3 text-center">{error}</div>}

          {/* Keypad (nice on phones; keyboard works too) */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <button key={k} type="button" className="btn text-lg py-3" onClick={() => press(k)} disabled={busy}>
                {k}
              </button>
            ))}
            <button type="button" className="btn py-3" onClick={() => press('del')} disabled={busy} aria-label="Delete">
              <Delete size={18} />
            </button>
            <button type="button" className="btn text-lg py-3" onClick={() => press('0')} disabled={busy}>
              0
            </button>
            <button type="submit" className="btn btn-primary py-3" disabled={busy || !code}>
              {busy ? <Spinner /> : 'Unlock'}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-faint mt-6">Private journal · Encrypted in transit · Only you can read it</p>
      </form>
      <style>{`@keyframes shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-4px)}40%,60%{transform:translateX(4px)}}`}</style>
    </div>
  )
}
