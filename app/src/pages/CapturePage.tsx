import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Sparkles } from 'lucide-react'
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
import { keepTextareaAboveKeyboard, useKeyboardInset } from '@/lib/useKeyboardInset'

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

  useEffect(() => { fetchTags().then(setAllTags).catch(() => {}) }, [])
  useEffect(() => { ta.current?.focus() }, [])
  useEffect(() => {
    if (text.trim()) localStorage.setItem(captureDraft, text)
    else localStorage.removeItem(captureDraft)
  }, [text, captureDraft])

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
  const composing = focused || keyboardInset > 60

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

  function onTextChange(value: string) {
    setText(value)
    const el = ta.current
    if (el) keepTextareaAboveKeyboard(el, { pageScroll: !composing })
  }

  function renderSaveButton() {
    return (
      <button type="button" className="btn btn-primary" disabled={!canSave} onClick={() => void save()}>
        {saving ? <Spinner /> : <Check size={16} />} Save
      </button>
    )
  }

  return (
    <div
      className="max-w-3xl fade-in flex flex-col"
      style={{
        // Subtract top safe-area too: standalone PWA has a large inset under the
        // status bar, and the old 100dvh math pushed the in-flow Save below the fold.
        minHeight: composing
          ? 'calc(100svh - var(--keyboard-inset, 0px) - env(safe-area-inset-top, 0px) - 5.5rem)'
          : '70vh',
        paddingBottom: composing ? '4.25rem' : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-4 shrink-0">
        <button type="button" className="btn btn-ghost -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost text-sm" onClick={toFullForm}>
            Full form
          </button>
          {renderSaveButton()}
        </div>
      </div>

      {!composing && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight shrink-0">Write it down</h1>
          <p className="text-sm text-muted mt-1 mb-4 shrink-0">Don’t organize. Just dump everything you remember — tags and lucidity can wait.</p>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-3 shrink-0">
        <label className="flex items-center gap-2 text-sm text-muted">
          Date
          <input type="date" className="input py-1.5 w-auto" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </label>
        {date !== todayISO() && (
          <button type="button" className="text-xs text-accent hover:underline" onClick={() => setDate(todayISO())}>Use today</button>
        )}
        <span className="ml-auto text-xs text-faint tabular-nums">{words} words · ⌘ Enter to save</span>
      </div>

      {/* Keep voice reachable while composing — short form auto-focuses the
          textarea, so gating on !composing hid Record for the whole session. */}
      <div className="flex justify-end mb-2 shrink-0">
        <VoiceRecord onTranscript={(t) => setText((prev) => appendTranscript(prev, t))} />
      </div>

      <textarea
        ref={ta}
        className="input text-base flex-1 min-h-[12rem] leading-relaxed overflow-y-auto"
        placeholder="I was in…"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        onKeyDown={onKey}
        onFocus={() => {
          setFocused(true)
          if (ta.current) keepTextareaAboveKeyboard(ta.current, { pageScroll: false })
        }}
        onBlur={() => setFocused(false)}
        onSelect={() => { if (ta.current) keepTextareaAboveKeyboard(ta.current, { pageScroll: !composing }) }}
      />

      {!composing && (
        <>
          <div
            className="shrink-0 flex items-center justify-between gap-2 mt-3 pt-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <span className="text-xs text-faint tabular-nums">{words} words</span>
            {renderSaveButton()}
          </div>

          <div className="mt-3 shrink-0">
            <EmotionChips
              selected={activeEmotions.map((e) => e.name)}
              onToggle={(name) => setEmotionOn((o) => ({ ...o, [name]: !activeEmotions.some((e) => e.name === name) }))}
            />
          </div>

          {saveNames.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3 text-xs text-muted fade-in shrink-0">
              <Sparkles size={12} className="text-accent shrink-0" />
              <span>Will tag:</span>
              {saveNames.map((name) => (
                <span key={name} className="chip chip-active">{name}</span>
              ))}
            </div>
          )}
        </>
      )}

      {error && <div className="card text-sm text-danger mt-3 shrink-0">{error}</div>}

      {/* Fixed while composing so standalone PWA safe-area / status-bar padding
          can’t push Save under the keyboard or off-screen. */}
      {composing && (
        <div
          className="fixed inset-x-0 z-20 flex items-center justify-between gap-2 border-t"
          style={{
            bottom: 'max(var(--keyboard-inset, 0px), env(safe-area-inset-bottom, 0px))',
            background: 'var(--bg)',
            borderColor: 'var(--border)',
            paddingTop: '0.75rem',
            paddingBottom: '0.75rem',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
          }}
        >
          <span className="text-xs text-faint tabular-nums">{words} words</span>
          {renderSaveButton()}
        </div>
      )}
    </div>
  )
}
