import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BedDouble, BookOpen, ChartPie, GraduationCap, Home, LogOut, Menu, Moon, Plus, Settings, Tags, Target } from 'lucide-react'
import clsx from 'clsx'
import { DraftBubble } from '@/components/DraftBubble'
import { RandomDreamBubble } from '@/components/RandomDreamBubble'
import { Toasts } from '@/components/Toasts'
import { OutboxBanner } from '@/components/OutboxBanner'
import { useAuth } from '@/lib/auth'
import { useKeyboardInset } from '@/lib/useKeyboardInset'

const SIDEBAR = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/dreams', label: 'Dreams', icon: BookOpen },
  { to: '/practice', label: 'Practice', icon: Target },
  { to: '/sleep', label: 'Sleep', icon: BedDouble },
  { to: '/stats', label: 'Stats', icon: ChartPie },
  { to: '/learn', label: 'Learn', icon: GraduationCap },
  { to: '/tags', label: 'Tags', icon: Tags },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const MOBILE = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/dreams', label: 'Dreams', icon: BookOpen },
  { to: '/stats', label: 'Stats', icon: ChartPie },
]

/** Everything the phone bar has no room for. */
const MORE = [
  { to: '/practice', label: 'Practice', icon: Target },
  { to: '/sleep', label: 'Sleep', icon: BedDouble },
  { to: '/tags', label: 'Tags', icon: Tags },
  { to: '/learn', label: 'Learn', icon: GraduationCap },
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
  const [moreOpen, setMoreOpen] = useState(false)
  const inMore = MORE.some((n) => location.pathname === n.to || location.pathname.startsWith(`${n.to}/`)) || location.pathname.startsWith('/tag/')

  useEffect(() => { setMoreOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  return (
    <div className="ambient min-h-full md:grid md:grid-cols-[240px_1fr]">
      <Toasts />
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
        {session && !writing && <OutboxBanner userId={session.user.id} />}
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
            <button
              type="button"
              className={clsx('flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium', inMore || moreOpen ? 'text-fg' : 'text-muted')}
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
            >
              <Menu size={20} style={inMore || moreOpen ? { color: 'var(--accent)' } : undefined} />
              More
            </button>
          </div>
        </nav>
      )}

      {moreOpen && !hideMobileNav && (
        <div className="md:hidden fixed inset-0 z-[15]" style={{ background: 'rgba(0,0,0,.45)' }} onClick={() => setMoreOpen(false)}>
          <div
            role="menu"
            className="absolute inset-x-3 card fade-in grid gap-1"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)', padding: '.5rem', background: 'var(--bg-elev)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {MORE.map((n) => (
              <NavLink key={n.to} to={n.to} role="menuitem" className={({ isActive }) => clsx('nav-item', isActive && 'nav-item-active')}>
                <n.icon size={18} />
                {n.label}
              </NavLink>
            ))}
            <button type="button" role="menuitem" className="nav-item w-full" onClick={() => void signOut()}>
              <LogOut size={18} /> Sign out
            </button>
          </div>
        </div>
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
