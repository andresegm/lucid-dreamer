import clsx from 'clsx'
import { Loader2, Moon } from 'lucide-react'
import type { ReactNode } from 'react'
import { todayISO } from '@/lib/format'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className)} size={18} />
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5 min-w-0">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1 break-words">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center text-center py-14 fade-in">
      <div className="h-12 w-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)' }}>
        <Moon className="text-accent" />
      </div>
      <div className="font-medium">{title}</div>
      {hint && <div className="text-sm text-muted mt-1 max-w-sm">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  value, options, onChange, className,
}: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={clsx('segmented', className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" data-active={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
      {label && <span className="text-sm">{label}</span>}
      <button type="button" className="switch" data-on={checked} onClick={() => onChange(!checked)} aria-pressed={checked}>
        <span />
      </button>
    </label>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="text-xs text-faint mt-1.5">{hint}</p>}
    </div>
  )
}

export function Kpi({ icon, label, value, sub, accent }: { icon: ReactNode; label: string; value: string; sub?: string; accent?: string }) {
  const color = accent ?? 'var(--accent)'
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-2 leading-none tracking-tight">{value}</div>
      {sub && <div className="text-xs text-faint mt-1.5 leading-snug break-words" title={sub}>{sub}</div>}
    </div>
  )
}

/** Shown when a journal date is not today. */
export function UseToday({ date, onClick, className }: { date: string; onClick: () => void; className?: string }) {
  if (date === todayISO()) return null
  return (
    <button type="button" className={clsx('text-xs text-accent hover:underline', className)} onClick={onClick}>
      Use today
    </button>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.55)' }} onClick={onClose}>
      <div className="card max-w-sm w-full fade-in" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    <div className="card border-danger/40 text-sm">
      <div className="font-medium text-danger mb-1">Something went wrong</div>
      <div className="text-muted break-words">{msg}</div>
      {retry && (
        <button className="btn mt-3" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  )
}
