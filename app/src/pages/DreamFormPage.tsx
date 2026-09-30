import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Check, Plus, Sparkles, Star } from 'lucide-react'
import clsx from 'clsx'
import { createDream, ensureTags, fetchDream, fetchTags, updateDream } from '@/lib/api'
import { INDUCTION_DESCRIPTIONS, INDUCTION_METHODS, LUCIDITY_OPTIONS, type EntryType, type Lucidity, type Tag } from '@/lib/types'
import { todayISO, wordCount } from '@/lib/format'
import { appendTranscript } from '@/lib/voice'
import { suggestTags, type Suggestion } from '@/lib/autotag'
import { useSettings } from '@/lib/settings'
import { useAuth } from '@/lib/auth'
import { draftKey } from '@/lib/drafts'
import { keepTextareaAboveKeyboard, useDismissKeyboardOnAway } from '@/lib/useKeyboardInset'
import { Field, Segmented, Spinner } from '@/components/ui'
import { TagPicker } from '@/components/TagPicker'
import { EmotionChips } from '@/components/EmotionChips'
import { VoiceRecord } from '@/components/VoiceRecord'
import { ComposeBar, COMPOSE_BAR_RESERVE } from '@/components/ComposeBar'

interface FormState {
  date: string
  title: string
  description: string
  lucidity: Lucidity
  induction_method: string
  induction_custom: string
  induction_notes: string
  entry_type: EntryType
  favorite: boolean
  tags: string[] // names
}

