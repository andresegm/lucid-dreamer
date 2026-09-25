import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ReactNode } from 'react'

export interface Slice { name: string; value: number; color: string }

/** Ring / donut chart with a big center label. */
export function Ring({ data, center, sub, size = 200, thickness = 22 }: { data: Slice[]; center: ReactNode; sub?: ReactNode; size?: number; thickness?: number }) {
  const total = data.reduce((a, b) => a + b.value, 0)
  const outer = size / 2
  const inner = outer - thickness
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={total ? data : [{ name: 'none', value: 1, color: 'var(--bg-elev-2)' }]}
            dataKey="value"
            innerRadius={inner}
            outerRadius={outer}
            startAngle={90}
            endAngle={-270}
            paddingAngle={total ? 2 : 0}
            cornerRadius={thickness / 2}
            stroke="none"
            isAnimationActive
          >
            {(total ? data : [{ color: 'var(--bg-elev-2)' }]).map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          {total > 0 && <Tooltip content={<RingTip total={total} />} />}
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
        <div className="text-3xl font-semibold tabular-nums leading-none">{center}</div>
        {sub && <div className="text-xs text-muted mt-1.5">{sub}</div>}
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RingTip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="card text-xs shadow-xl" style={{ padding: '.5rem .7rem' }}>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: p.payload.color }} />
        <span className="font-medium">{p.name}</span>
      </div>
      <div className="text-muted mt-0.5 tabular-nums">{p.value} · {total ? Math.round((p.value / total) * 100) : 0}%</div>
    </div>
  )
}

export function Legend({ data }: { data: Slice[] }) {
  const total = data.reduce((a, b) => a + b.value, 0)
  return (
    <ul className="grid gap-1.5 text-sm">
      {data.map((d) => (
        <li key={d.name} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
          <span className="flex-1 truncate">{d.name}</span>
          <span className="tabular-nums text-muted">{d.value}</span>
          <span className="tabular-nums text-faint w-10 text-right">{total ? Math.round((d.value / total) * 100) : 0}%</span>
        </li>
      ))}
    </ul>
  )
}

export interface StackedPoint { label: string; [key: string]: number | string }

export function StackedBars({ data, series, height = 220 }: { data: StackedPoint[]; series: { key: string; color: string; name: string }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barCategoryGap="28%">
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--accent) 10%, transparent)' }} content={<BarTip />} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color} radius={i === series.length - 1 ? [5, 5, 0, 0] : 0} isAnimationActive />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((a: number, p: { value: number }) => a + (p.value || 0), 0)
  return (
    <div className="card text-xs shadow-xl" style={{ padding: '.5rem .7rem' }}>
      <div className="font-medium mb-1">{label} · {total}</div>
      {payload.filter((p: { value: number }) => p.value > 0).map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function HBarList({ items, max, color = 'var(--accent)' }: { items: { label: string; value: number; onClick?: () => void }[]; max?: number; color?: string }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="grid gap-2">
      {items.map((it) => (
        <li key={it.label}>
          <button type="button" className="w-full text-left group" onClick={it.onClick} disabled={!it.onClick}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="truncate group-hover:text-accent transition-colors">{it.label}</span>
              <span className="tabular-nums text-muted">{it.value}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elev-2)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(it.value / m) * 100}%`, background: color }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
