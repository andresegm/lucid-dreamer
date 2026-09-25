import { useEffect, useState } from 'react'
import { Check, Download, LogOut, RotateCcw, Smartphone } from 'lucide-react'
import clsx from 'clsx'
import { ACCENT_PRESETS, useSettings, type AutoTagMode, type Density, type Theme } from '@/lib/settings'
import { useAuth } from '@/lib/auth'
import { fetchAllFull } from '@/lib/api'
import type { SortOrder } from '@/lib/types'
import { Field, PageHeader, Segmented, Spinner, Switch } from '@/components/ui'
import { fmtDate } from '@/lib/format'

export function SettingsPage() {
  const { settings, update, reset } = useSettings()
  const { signOut } = useAuth()
  const [exporting, setExporting] = useState<null | 'json' | 'txt' | 'csv'>(null)

  async function exportAs(kind: 'json' | 'txt' | 'csv') {
    setExporting(kind)
    try {
      const dreams = await fetchAllFull()
      let content = '', mime = 'text/plain', ext = kind
      if (kind === 'json') {
        content = JSON.stringify(dreams, null, 2); mime = 'application/json'
      } else if (kind === 'csv') {
        const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`
        const head = ['date', 'title', 'lucidity', 'induction_method', 'entry_type', 'favorite', 'tags', 'description']
        content = [head.join(','), ...dreams.map((d) => [d.date, d.title, d.lucidity, d.induction_method ?? '', d.entry_type, d.favorite, d.tags.map((t) => t.name).join('; '), d.description].map(esc).join(','))].join('\n')
        mime = 'text/csv'
      } else {
        content = dreams.map((d) => `${fmtDate(d.date, 'dd.MM.yyyy')}  |  ${d.title}  (${d.entry_type === 'note' ? 'Note' : d.lucidity}${d.induction_method ? ' · ' + d.induction_method : ''})${d.favorite ? ' ★' : ''}\n${d.tags.length ? 'Tags: ' + d.tags.map((t) => t.name).join(', ') + '\n' : ''}\n${d.description}\n\n${'-'.repeat(70)}\n`).join('\n')
      }
      const blob = new Blob([content], { type: mime })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `dream-journal-${new Date().toISOString().slice(0, 10)}.${ext}`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="max-w-2xl fade-in">
      <PageHeader title="Settings" subtitle="Make it yours. Everything here is saved on this device." />

      <section className="card mb-4">
        <h2 className="font-semibold mb-4">Appearance</h2>
        <Field label="Accent color" className="mb-5">
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                title={p.name}
                className={clsx('h-9 w-9 rounded-xl flex items-center justify-center transition-transform hover:scale-105', settings.accent.toLowerCase() === p.hex.toLowerCase() && 'ring-2 ring-offset-2')}
                style={{ background: p.hex, ['--tw-ring-color' as string]: p.hex, ['--tw-ring-offset-color' as string]: 'var(--bg-elev)' }}
                onClick={() => update({ accent: p.hex })}
              >
                {settings.accent.toLowerCase() === p.hex.toLowerCase() && <Check size={16} color="#fff" />}
              </button>
            ))}
            <label className="h-9 px-3 rounded-xl flex items-center gap-2 text-xs cursor-pointer" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}>
              Custom
              <input type="color" value={settings.accent} onChange={(e) => update({ accent: e.target.value })} className="h-5 w-7 bg-transparent border-0 p-0 cursor-pointer" />
            </label>
          </div>
        </Field>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Theme">
            <Segmented<Theme> value={settings.theme} onChange={(theme) => update({ theme })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} />
          </Field>
          <Field label="Density">
            <Segmented<Density> value={settings.density} onChange={(density) => update({ density })} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
          </Field>
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="font-semibold mb-4">Dream list</h2>
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          <Field label="Entries per page">
            <Segmented<string> value={String(settings.pageSize)} onChange={(v) => update({ pageSize: Number(v) })} options={[10, 20, 50, 100].map((n) => ({ value: String(n), label: String(n) }))} />
          </Field>
          <Field label="Default sort">
            <Segmented<SortOrder> value={settings.defaultSort} onChange={(defaultSort) => update({ defaultSort })} options={[{ value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }, { value: 'title', label: 'Title' }]} />
          </Field>
        </div>
        <div className="grid gap-3">
          <Switch checked={settings.showPreview} onChange={(showPreview) => update({ showPreview })} label="Show description preview on cards" />
          <Switch checked={settings.showNotesInList} onChange={(showNotesInList) => update({ showNotesInList })} label="Include notes in the list by default" />
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="font-semibold mb-1">Writing</h2>
        <p className="text-xs text-muted mb-4">
          Auto-tagging reads your dream as you write and matches your existing tags (people, places…) plus common themes and techniques (flying, family, reality check…).
        </p>
        <Field label="Auto-tagging" hint={{ auto: 'Matching tags are added while you write. Remove one and it stays removed.', suggest: 'Matching tags are shown as chips under the tag field; click to add.', off: 'Tags are only added manually.' }[settings.autoTag]}>
          <Segmented<AutoTagMode> value={settings.autoTag} onChange={(autoTag) => update({ autoTag })} options={[{ value: 'auto', label: 'Automatic' }, { value: 'suggest', label: 'Suggest' }, { value: 'off', label: 'Off' }]} />
        </Field>
      </section>

      <section className="card mb-4">
        <h2 className="font-semibold mb-1">Install on your phone</h2>
        <p className="text-xs text-muted mb-3">Add Lucid to your home screen so you can write from bed. The dump screen still saves a draft on this device if you’re offline.</p>
        <InstallApp />
      </section>

      <section className="card mb-4">
        <h2 className="font-semibold mb-1">Privacy</h2>
        <p className="text-xs text-muted mb-4">Automatically lock the journal after a period of inactivity.</p>
        <Field label="Auto-lock">
          <Segmented<string> value={String(settings.lockTimeoutMin)} onChange={(v) => update({ lockTimeoutMin: Number(v) })} options={[{ value: '0', label: 'Never' }, { value: '5', label: '5 min' }, { value: '15', label: '15 min' }, { value: '60', label: '1 hour' }]} />
        </Field>
      </section>

      <section className="card mb-4">
        <h2 className="font-semibold mb-1">Export</h2>
        <p className="text-xs text-muted mb-4">Download a full copy of your journal any time.</p>
        <div className="flex flex-wrap gap-2">
          {(['txt', 'json', 'csv'] as const).map((k) => (
            <button key={k} className="btn" disabled={!!exporting} onClick={() => void exportAs(k)}>
              {exporting === k ? <Spinner /> : <Download size={16} />} .{k}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap justify-between gap-2">
        <button className="btn btn-ghost" onClick={reset}><RotateCcw size={16} /> Reset appearance</button>
        <button className="btn" onClick={() => void signOut()}><LogOut size={16} /> Lock journal</button>
      </div>
    </div>
  )
}

type BeforeInstall = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

function InstallApp() {
  const [prompt, setPrompt] = useState<BeforeInstall | null>(null)
  const [standalone, setStandalone] = useState(false)
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    const standaloneNow = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    setStandalone(standaloneNow)
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstall)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setStandalone(true))
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (standalone) {
    return <p className="text-sm text-muted">This device already has Lucid installed.</p>
  }
  if (prompt) {
    return (
      <button className="btn btn-primary" onClick={() => void prompt.prompt()}>
        <Smartphone size={16} /> Add to home screen
      </button>
    )
  }
  if (ios) {
    return <p className="text-sm text-muted">In Safari: tap Share, then <b>Add to Home Screen</b>.</p>
  }
  return <p className="text-sm text-muted">Open this site in Chrome or Edge, then use the browser menu → <b>Install app</b> / <b>Add to home screen</b>. The install button appears here once the browser offers it (after a production deploy).</p>
}