export function DreamFormPage({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const newDraft = draftKey(session!.user.id, 'new')
  const { settings } = useSettings()
  // When editing an existing dream, never add tags silently — only suggest.
  const autoTagMode = settings.autoTag === 'auto' && mode === 'edit' ? 'suggest' : settings.autoTag
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [autoAdded, setAutoAdded] = useState<string[]>([])
  const dismissed = useRef(new Set<string>()) // tags the user removed; never re-add them
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mobileUi, setMobileUi] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const dreamTa = useRef<HTMLTextAreaElement>(null)
  const { keyboardOpen, arm, disarm, sheetProps } = useDismissKeyboardOnAway(dreamTa)

  const [f, setF] = useState<FormState>(() => {
    if (mode === 'new') {
      try {
        const d = localStorage.getItem(newDraft) ?? localStorage.getItem('ldj.draft.new')
        if (d) return { ...JSON.parse(d), date: todayISO() } as FormState
      } catch { /* ignore */ }
    }
    return { date: todayISO(), title: '', description: '', lucidity: 'non-lucid', induction_method: '', induction_custom: '', induction_notes: '', entry_type: 'dream', favorite: false, tags: [] }
  })
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))

  useEffect(() => { fetchTags().then(setAllTags).catch(() => {}) }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setMobileUi(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (mode !== 'edit' || !id) return
    fetchDream(id)
      .then((d) => {
        if (!d) return navigate('/dreams', { replace: true })
        const std = INDUCTION_METHODS.includes(d.induction_method as never)
        setF({
          date: d.date, title: d.title, description: d.description, lucidity: d.lucidity,
          induction_method: d.induction_method ? (std ? d.induction_method : 'other') : '',
          induction_custom: d.induction_method && !std ? d.induction_method : '',
          induction_notes: d.induction_notes ?? '', entry_type: d.entry_type, favorite: d.favorite,
          tags: d.tags.map((t) => t.name),
        })
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [mode, id, navigate])

  // Persist a draft for new dreams so nothing is lost on accidental navigation
  useEffect(() => {
    if (mode !== 'new') return
    const hasContent = f.title || f.description || f.tags.length
    if (hasContent) localStorage.setItem(newDraft, JSON.stringify(f))
    else localStorage.removeItem(newDraft)
  }, [f, mode, newDraft])

  // Desktop: focus title. Mobile: leave focus alone so the bottom composer isn't fought.
  useEffect(() => {
    if (loading || mobileUi) return
    titleRef.current?.focus()
  }, [loading, mobileUi])

  // Lucid implies an induction method is relevant; non-lucid clears it
  useEffect(() => {
    if (f.lucidity === 'non-lucid' && f.induction_method) set('induction_method', '')
  }, [f.lucidity]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-tagging: scan title + description (debounced) for existing tags and keyword rules.
  useEffect(() => {
    if (autoTagMode === 'off' || loading) { setSuggestions([]); return }
    const timer = setTimeout(() => {
      const found = suggestTags(`${f.title}\n${f.description}`, allTags, f.tags).filter((s) => !dismissed.current.has(s.name.toLowerCase()))
      if (autoTagMode === 'auto') {
        // Existing tags are applied directly; brand-new keyword tags stay as suggestions so nothing is created silently.
        const apply = found.filter((s) => s.exists).map((s) => s.name)
        if (apply.length) {
          setF((s) => ({ ...s, tags: [...s.tags, ...apply.filter((n) => !s.tags.some((t) => t.toLowerCase() === n.toLowerCase()))] }))
          setAutoAdded((a) => [...a, ...apply.filter((n) => !a.includes(n))])
        }
        setSuggestions(found.filter((s) => !s.exists))
      } else {
        setSuggestions(found)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [f.title, f.description, f.tags, allTags, autoTagMode, loading])

  function onTagsChange(next: string[]) {
    // Remember removals so auto-tagging doesn't put them straight back.
    for (const t of f.tags) if (!next.includes(t)) dismissed.current.add(t.toLowerCase())
    for (const t of next) dismissed.current.delete(t.toLowerCase())
    setAutoAdded((a) => a.filter((n) => next.includes(n)))
    set('tags', next)
  }

  function addSuggestion(name: string) {
    dismissed.current.delete(name.toLowerCase())
    set('tags', [...f.tags, name])
  }

  const words = useMemo(() => wordCount(f.description), [f.description])
  const needsTitle = f.title.trim().length === 0
  const canSave = !needsTitle && !!f.date && !saving
  const saveLabel = needsTitle ? 'Add a title' : mode === 'new' ? 'Save dream' : 'Save changes'

  function focusTitle() {
    const el = titleRef.current
    if (!el) return
    el.focus()
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  function renderSaveButton() {
    if (needsTitle) {
      return (
        <button
          type="button"
          className="btn btn-primary"
          onClick={focusTitle}
          aria-describedby="save-needs-title"
        >
          <Check size={16} /> {saveLabel}
        </button>
      )
    }
    return (
      <button type="submit" className="btn btn-primary" disabled={!canSave}>
        {saving ? <Spinner /> : <Check size={16} />} {saveLabel}
      </button>
    )
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (needsTitle) {
      focusTitle()
      return
    }
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const tags = await ensureTags(f.tags)
      const induction = f.induction_method === 'other' ? f.induction_custom.trim() || null : f.induction_method || null
      const input = {
        date: f.date,
        title: f.title.trim(),
        description: f.description.trim(),
        lucidity: f.lucidity,
        induction_method: induction,
        induction_notes: f.induction_notes.trim() || null,
        entry_type: f.entry_type,
        favorite: f.favorite,
        tagIds: tags.map((t) => t.id),
      }
      const saved = mode === 'new' ? await createDream(input) : await updateDream(id!, input)
      if (mode === 'new') localStorage.removeItem(newDraft)
      navigate(`/dream/${saved.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  function onDreamKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  if (loading)
    return (
      <div className="flex items-center gap-2 text-muted"><Spinner /> Loading…</div>
    )

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="max-w-3xl fade-in"
      style={mobileUi ? { paddingBottom: COMPOSE_BAR_RESERVE } : undefined}
    >
      <div className="flex items-center justify-between gap-2 mb-5">
        <button type="button" className="btn btn-ghost -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> {mode === 'new' ? 'Cancel' : 'Back'}
        </button>
        <div className="flex items-center gap-2">
          <button type="button" className={clsx('btn btn-icon', f.favorite && 'text-lucid')} onClick={() => set('favorite', !f.favorite)} aria-label="Favorite">
            <Star size={18} className={f.favorite ? 'fill-current' : ''} />
          </button>
          {renderSaveButton()}
        </div>
      </div>

      {needsTitle && (
        <p id="save-needs-title" className="text-xs text-muted -mt-3 mb-5">
          A title is required before you can save.
        </p>
      )}

      <h1 className="text-2xl font-semibold tracking-tight mb-5">{mode === 'new' ? 'New dream' : 'Edit dream'}</h1>

      <div
        className={clsx('grid gap-5', mobileUi && 'overflow-y-auto overscroll-contain')}
        {...(mobileUi ? sheetProps : {})}
      >
        <div className="grid sm:grid-cols-[180px_1fr] gap-4">
          <Field label="Date">
            <input type="date" className="input" value={f.date} max={todayISO()} onChange={(e) => set('date', e.target.value)} required />
            {f.date !== todayISO() && (
              <button type="button" className="text-xs text-accent mt-1.5 hover:underline" onClick={() => set('date', todayISO())}>Use today</button>
            )}
          </Field>
          <Field label="Title" hint={needsTitle ? 'Required to save this dream.' : undefined}>
            <input
              ref={titleRef}
              className="input text-base"
              style={needsTitle ? { outline: '1.5px solid color-mix(in srgb, var(--accent) 60%, transparent)', outlineOffset: 1 } : undefined}
              placeholder="Give this dream a name…"
              value={f.title}
              onChange={(e) => set('title', e.target.value)}
              required
              aria-invalid={needsTitle}
              aria-describedby={needsTitle ? 'save-needs-title' : undefined}
            />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Entry type">
            <Segmented value={f.entry_type} onChange={(v) => set('entry_type', v)} options={[{ value: 'dream', label: 'Dream' }, { value: 'note', label: 'Note' }]} />
          </Field>
          {f.entry_type === 'dream' && (
            <Field label="Lucidity">
              <Segmented value={f.lucidity} onChange={(v) => set('lucidity', v)} options={LUCIDITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
            </Field>
          )}
        </div>

        {f.entry_type === 'dream' && f.lucidity !== 'non-lucid' && (
          <div className="card fade-in" style={{ borderColor: 'color-mix(in srgb, var(--lucid) 35%, transparent)' }}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="label mb-0">Induction method</span>
              <Link to="/learn#methods" className="text-xs text-muted hover:text-fg shrink-0">What these mean</Link>
            </div>
            <div>
              <div className="flex flex-wrap gap-1.5">
                {INDUCTION_METHODS.map((m) => (
                  <button key={m} type="button" className={clsx('chip chip-btn', f.induction_method === m && 'chip-active')} onClick={() => set('induction_method', f.induction_method === m ? '' : m)}>
                    {m}
                  </button>
                ))}
                <button type="button" className={clsx('chip chip-btn', f.induction_method === 'other' && 'chip-active')} onClick={() => set('induction_method', f.induction_method === 'other' ? '' : 'other')}>
                  Other…
                </button>
              </div>
              {f.induction_method === 'other' && (
                <input className="input mt-2" placeholder="Custom method name" value={f.induction_custom} onChange={(e) => set('induction_custom', e.target.value)} />
              )}
              <p className="text-xs text-faint mt-1.5">
                {f.induction_method && f.induction_method !== 'other'
                  ? INDUCTION_DESCRIPTIONS[f.induction_method as keyof typeof INDUCTION_DESCRIPTIONS]
                  : 'How did you become lucid?'}
              </p>
            </div>
            <Field label="Induction notes" className="mt-4">
              <input className="input" placeholder="e.g. Woke at 4am, WBTB for 30 min, counted breaths…" value={f.induction_notes} onChange={(e) => set('induction_notes', e.target.value)} />
            </Field>
          </div>
        )}

        <Field label="Tags" hint="Characters, places, dream signs, themes… Enter to add; new tags are created automatically.">
          <div className="mb-3">
            <EmotionChips
              selected={f.tags}
              onToggle={(name) => {
                const has = f.tags.some((t) => t.toLowerCase() === name)
                if (has) onTagsChange(f.tags.filter((t) => t.toLowerCase() !== name))
                else onTagsChange([...f.tags, name])
              }}
            />
          </div>
          <TagPicker all={allTags} selected={f.tags} onChange={onTagsChange} />
          {autoAdded.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted fade-in">
              <Sparkles size={12} className="text-accent shrink-0" />
              <span>Auto-tagged from your text: {autoAdded.join(', ')}. Remove any you don't want.</span>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 fade-in">
              <span className="text-xs text-muted mr-0.5 inline-flex items-center gap-1"><Sparkles size={12} className="text-accent" /> Suggested</span>
              {suggestions.map((s) => (
                <button key={s.name} type="button" className="chip chip-btn" onClick={() => addSuggestion(s.name)} title={s.exists ? 'Add tag' : 'Create and add tag'}>
                  {!s.exists && <Plus size={12} className="text-accent" />}
                  {s.name}
                </button>
              ))}
              {suggestions.length > 1 && (
                <button type="button" className="text-xs text-accent hover:underline ml-1" onClick={() => { suggestions.forEach((s) => dismissed.current.delete(s.name.toLowerCase())); set('tags', [...f.tags, ...suggestions.map((s) => s.name)]) }}>
                  Add all
                </button>
              )}
            </div>
          )}
        </Field>

        {/* Desktop: classic in-flow dream field. Mobile: bottom ComposeBar. */}
        {!mobileUi && (
          <Field label={f.entry_type === 'note' ? 'Note' : 'Dream'}>
            <div className="flex justify-end mb-2">
              <VoiceRecord onTranscript={(t) => setF((s) => ({ ...s, description: appendTranscript(s.description, t) }))} />
            </div>
            <DesktopDreamTextarea
              value={f.description}
              onChange={(v) => set('description', v)}
              placeholder="Write everything you remember — scenes, feelings, oddities, what made you realize you were dreaming…"
            />
            <div className="text-xs text-faint mt-1.5 text-right tabular-nums">{words} words</div>
          </Field>
        )}

        {mobileUi && (
          <div className="text-sm text-muted">
            <span className="label">{f.entry_type === 'note' ? 'Note' : 'Dream'}</span>
            <p className="mt-1">
              {f.description.trim()
                ? <span className="text-fg line-clamp-3 whitespace-pre-wrap">{f.description}</span>
                : 'Write in the composer below — mic and Save stay above the keyboard.'}
            </p>
            <p className="text-xs text-faint mt-1 tabular-nums">{words} words</p>
            {keyboardOpen && (
              <p className="text-xs text-faint mt-2">Scroll or drag this area to close the keyboard.</p>
            )}
          </div>
        )}

        {error && <div className="card text-sm text-danger">{error}</div>}

        {!mobileUi && (
          <div className="flex flex-col items-end gap-1.5 pb-6">
            {needsTitle && (
              <p className="text-xs text-muted">A title is required to save.</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => navigate(-1)}>Cancel</button>
              {renderSaveButton()}
            </div>
          </div>
        )}
      </div>

      {mobileUi && (
        <ComposeBar
          value={f.description}
          onChange={(v) => set('description', v)}
          onSave={() => void submit()}
          canSave={canSave}
          saving={saving}
          saveLabel={saveLabel}
          placeholder={f.entry_type === 'note' ? 'Write your note…' : 'Write everything you remember…'}
          onTranscript={(t) => setF((s) => ({ ...s, description: appendTranscript(s.description, t) }))}
          textareaRef={dreamTa}
          onFocus={arm}
          onBlur={disarm}
          onKeyDown={onDreamKey}
        />
      )}
    </form>
  )
}

function DesktopDreamTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(240, el.scrollHeight) + 'px'
    if (document.activeElement === el) keepTextareaAboveKeyboard(el)
  }, [value])

  return (
    <textarea
      ref={ref}
      className="input text-base min-h-[240px]"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => { if (ref.current) keepTextareaAboveKeyboard(ref.current) }}
    />
  )
}
