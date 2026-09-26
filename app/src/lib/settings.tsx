import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Lucidity, SortOrder } from './types'
import type { Granularity, Range } from './stats'
import { fetchProfile, saveProfile } from './api'
import { configError, supabase } from './supabase'

export type Theme = 'dark' | 'light' | 'system'
export type Density = 'comfortable' | 'compact'
/** auto = add matching tags while you write; suggest = show them as one-click chips; off = manual only */
export type AutoTagMode = 'auto' | 'suggest' | 'off'
export type StatsPanel = 'recall' | 'lucid' | 'patterns'

export interface Settings {
  autoTag: AutoTagMode
  accent: string
  theme: Theme
  density: Density
  pageSize: number
  defaultSort: SortOrder
  showNotesInList: boolean
  showPreview: boolean
  lockTimeoutMin: number // 0 = never auto-lock
}

export interface StatsPrefs {
  range: Range
  includeNotes: boolean
  series: Record<Lucidity, boolean>
  granularity: Granularity | 'auto'
  panel: StatsPanel
}

export const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: 'Violet', hex: '#7c6cf6' },
  { name: 'Indigo', hex: '#5b7cfa' },
  { name: 'Aqua', hex: '#38bdf8' },
  { name: 'Mint', hex: '#34d399' },
  { name: 'Gold', hex: '#f6b26c' },
  { name: 'Coral', hex: '#fb7185' },
  { name: 'Rose', hex: '#e879f9' },
  { name: 'Slate', hex: '#94a3b8' },
]

export const DEFAULT_SETTINGS: Settings = {
  autoTag: 'auto',
  accent: '#7c6cf6',
  theme: 'dark',
  density: 'comfortable',
  pageSize: 20,
  defaultSort: 'newest',
  showNotesInList: true,
  showPreview: true,
  lockTimeoutMin: 0,
}

export const DEFAULT_STATS_PREFS: StatsPrefs = {
  range: 'all',
  includeNotes: false,
  series: { lucid: true, 'semi-lucid': true, 'non-lucid': true },
  granularity: 'auto',
  panel: 'lucid',
}

const KEY = 'ldj.settings.v1'
const STATS_KEY = 'ldj.stats.prefs'

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function mergeSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS }
  return { ...DEFAULT_SETTINGS, ...(raw as Partial<Settings>) }
}

function mergeStats(raw: unknown): StatsPrefs {
  if (!isRecord(raw)) return { ...DEFAULT_STATS_PREFS, series: { ...DEFAULT_STATS_PREFS.series } }
  const series = isRecord(raw.series) ? { ...DEFAULT_STATS_PREFS.series, ...(raw.series as Partial<Record<Lucidity, boolean>>) } : { ...DEFAULT_STATS_PREFS.series }
  return { ...DEFAULT_STATS_PREFS, ...(raw as Partial<StatsPrefs>), series }
}

function hasKeys(v: unknown): boolean {
  return isRecord(v) && Object.keys(v).length > 0
}

function loadSettings(): Settings {
  try {
    return mergeSettings(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function loadStats(): StatsPrefs {
  try {
    return mergeStats(JSON.parse(localStorage.getItem(STATS_KEY) ?? 'null'))
  } catch {
    return { ...DEFAULT_STATS_PREFS, series: { ...DEFAULT_STATS_PREFS.series } }
  }
}

function contrastFor(hex: string): string {
  const c = hex.replace('#', '')
  if (c.length !== 6) return '#ffffff'
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#0b0d12' : '#ffffff'
}

function applyToDocument(s: Settings) {
  const root = document.documentElement
  root.style.setProperty('--accent', s.accent)
  root.style.setProperty('--accent-contrast', contrastFor(s.accent))
  const resolved: 'dark' | 'light' =
    s.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : s.theme
  root.dataset.theme = resolved
  root.dataset.density = s.density
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#f5f6fa' : '#0b0d12')
}

interface Ctx {
  settings: Settings
  statsPrefs: StatsPrefs
  update: (patch: Partial<Settings>) => void
  updateStats: (patch: Partial<StatsPrefs>) => void
  reset: () => void
}
const SettingsContext = createContext<Ctx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [statsPrefs, setStatsPrefs] = useState<StatsPrefs>(loadStats)
  const userId = useRef<string | null>(null)
  const ready = useRef(false)
  const gen = useRef(0)
  const settingsRef = useRef(settings)
  const statsRef = useRef(statsPrefs)
  settingsRef.current = settings
  statsRef.current = statsPrefs

  useEffect(() => {
    applyToDocument(settings)
    try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* ignore */ }
  }, [settings])

  useEffect(() => {
    try { localStorage.setItem(STATS_KEY, JSON.stringify(statsPrefs)) } catch { /* ignore */ }
  }, [statsPrefs])

  useEffect(() => {
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const h = () => applyToDocument(settings)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [settings])

  useEffect(() => {
    let cancelled = false
    if (configError) {
      ready.current = true
      return
    }

    async function hydrate(uid: string | null) {
      const mine = ++gen.current
      userId.current = uid
      ready.current = false
      if (!uid) {
        ready.current = true
        return
      }
      try {
        const row = await fetchProfile()
        if (cancelled || mine !== gen.current) return
        const remoteSettings = hasKeys(row?.settings)
        const remoteStats = hasKeys(row?.stats)
        if (remoteSettings) setSettings(mergeSettings(row!.settings))
        if (remoteStats) setStatsPrefs(mergeStats(row!.stats))
        if (!remoteSettings || !remoteStats) {
          await saveProfile({
            settings: remoteSettings ? mergeSettings(row!.settings) : settingsRef.current,
            stats: remoteStats ? mergeStats(row!.stats) : statsRef.current,
          })
        }
      } catch {
        /* stay on the device cache */
      } finally {
        if (!cancelled && mine === gen.current) ready.current = true
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) void hydrate(data.session?.user.id ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user.id ?? null
      if (uid === userId.current && ready.current) return
      void hydrate(uid)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!ready.current || !userId.current) return
    const t = window.setTimeout(() => {
      void saveProfile({ settings, stats: statsPrefs }).catch(() => {})
    }, 400)
    return () => window.clearTimeout(t)
  }, [settings, statsPrefs])

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [])
  const updateStats = useCallback((patch: Partial<StatsPrefs>) => {
    setStatsPrefs((s) => ({ ...s, ...patch, series: patch.series ?? s.series }))
  }, [])
  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), [])

  const value = useMemo<Ctx>(
    () => ({ settings, statsPrefs, update, updateStats, reset }),
    [settings, statsPrefs, update, updateStats, reset],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
