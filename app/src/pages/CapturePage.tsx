import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { createDream, ensureTags, fetchTags } from '@/lib/api'
import { suggestTags } from '@/lib/autotag'
import { titleFromDump, todayISO, wordCount } from '@/lib/format'
import { EMOTIONS, isEmotion } from '@/lib/emotions'
import { appendTranscript } from '@/lib/voice'
import type { Tag } from '@/lib/types'
import { EmotionChips } from '@/components/EmotionChips'
import { GrowingTextarea } from '@/components/GrowingTextarea'
import { WriteTray, WRITE_TRAY_RESERVE } from '@/components/WriteTray'
import { useAuth } from '@/lib/auth'
import { draftKey } from '@/lib/drafts'

export function CapturePage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const uid = session!.user.id
  const captureDraft = draftKey(uid, 'capture')
  const [date, setDate] = useState(todayISO)
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(draftKey(uid, 'capture')) ?? localStorage.getItem('ldj.draft.capture') ?? '' } catch { return '' }
  })
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emotionOn, setEmotionOn] = useState<Record<string, boolean>>({})
  const [fieldFocused, setFieldFocused] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { fetchTags().then(setAllTags).catch(() => {}) }, [])
  useEffect(() => {
    if (text.trim()) localStorage.setItem(captureDraft, text)
    else localStorage.removeItem(captureDraft)
  }, [text, captureDraft])

  const words = useMemo(() => wordCount(text), [text])
  const suggestions = useMemo(() => suggestTags(text, allTags, []), [text, allTags])
  const matches = useMemo(() => suggestions.filter((s) => s.exists), [suggestions])
  const impliedEmotions = useMemo(
    () => new Set(suggestions.filter((s) => isEmotion(s.name)).map((s) => s.name.toLowerCase())),
    [suggestions],
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

  return (
    <div className="max-w-3xl fade-in" style={{ paddingBottom: WRITE_TRAY_RESERVE }}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <button type="button" className="btn btn-ghost -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <button type="button" className="btn btn-ghost text-sm" onClick={toFullForm}>
          Full form
        </button>
      </div>

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

      <GrowingTextarea
        ref={ta}
        value={text}
        onChange={setText}
        placeholder="I was in…"
        onKeyDown={onKey}
        onFocus={() => setFieldFocused(true)}
        onBlur={() => setFieldFocused(false)}
        minPx={160}
        maxPx={320}
      />

      {error && <div className="card text-sm text-danger mt-3">{error}</div>}

      <WriteTray
        onSave={() => void save()}
        canSave={canSave}
        saving={saving}
        saveLabel="Save"
        onTranscript={(t) => setText((prev) => appendTranscript(prev, t))}
        showDone={fieldFocused}
        onDone={() => { ta.current?.blur(); setFieldFocused(false) }}
      />
    </div>
  )
}
