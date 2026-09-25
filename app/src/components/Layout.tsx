import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BookOpen, ChartPie, LogOut, Moon, Plus, Settings, Tags } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/lib/auth'

const NAV = [
  { to: '/', label: 'Dreams', icon: BookOpen, end: true },
  { to: '/stats', label: 'Stats', icon: ChartPie },
  { to: '/tags', label: 'Tags', icon: Tags },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Layout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="ambient min-h-full md:grid md:grid-cols-[240px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col gap-1 p-4 sticky top-0 h-screen z-10 border-r" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 px-2 py-3 mb-2">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <Moon size={18} color="var(--accent-contrast)" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold">Lucid</div>
            <div className="text-xs text-muted">Dream Journal</div>
          </div>
        </div>

        <button className="btn btn-primary mb-3" onClick={() => navigate('/new')}>
          <Plus size={16} /> New dream
        </button>

        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx('nav-item', isActive && 'nav-item-active')}>
            <n.icon size={18} />
            {n.label}
          </NavLink>
        ))}

        <div className="mt-auto">
          <button className="nav-item w-full" onClick={() => void signOut()}>
            <LogOut size={18} /> Lock
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="relative z-10 min-w-0 px-4 pt-5 pb-28 md:px-8 md:py-8 max-w-6xl w-full mx-auto">
        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t backdrop-blur-xl" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 82%, transparent)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="grid grid-cols-5 items-center px-2 py-1.5">
          {NAV.slice(0, 2).map((n) => <MobileItem key={n.to} {...n} />)}
          <button onClick={() => navigate('/new')} className="flex justify-center" aria-label="New dream">
            <span className="h-12 w-12 -mt-6 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'var(--accent)', boxShadow: '0 12px 30px -10px var(--accent)' }}>
              <Plus color="var(--accent-contrast)" />
            </span>
          </button>
          {NAV.slice(2).map((n) => <MobileItem key={n.to} {...n} />)}
        </div>
      </nav>
    </div>
  )
}

function MobileItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof BookOpen; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium', isActive ? 'text-fg' : 'text-muted')}>
      {({ isActive }) => (
        <>
          <Icon size={20} style={isActive ? { color: 'var(--accent)' } : undefined} />
          {label}
        </>
      )}
    </NavLink>
  )
}
