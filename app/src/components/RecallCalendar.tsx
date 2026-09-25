import { useMemo, useState } from 'react'
import { eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, startOfYear } from 'date-fns'
import clsx from 'clsx'
import type { DreamLite } from '@/lib/types'
import { rangeStart, type Range } from '@/lib/stats'
import { fmtDate } from '@/lib/format'

interface DayInfo { count: number; lucid: number }

export function RecallCalendar({ dreams, range, onSelectDay }: { dreams: DreamLite[]; range: Range; onSelectDay: (iso: string) => void }) {
  const { byDate, years, totalDays } = useMemo(() => {
    const start = rangeStart(range)
    const inRange = dreams.filter((d) => !start || parseISO(d.date) >= start)
    const map = new Map<string, DayInfo>()
    for (const d of inRange) {
      const cur = map.get(d.date) ?? { count: 0, lucid: 0 }
      cur.count++
      if (d.entry_type === 'dream' && d.lucidity !== 'non-lucid') cur.lucid++
      map.set(d.date, cur)
    }
    const dates = [...map.keys()].sort()
    const nowY = new Date().getFullYear()
    let fromY: number
    let toY = nowY
    if (range === 'all' && dates.length) {
      fromY = parseISO(dates[0]).getFullYear()
    } else if (start) {
      fromY = start.getFullYear()
    } else {
      fromY = nowY
    }
    const ys: number[] = []
    for (let y = toY; y >= fromY; y--) ys.push(y)
    return { byDate: map, years: ys, totalDays: map.size }
  }, [dreams, range])

  if (!years.length) return null

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Recall calendar</h2>
        <span className="text-xs text-muted">{totalDays.toLocaleString()} days with an entry</span>
      </div>
      <p className="text-xs text-muted mb-4">Each square is a morning. Click a day to open those dreams.</p>
      <div className="grid gap-6">
        {years.map((y) => (
          <YearRow key={y} year={y} byDate={byDate} onSelectDay={onSelectDay} />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-4 text-[11px] text-faint">
        <span>Less</span>
        <span className="cal-cell" data-level="0" />
        <span className="cal-cell" data-level="1" />
        <span className="cal-cell" data-level="2" />
        <span className="cal-cell" data-level="3" />
        <span className="cal-cell" data-level="3" data-lucid="true" />
        <span>More · gold = a lucid that night</span>
      </div>
    </div>
  )
}

function YearRow({ year, byDate, onSelectDay }: { year: number; byDate: Map<string, DayInfo>; onSelectDay: (iso: string) => void }) {
  const [tip, setTip] = useState<{ iso: string; x: number; y: number } | null>(null)
  const { weeks, monthMarks } = useMemo(() => buildYear(year), [year])
  return (
    <div>
      <div className="text-xs font-semibold text-muted mb-1.5 tabular-nums">{year}</div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-block min-w-max">
          <div className="flex gap-[3px] mb-1 pl-[22px]">
            {weeks.map((_, i) => (
              <div key={i} className="cal-cell text-[9px] text-faint leading-none overflow-visible" style={{ background: 'transparent', border: 'none', height: 'auto' }}>
                {monthMarks[i] ?? ''}
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            <div className="flex flex-col gap-[3px] mr-1 w-[18px] text-[9px] text-faint leading-[11px]">
              <span />
              <span>M</span>
              <span />
              <span>W</span>
              <span />
              <span>F</span>
              <span />
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((iso, di) => {
                  if (!iso) return <span key={di} className="cal-cell" data-empty="true" />
                  const info = byDate.get(iso)
                  const level = !info ? 0 : info.count >= 3 ? 3 : info.count
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={clsx('cal-cell', info && 'cursor-pointer')}
                      data-level={level}
                      data-lucid={info && info.lucid > 0 ? 'true' : undefined}
                      disabled={!info}
                      aria-label={iso}
                      onMouseEnter={(e) => setTip({ iso, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTip(null)}
                      onClick={() => info && onSelectDay(iso)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {tip && (
        <div className="cal-tip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          <div className="font-medium">{fmtDate(tip.iso, 'EEE, MMM d, yyyy')}</div>
          {byDate.get(tip.iso) ? (
            <div className="text-faint">
              {byDate.get(tip.iso)!.count} {byDate.get(tip.iso)!.count === 1 ? 'entry' : 'entries'}
              {byDate.get(tip.iso)!.lucid ? ` · ${byDate.get(tip.iso)!.lucid} lucid` : ''}
            </div>
          ) : (
            <div className="text-faint">No entry</div>
          )}
        </div>
      )}
    </div>
  )
}

function buildYear(year: number) {
  const jan1 = startOfYear(new Date(year, 0, 1))
  const dec31 = new Date(year, 11, 31)
  const gridStart = startOfWeek(jan1, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(dec31, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weeks: (string | null)[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7).map((d) => (d.getFullYear() === year ? format(d, 'yyyy-MM-dd') : null)))
  }

  const monthMarks: (string | null)[] = weeks.map((w, i) => {
    const first = w.find((iso) => iso)
    if (!first) return null
    const day = parseISO(first).getDate()
    if (day > 7 && i > 0) return null
    return format(parseISO(first), 'MMM')
  })
  // de-dupe consecutive same month
  let last = ''
  const marks = monthMarks.map((m) => {
    if (!m || m === last) return null
    last = m
    return m
  })

  return { weeks, monthMarks: marks }
}
