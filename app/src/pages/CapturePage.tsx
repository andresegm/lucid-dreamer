import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type UIEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Maximize2, Sparkles } from 'lucide-react'
import { createDream, ensureTags, fetchTags } from '@/lib/api'
import { suggestTags } from '@/lib/autotag'
import { titleFromDump, todayISO, wordCount } from '@/lib/format'
import { EMOTIONS, isEmotion } from '@/lib/emotions'
import { appendTranscript } from '@/lib/voice'
import type { Tag } from '@/lib/types'
import { EmotionChips } from '@/components/EmotionChips'
import { VoiceRecord } from '@/components/VoiceRecord'
import { Spinner } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { draftKey } from '@/lib/drafts'
import { useKeyboardInset } from '@/lib/useKeyboardInset'

const TEXTAREA_MAX_PX = 220

export function CapturePage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const uid = session!.user.id
  const captureDraft = draftKey(uid, 'capture')
  const keyboardInset = useKeyboardInset()
  const [date, setDate] = useState(todayISO)
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(draftKey(uid, 'capture')) ?? localStorage.getItem('ldj.draft.capture') ?? '' } catch { return '' }
  })
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emotionOn, setEmotionOn] = useState<Record<string, boolean>>({})
  const [focused, setFocused] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  // Ignore scroll-dismiss briefly after focus so iOS keyboard open can't race-blur.
  const allowScrollDismiss = useRef(false)

  useEffect(() => { fetchTags().then(setAllTags).catch(() => {}) }, [])
  useEffect(() => { ta.current?.focus() }, [])
  useEffect(() => {
    if (text.trim()) localStorage.setItem(captureDraft, text)
    else localStorage.removeItem(captureDraft)
  }, [text, captureDraft])

  // Auto-grow the composer field up to a cap; overflow scrolls inside.
  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(Math.max(el.scrollHeight, 44), TEXTAREA_MAX_PX)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > TEXTAREA_MAX_PX ? 'auto' : 'hidden'
  }, [text, focused])

  const words = useMemo(() => wordCount(text), [text])
  const matches = useMemo(
    () => suggestTags(text, allTags, []).filter((s) => s.exists),
    [text, allTags],
  )
  const impliedEmotions = useMemo(
    () => new Set(suggestTags(text, allTags, []).filter((s) => isEmotion(s.name)).map((s) => s.name.toLowerCase())),
    [text, allTags],
  )
  const activeEmotions = useMemo(
    () => EMOTIONS.filter((e) => (e.name in emotionOn ? emotionOn[e.name] : impliedEmotions.has(e.name))),
    [emotionOn, impliedEmotions],
  )
  const saveNames = useMemo(() => {
    const names = [
      ...matches.filter((s) => !isEmotion(s.name)).map((s) => s.name),
      ...activeEmotions.map((e) => e.name),
    ]
    const seen = new Set<string>()
    return names.filter((n) => {
      const k = n.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [matches, activeEmotions])
  const canSave = text.trim().length > 0 && !saving
  const keyboardOpen = keyboardInset > 60

  async function save() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const tags = await ensureTags(saveNames)
      const saved = await createDream({
        date,
        title: titleFromDump(text),
        description: text.trim(),
        lucidity: 'non-lucid',
        induction_method: null,
        induction_notes: null,
        entry_type: 'dream',
        favorite: false,
        tagIds: tags.map((t) => t.id),
      })
      localStorage.removeItem(captureDraft)
      navigate(`/dream/${saved.id}`, { replace: true, state: { captured: true } })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function toFullForm() {
    const draft = {
      date,
      title: titleFromDump(text),
      description: text,
      lucidity: 'non-lucid',
      induction_method: '',
      induction_custom: '',
      induction_notes: '',
      entry_type: 'dream',
      favorite: false,
      tags: saveNames,
    }
    localStorage.setItem(draftKey(uid, 'new'), JSON.stringify(draft))
    localStorage.removeItem(captureDraft)
    navigate('/new')
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void save()
    }
  }

  function dismissKeyboard() {
    if (document.activeElement === ta.current) ta.current?.blur()
  }

  // Scroll the sheet above the composer → close keyboard (chat-app pattern).
  function onSheetScroll(_e: UIEvent<HTMLDivElement>) {
    if (!keyboardOpen || !allowScrollDismiss.current) return
    dismissKeyboard()
  }

  return (
    <div
      className="max-w-3xl fade-in flex flex-col"
      style={{
        minHeight: 'calc(100svh - env(safe-area-inset-top, 0px) - 4.5rem)',
        // Reserve room for the fixed composer (+ home indicator when keyboard closed).
        paddingBottom: 'calc(7.5rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-4 shrink-0">
        <button type="button" className="btn btn-ghost -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <button type="button" className="btn btn-ghost text-sm" onClick={toFullForm}>
          Full form
        </button>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        onScroll={onSheetScroll}
      >
        <h1 className="text-2xl font-semibold tracking-tight">Write it down</h1>
        <p className="text-sm text-muted mt-1 mb-4">Don’t organize. Just dump everything you remember — tags and lucidity can wait.</p>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm text-muted">
            Date
            <input type="date" className="input py-1.5 w-auto" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </label>
          {date !== todayISO() && (
            <button type="button" className="text-xs text-accent hover:underline" onClick={() => setDate(todayISO())}>Use today</button>
          )}
          <span className="ml-auto text-xs text-faint tabular-nums">{words} words</span>
        </div>

        <div className="mb-3">
          <EmotionChips
            selected={activeEmotions.map((e) => e.name)}
            onToggle={(name) => setEmotionOn((o) => ({ ...o, [name]: !activeEmotions.some((e) => e.name === name) }))}
          />
        </div>

        {saveNames.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs text-muted fade-in">
            <Sparkles size={12} className="text-accent shrink-0" />
            <span>Will tag:</span>
            {saveNames.map((name) => (
              <span key={name} className="chip chip-active">{name}</span>
            ))}
          </div>
        )}

        {error && <div className="card text-sm text-danger mb-3">{error}</div>}

        {keyboardOpen && (
          <p className="text-xs text-faint pb-6">Scroll up to close the keyboard and edit tags.</p>
        )}
      </div>

      {/* Chat-style composer: fixed above keyboard / home indicator. */}
      <div
        className="fixed inset-x-0 z-20"
        style={{
          bottom: 'max(var(--keyboard-inset, 0px), env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
          paddingBottom: keyboardOpen ? '0.5rem' : '0.65rem',
          paddingTop: '0.35rem',
          background: 'linear-gradient(to top, var(--bg) 70%, transparent)',
        }}
      >
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <div
            className="flex-1 min-w-0 rounded-[1.35rem] px-3 pt-2.5 pb-2"
            style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}
          >
            <textarea
              ref={ta}
              rows={1}
              className="w-full bg-transparent border-0 outline-none resize-none text-base leading-relaxed px-0.5 py-0.5"
              style={{ minHeight: '1.5rem', maxHeight: TEXTAREA_MAX_PX, boxShadow: 'none' }}
              placeholder="I was in…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              onFocus={() => {
                setFocused(true)
                allowScrollDismiss.current = false
                window.setTimeout(() => { allowScrollDismiss.current = true }, 450)
              }}
              onBlur={() => {
                setFocused(false)
                allowScrollDismiss.current = false
              }}
            />
            <div className="flex items-center justify-between gap-2 mt-1">
              <button
                type="button"
                className="h-10 w-10 rounded-full flex items-center justify-center text-muted hover:text-fg hover:bg-elev2"
                onClick={toFullForm}
                aria-label="Open full form"
                title="Full form"
              >
                <Maximize2 size={18} />
              </button>
              <div className="flex items-center gap-0.5">
                <VoiceRecord
                  variant="icon"
                  onTranscript={(t) => setText((prev) => appendTranscript(prev, t))}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            className="shrink-0 h-11 w-11 mb-0.5 rounded-full flex items-center justify-center disabled:opacity-40"
            style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            disabled={!canSave}
            onClick={() => void save()}
            aria-label={saving ? 'Saving' : 'Save dream'}
            title="Save"
          >
            {saving ? <Spinner className="h-4 w-4" /> : <Check size={22} strokeWidth={2.5} />}
          </button>
        </div>
      </div>
    </div>
  )
}
