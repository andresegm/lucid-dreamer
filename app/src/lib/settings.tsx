import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SortOrder } from './types'

export type Theme = 'dark' | 'light' | 'system'
export type Density = 'comfortable' | 'compact'
/** auto = add matching tags while you write; suggest = show them as one-click chips; off = manual only */
export type AutoTagMode = 'auto' | 'suggest' | 'off'

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

const KEY = 'ldj.settings.v1'

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULT_SETTINGS
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
  update: (patch: Partial<Settings>) => void
  reset: () => void
}
const SettingsContext = createContext<Ctx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load)

  useEffect(() => {
    applyToDocument(settings)
    localStorage.setItem(KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (settings.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const h = () => applyToDocument(settings)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [settings])

  const value = useMemo<Ctx>(
    () => ({
      settings,
      update: (patch) => setSettings((s) => ({ ...s, ...patch })),
      reset: () => setSettings(DEFAULT_SETTINGS),
    }),
    [settings],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
