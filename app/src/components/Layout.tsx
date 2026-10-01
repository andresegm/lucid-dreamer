import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, ChartPie, GraduationCap, Home, LogOut, Moon, Plus, Settings, Tags } from 'lucide-react'
import clsx from 'clsx'
import { DraftBubble } from '@/components/DraftBubble'
import { RandomDreamBubble } from '@/components/RandomDreamBubble'
import { useAuth } from '@/lib/auth'
import { useKeyboardInset } from '@/lib/useKeyboardInset'

const SIDEBAR = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/dreams', label: 'Dreams', icon: BookOpen },
  { to: '/stats', label: 'Stats', icon: ChartPie },
  { to: '/learn', label: 'Learn', icon: GraduationCap },
  { to: '/tags', label: 'Tags', icon: Tags },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const MOBILE = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/dreams', label: 'Dreams', icon: BookOpen },
  { to: '/stats', label: 'Stats', icon: ChartPie },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Layout() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const keyboardInset = useKeyboardInset()
  const writing =
    location.pathname === '/capture' ||
    location.pathname === '/new' ||
    /^\/dream\/[^/]+\/edit$/.test(location.pathname)
  const hideMobileNav = keyboardInset > 60 || writing
  const fromRandom = Boolean((location.state as { fromRandom?: boolean } | null)?.fromRandom)
  const randomDreamActive = fromRandom && /^\/dream\/[^/]+$/.test(location.pathname)

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

        <button className="btn btn-primary mb-3" onClick={() => navigate('/capture')}>
          <Plus size={16} /> Write now
        </button>

        {SIDEBAR.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx('nav-item', isActive && 'nav-item-active')}>
            <n.icon size={18} />
            {n.label}
          </NavLink>
        ))}

        <div className="mt-auto">
          <button className="nav-item w-full" onClick={() => void signOut()}>
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main
        className={clsx('relative z-10 min-w-0 overflow-x-clip max-w-6xl w-full mx-auto md:py-8 app-main', !hideMobileNav && 'pb-28')}
        style={{ paddingBottom: hideMobileNav ? `max(1rem, var(--keyboard-inset, 0px))` : undefined }}
      >
        <Outlet />
      </main>

      {session && !writing && (
        <>
          <RandomDreamBubble
            userId={session.user.id}
            pathname={location.pathname}
            active={randomDreamActive}
            liftForNav={!hideMobileNav}
          />
          <DraftBubble userId={session.user.id} pathname={location.pathname} liftForNav={!hideMobileNav} />
        </>
      )}

      {/* Bottom nav (mobile) — hide while writing / keyboard open so it doesn’t cover the field */}
      {!hideMobileNav && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t backdrop-blur-xl" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg) 82%, transparent)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="grid grid-cols-5 items-center px-2 py-1.5">
            {MOBILE.slice(0, 2).map((n) => <MobileItem key={n.to} {...n} />)}
            <button onClick={() => navigate('/capture')} className="flex justify-center" aria-label="Write now">
              <span className="h-12 w-12 -mt-6 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'var(--accent)', boxShadow: '0 12px 30px -10px var(--accent)' }}>
                <Plus color="var(--accent-contrast)" />
              </span>
            </button>
            {MOBILE.slice(2).map((n) => <MobileItem key={n.to} {...n} />)}
          </div>
        </nav>
      )}
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
