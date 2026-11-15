import { useEffect, useState } from 'react'
import { CalendarPlus, Check, Download, LogOut, RotateCcw, Smartphone, Upload } from 'lucide-react'
import clsx from 'clsx'
import { ACCENT_PRESETS, useSettings, type AutoTagMode, type Density, type Theme } from '@/lib/settings'
import { useAuth } from '@/lib/auth'
import { fetchAllFull, importEntries } from '@/lib/api'
import { parseImport } from '@/lib/impex'
import type { SortOrder } from '@/lib/types'
import { Field, PageHeader, Segmented, Spinner, Switch } from '@/components/ui'
import { EmotionScan } from '@/components/EmotionScan'
import { LockedTags } from '@/components/LockedTags'
import { downloadReminders, nudgeTimes } from '@/lib/reminders'
import { fetchSleepLogs, type SleepLog } from '@/lib/sleep'
import { suggestWbtb } from '@/lib/practice'
import { fmtDate } from '@/lib/format'

export function SettingsPage() {
  const { settings, update, reset } = useSettings()
  const { signOut, email } = useAuth()
  const [exporting, setExporting] = useState<null | 'json' | 'txt' | 'csv'>(null)
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState<string | null>(null)

  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([])

  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id === 'emotion-scan' || id === 'reminders') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Loaded up front: the calendar download has to start inside the tap, with nothing to wait for
  useEffect(() => {
    let cancelled = false
    fetchSleepLogs(14).then((rows) => { if (!cancelled) setSleepLogs(rows) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const wbtb = suggestWbtb(sleepLogs, settings.bedTime, settings.wakeTime)
  const wbtbReminder = settings.practiceNights.length
    ? { time: wbtb.alarm, weekdays: settings.practiceNights.map((d) => (d + wbtb.alarmDayOffset) % 7) }
    : null
  const nudges = nudgeTimes(settings.wakeTime, settings.bedTime, settings.rcNudges)

  async function exportAs(kind: 'json' | 'txt' | 'csv') {
    setExporting(kind)
    try {
      const dreams = await fetchAllFull()
      let content = '', mime = 'text/plain', ext = kind
      if (kind === 'json') {
        content = JSON.stringify(dreams, null, 2); mime = 'application/json'
      } else if (kind === 'csv') {
        const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`
        const head = ['date', 'title', 'lucidity', 'induction_method', 'induction_notes', 'entry_type', 'favorite', 'tags', 'description']
        content = [head.join(','), ...dreams.map((d) => [d.date, d.title, d.lucidity, d.induction_method ?? '', d.induction_notes ?? '', d.entry_type, d.favorite, d.tags.map((t) => t.name).join('; '), d.description].map(esc).join(','))].join('\n')
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

  async function onImport(file: File) {
    setImporting(true)
    setImportNote(null)
    try {
      const text = await file.text()
      const rows = parseImport(file.name, text)
      if (!rows.length) {
        setImportNote('Nothing we could read in that file.')
        return
      }
      const { created, skipped } = await importEntries(rows)
      setImportNote(skipped ? `Added ${created}. Skipped ${skipped} already in the journal.` : `Added ${created}.`)
    } catch (e) {
      setImportNote(e instanceof Error ? e.message : String(e))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-2xl fade-in">
      <PageHeader title="Settings" subtitle="Appearance, writing, export, and import." />

      <section className="card mb-4">
        <h2 className="font-semibold mb-1">Account</h2>
        <p className="text-sm text-muted">{email}</p>
      </section>

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
          Auto-tagging can add people, places, techniques, and feelings as you write. Record on Write now or New dream if you’d rather speak — twice a day, up to five minutes each.
        </p>
        <Field label="Auto-tagging" hint={{ auto: 'Matching tags are added while you write. Remove one and it stays removed.', suggest: 'Matching tags are shown as chips under the tag field; click to add.', off: 'Tags are only added manually.' }[settings.autoTag]}>
          <Segmented<AutoTagMode> value={settings.autoTag} onChange={(autoTag) => update({ autoTag })} options={[{ value: 'auto', label: 'Automatic' }, { value: 'suggest', label: 'Suggest' }, { value: 'off', label: 'Off' }]} />
        </Field>
      </section>

      <section className="card mb-4">
        <EmotionScan />
      </section>

      <section className="card mb-4" id="reminders">
        <h2 className="font-semibold mb-1">Reminders</h2>
        <p className="text-xs text-muted mb-4">
          A nudge to write when you wake, and one at night to set your intention. They live in your phone’s calendar, so they ring even when Lucid is closed.
        </p>
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <Field label="Wake-up">
            <input type="time" className="input" value={settings.wakeTime} onChange={(e) => e.target.value && update({ wakeTime: e.target.value })} />
          </Field>
          <Field label="Bedtime">
            <input type="time" className="input" value={settings.bedTime} onChange={(e) => e.target.value && update({ bedTime: e.target.value })} />
          </Field>
        </div>
        <Field label="Reality-check nudges per day" className="mt-4" hint={nudges.length ? `At ${nudges.join(', ')}.` : 'Fixed times fade into the background after a while; your dream signs on Practice work better. Nudges help at the start.'}>
          <Segmented<string>
            value={String(settings.rcNudges)}
            onChange={(v) => update({ rcNudges: Number(v) })}
            options={[{ value: '0', label: 'Off' }, { value: '3', label: '3' }, { value: '5', label: '5' }]}
          />
        </Field>
        {wbtbReminder && (
          <p className="text-xs text-muted mt-3">
            Also adds a Wake Back To Bed alert at {wbtbReminder.time} after your {settings.practiceNights.length} practice {settings.practiceNights.length === 1 ? 'night' : 'nights'}. It opens the night session, but it is quiet, so set a real alarm as well.
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary mt-4"
          onClick={() => downloadReminders({ wakeTime: settings.wakeTime, bedTime: settings.bedTime, rcNudges: settings.rcNudges, wbtb: wbtbReminder })}
        >
          <CalendarPlus size={16} /> Add to my calendar
        </button>
        <p className="text-xs text-faint mt-2">Opens repeating events with alerts. To change them later, delete those events in your calendar and add them again.</p>
      </section>

      <section className="card mb-4">
        <h2 className="font-semibold mb-1">Install on your phone</h2>
        <p className="text-xs text-muted mb-3">Add Lucid to your home screen so you can write from bed. A draft still saves if you’re offline.</p>
        <InstallApp />
      </section>

      <section className="card mb-4">
        <h2 className="font-semibold mb-1">Privacy</h2>
        <p className="text-xs text-muted mb-4">Lock the journal after a period of inactivity, and keep private tags out of sight.</p>
        <Field label="Auto-lock">
          <Segmented<string> value={String(settings.lockTimeoutMin)} onChange={(v) => update({ lockTimeoutMin: Number(v) })} options={[{ value: '0', label: 'Never' }, { value: '5', label: '5 min' }, { value: '15', label: '15 min' }, { value: '60', label: '1 hour' }]} />
        </Field>
        <Field label="Locked tags" hint="A locked tag disappears from Tags and Stats, and every dream that carries it is hidden from the list, search, filters, Home, and export. Unlock it here to bring them back. A passcode keeps someone holding your unlocked phone from doing that." className="mt-5">
          <LockedTags />
        </Field>
      </section>

      <section className="card mb-4">
        <h2 className="font-semibold mb-1">Export</h2>
        <p className="text-xs text-muted mb-4">Download a full copy of your journal any time. Dreams under a locked tag are left out.</p>
        <div className="flex flex-wrap gap-2">
          {(['txt', 'json', 'csv'] as const).map((k) => (
            <button key={k} className="btn" disabled={!!exporting} onClick={() => void exportAs(k)}>
              {exporting === k ? <Spinner /> : <Download size={16} />} .{k}
            </button>
          ))}
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="font-semibold mb-1">Import</h2>
        <p className="text-xs text-muted mb-4">Bring back a Lucid export (.json, .csv, or .txt). Entries already in the journal are skipped.</p>
        <label className="btn inline-flex cursor-pointer">
          {importing ? <Spinner /> : <Upload size={16} />}
          Choose file
          <input
            type="file"
            accept=".json,.csv,.txt,text/plain,text/csv,application/json"
            className="sr-only"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void onImport(file)
            }}
          />
        </label>
        {importNote && <p className="text-sm text-muted mt-3">{importNote}</p>}
      </section>

      <div className="flex flex-wrap justify-between gap-2">
        <button className="btn btn-ghost" onClick={reset}><RotateCcw size={16} /> Reset appearance</button>
        <button className="btn" onClick={() => void signOut()}><LogOut size={16} /> Sign out</button>
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
