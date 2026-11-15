import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, Lock, LockOpen } from 'lucide-react'
import clsx from 'clsx'
import { fetchTags, setTagLocked } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useSettings } from '@/lib/settings'
import { supabase } from '@/lib/supabase'
import type { Tag } from '@/lib/types'
import { Spinner } from '@/components/ui'

const PIN_RULE = /^\d{4,8}$/

async function hashPin(pin: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

type Panel = null | 'enter' | 'set' | 'forgot'

/**
 * Lock and unlock tags. With a passcode set, locked tags stay unnamed and can't be unlocked
 * until it is entered; locking more tags never needs it.
 */
export function LockedTags() {
  const { settings, update } = useSettings()
  const { email } = useAuth()
  const hasPin = !!settings.tagPinHash && !!settings.tagPinSalt
  const [tags, setTags] = useState<Tag[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false) // passcode entered on this visit
  const [panel, setPanel] = useState<Panel>(null)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const canManage = !hasPin || open

  useEffect(() => { fetchTags(true).then(setTags).catch((e) => setError(String(e))) }, [])

  function show(next: Panel) {
    setPanel(next)
    setPin('')
    setPin2('')
    setPassword('')
    setNote(null)
  }

  async function toggle(t: Tag) {
    if (t.locked && !canManage) return show('enter')
    const locked = !t.locked
    setError(null)
    setTags((cur) => cur?.map((x) => (x.id === t.id ? { ...x, locked } : x)) ?? null)
    try {
      await setTagLocked(t.id, locked)
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e))
      setTags((cur) => cur?.map((x) => (x.id === t.id ? { ...x, locked: !locked } : x)) ?? null)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setNote(null)
    setBusy(true)
    try {
      if (panel === 'enter') {
        if ((await hashPin(pin, settings.tagPinSalt!)) !== settings.tagPinHash) return setNote('That passcode doesn’t match.')
        setOpen(true)
        show(null)
      } else if (panel === 'set') {
        if (!PIN_RULE.test(pin)) return setNote('Use 4 to 8 digits.')
        if (pin !== pin2) return setNote('The two passcodes don’t match.')
        const salt = crypto.randomUUID()
        update({ tagPinSalt: salt, tagPinHash: await hashPin(pin, salt) })
        setOpen(true)
        show(null)
      } else if (panel === 'forgot') {
        if (!email) return setNote('Sign in again to reset the passcode.')
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) return setNote('That isn’t your account password.')
        update({ tagPinSalt: null, tagPinHash: null })
        setOpen(true)
        show(null)
      }
    } finally {
      setBusy(false)
    }
  }

  function removePin() {
    update({ tagPinSalt: null, tagPinHash: null })
    show(null)
  }

  if (!tags) return error ? <p className="text-sm text-danger">{error}</p> : <Spinner />

  const term = q.trim().toLowerCase()
  const lockedCount = tags.filter((t) => t.locked).length
  // Without the passcode, locked tags stay out of the list entirely: their names are private too
  const list = tags
    .filter((t) => (canManage || !t.locked) && (!term || t.name.toLowerCase().includes(term)))
    .sort((a, b) => Number(!!b.locked) - Number(!!a.locked) || a.name.localeCompare(b.name))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <p className="text-xs text-muted flex-1 min-w-[12rem]">
          {lockedCount ? `${lockedCount} locked. ` : ''}
          {canManage ? 'Tap a tag to lock or unlock it.' : 'Tap a tag to lock it. Unlocking needs your passcode.'}
        </p>
        {!canManage && lockedCount > 0 && (
          <button type="button" className="btn" onClick={() => show('enter')}><KeyRound size={14} /> Show locked</button>
        )}
        {canManage && (
          <button type="button" className="btn" onClick={() => show('set')}>
            <KeyRound size={14} /> {hasPin ? 'Change passcode' : 'Add a passcode'}
          </button>
        )}
        {canManage && hasPin && <button type="button" className="btn btn-ghost" onClick={removePin}>Remove passcode</button>}
      </div>

      {panel && (
        <form onSubmit={(e) => void submit(e)} className="rounded-xl p-3 mb-3 grid gap-2 fade-in" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-medium">
            {panel === 'enter' ? 'Enter your passcode' : panel === 'set' ? (hasPin ? 'New passcode' : 'Choose a passcode') : 'Reset with your account password'}
          </div>
          {panel === 'forgot' ? (
            <input className="input" type="password" autoComplete="current-password" autoFocus placeholder="Account password" value={password} onChange={(e) => setPassword(e.target.value)} />
          ) : (
            <input className="input" type="password" inputMode="numeric" autoComplete="off" autoFocus maxLength={8} placeholder={panel === 'set' ? '4 to 8 digits' : 'Passcode'} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          )}
          {panel === 'set' && (
            <input className="input" type="password" inputMode="numeric" autoComplete="off" maxLength={8} placeholder="Repeat it" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
          )}
          {panel === 'set' && <p className="text-xs text-faint">Needed to see or unlock locked tags. If you forget it, your account password resets it.</p>}
          {note && <p className="text-sm text-danger">{note}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : null} {panel === 'set' ? 'Save passcode' : panel === 'forgot' ? 'Reset passcode' : 'Unlock'}</button>
            <button type="button" className="btn" onClick={() => show(null)}>Cancel</button>
            {panel === 'enter' && <button type="button" className="text-xs text-muted hover:text-fg ml-auto" onClick={() => show('forgot')}>Forgot passcode?</button>}
          </div>
        </form>
      )}

      {tags.length === 0 ? (
        <p className="text-sm text-muted">No tags yet.</p>
      ) : (
        <>
          {tags.length > 12 && <input className="input mb-3" placeholder="Find a tag…" value={q} onChange={(e) => setQ(e.target.value)} />}
          <div className="flex flex-wrap gap-1.5 max-h-64 overflow-auto">
            {list.map((t) => (
              <button key={t.id} type="button" className={clsx('chip chip-btn', t.locked && 'chip-active')} aria-pressed={!!t.locked} onClick={() => void toggle(t)}>
                {t.locked ? <Lock size={12} /> : <LockOpen size={12} className="text-faint" />}
                {t.name}
              </button>
            ))}
          </div>
        </>
      )}
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </>
  )
}
