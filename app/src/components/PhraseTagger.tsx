import { useEffect, useMemo, useState } from 'react'
import { Tags } from 'lucide-react'
import { appendDreamTags, ensureTags, fetchDreamTexts } from '@/lib/api'
import { phrasePattern } from '@/lib/autotag'
import { Modal, Spinner } from '@/components/ui'

type Text = { id: string; title: string; description: string }

/** Tag every entry whose title or text contains a word or exact phrase. Creates the tag if it's new. */
export function PhraseTagger({ onClose, onDone, initialPhrase = '' }: { onClose: () => void; onDone: () => void; initialPhrase?: string }) {
  const [texts, setTexts] = useState<Text[] | null>(null)
  const [phrase, setPhrase] = useState(initialPhrase)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => { fetchDreamTexts().then(setTexts).catch((e) => setError(String(e))) }, [])

  // Title and body are tested apart so a phrase can't span the gap between them
  const matches = useMemo(() => {
    const re = phrasePattern(phrase)
    if (!re || !texts) return []
    return texts.filter((d) => re.test(d.title) || re.test(d.description))
  }, [phrase, texts])

  const tagName = name.trim() || phrase.trim().replace(/\s+/g, ' ')
  const n = matches.length
  const entries = n === 1 ? 'entry' : 'entries'

  async function apply() {
    if (!n || !tagName || saving) return
    setSaving(true)
    setError(null)
    try {
      const [tag] = await ensureTags([tagName])
      await appendDreamTags(matches.map((d) => ({ dream_id: d.id, tag_id: tag.id })))
      setDone(`Tagged ${n} ${entries} “${tag.name}”.${tag.locked ? ' The tag is locked, so they’re now hidden.' : ''}`)
      if (tag.locked) setTexts((cur) => cur?.filter((d) => !matches.includes(d)) ?? null)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="font-semibold">Tag by phrase</div>
      <p className="text-sm text-muted mt-1">Every entry containing the word or phrase gets the tag. A phrase matches only those words, in that order, like “red car”.</p>
      <label className="label mt-4">Word or phrase</label>
      <input
        className="input"
        autoFocus
        value={phrase}
        onChange={(e) => { setPhrase(e.target.value); setDone(null) }}
        onKeyDown={(e) => { if (e.key === 'Enter') void apply() }}
      />
      <label className="label mt-3">Tag</label>
      <input
        className="input"
        placeholder={phrase.trim() || 'Same as the phrase'}
        value={name}
        onChange={(e) => { setName(e.target.value); setDone(null) }}
        onKeyDown={(e) => { if (e.key === 'Enter') void apply() }}
      />
      <p className="text-xs text-faint mt-3">
        {!texts ? (error ? '' : 'Loading entries…') : !phrase.trim() ? ' ' : n ? `Matches ${n} ${entries}` : 'No entries match'}
      </p>
      {n > 0 && !done && (
        <ul className="text-xs text-muted mt-1 space-y-0.5">
          {matches.slice(0, 5).map((d) => <li key={d.id} className="truncate">{d.title || 'Untitled'}</li>)}
          {n > 5 && <li className="text-faint">and {n - 5} more</li>}
        </ul>
      )}
      {error && <p className="text-sm text-danger mt-3 break-words">{error}</p>}
      {done && <p className="text-sm mt-3">{done}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn" onClick={onClose}>{done ? 'Done' : 'Cancel'}</button>
        <button className="btn btn-primary" disabled={!n || saving || !!done} onClick={() => void apply()}>
          {saving ? <Spinner /> : <Tags size={16} />} Tag {n || ''}
        </button>
      </div>
    </Modal>
  )
}
