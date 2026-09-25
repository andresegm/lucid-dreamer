import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  // compact window of page numbers
  const window: number[] = []
  const lo = Math.max(1, page - 2), hi = Math.min(pages, page + 2)
  for (let i = lo; i <= hi; i++) window.push(i)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
      <div className="text-xs text-muted tabular-nums">
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </div>
      <div className="flex items-center gap-1">
        <button className="btn btn-icon" disabled={page === 1} onClick={() => onChange(1)} aria-label="First page"><ChevronsLeft size={16} /></button>
        <button className="btn btn-icon" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
        {lo > 1 && <span className="px-1 text-faint">…</span>}
        {window.map((n) => (
          <button key={n} className={n === page ? 'btn btn-primary min-w-9' : 'btn min-w-9'} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
        {hi < pages && <span className="px-1 text-faint">…</span>}
        <button className="btn btn-icon" disabled={page === pages} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
        <button className="btn btn-icon" disabled={page === pages} onClick={() => onChange(pages)} aria-label="Last page"><ChevronsRight size={16} /></button>
      </div>
    </div>
  )
}
