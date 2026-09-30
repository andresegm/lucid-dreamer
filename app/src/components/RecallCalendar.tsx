import { useEffect, useMemo, useRef, useState } from 'react'
import { eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, startOfYear } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import type { DreamLite } from '@/lib/types'
import { heatLevel, rangeStart, recallByDate, type Range } from '@/lib/stats'
import { fmtDate } from '@/lib/format'

interface DayInfo { count: number; lucid: number }

export function RecallCalendar({ dreams, range, onSelectDay }: { dreams: DreamLite[]; range: Range; onSelectDay: (iso: string) => void }) {
  const { byDate, years, totalDays } = useMemo(() => {
    const start = rangeStart(range)
    const inRange = dreams.filter((d) => !start || parseISO(d.date) >= start)
    const map = recallByDate(inRange)
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

  const scrollerRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const multi = years.length > 1

  useEffect(() => {
    setPage(0)
    const el = scrollerRef.current
    if (el) el.scrollTo({ left: 0, behavior: 'auto' })
  }, [years.join(',')])

  function goTo(i: number) {
    const next = Math.max(0, Math.min(years.length - 1, i))
    setPage(next)
    const el = scrollerRef.current
    if (!el) return
    const child = el.children[next] as HTMLElement | undefined
    if (!child) return
    el.scrollTo({ left: child.offsetLeft, behavior: 'smooth' })
  }

  function onScroll() {
    const el = scrollerRef.current
    if (!el || !el.clientWidth) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setPage(Math.max(0, Math.min(years.length - 1, i)))
  }

  if (!years.length) return null

  return (
    <div className="card min-w-0 max-w-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-3">
        <h2 className="font-semibold">Recall calendar</h2>
        <span className="text-xs text-muted">{totalDays.toLocaleString()} days with an entry</span>
      </div>
      <p className="text-xs text-muted mb-4">Each square is a morning. Click a day to open those dreams.</p>

      {multi && (
        <div className="flex items-center gap-2 mb-3 min-w-0">
          <button
            type="button"
            className="btn btn-icon shrink-0"
            aria-label="Newer year"
            disabled={page <= 0}
            onClick={() => goTo(page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 min-w-0 overflow-x-auto flex items-center justify-center gap-1.5 py-0.5">
            {years.map((y, i) => (
              <button
                key={y}
                type="button"
                className={clsx('chip chip-btn tabular-nums shrink-0', i === page && 'chip-active')}
                aria-current={i === page ? 'true' : undefined}
                onClick={() => goTo(i)}
              >
                {y}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-icon shrink-0"
            aria-label="Older year"
            disabled={page >= years.length - 1}
            onClick={() => goTo(page + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div
        ref={scrollerRef}
        className={clsx('min-w-0', multi && 'flex overflow-x-auto snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden')}
        onScroll={multi ? onScroll : undefined}
        style={multi ? { WebkitOverflowScrolling: 'touch' } : undefined}
      >
        {years.map((y) => (
          <div key={y} className={clsx('min-w-0', multi && 'w-full shrink-0 snap-start snap-always')}>
            <YearRow year={y} byDate={byDate} onSelectDay={onSelectDay} showYearLabel={!multi} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4 text-[11px] text-faint">
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

function YearRow({
  year,
  byDate,
  onSelectDay,
  showYearLabel = true,
}: {
  year: number
  byDate: Map<string, DayInfo>
  onSelectDay: (iso: string) => void
  showYearLabel?: boolean
}) {
  const [tip, setTip] = useState<{ iso: string; x: number; y: number } | null>(null)
  const { weeks, monthMarks } = useMemo(() => buildYear(year), [year])
  return (
    <div className="cal-year min-w-0">
      {showYearLabel && <div className="text-xs font-semibold text-muted mb-1.5 tabular-nums">{year}</div>}
      <div className="grid min-w-0 gap-x-1" style={{ gridTemplateColumns: '12px minmax(0, 1fr)' }}>
        <div />
        <div className="relative h-3 min-w-0 mb-0.5">
          {monthMarks.map((m, i) =>
            m ? (
              <span key={i} className="absolute text-[9px] text-faint leading-none" style={{ left: `${(i / weeks.length) * 100}%` }}>
                {m}
              </span>
            ) : null,
          )}
        </div>
        <div className="flex flex-col justify-between text-[9px] text-faint leading-none py-px">
          <span />
          <span>M</span>
          <span />
          <span>W</span>
          <span />
          <span>F</span>
          <span />
        </div>
        <div className="grid min-w-0" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`, gap: 2 }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid min-w-0" style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
              {week.map((iso, di) => {
                if (!iso) return <span key={di} className="cal-cell" data-empty="true" />
                const info = byDate.get(iso)
                const level = heatLevel(info?.count ?? 0)
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
