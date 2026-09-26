import { Link } from 'react-router-dom'
import { BookOpen, Mic, Moon, Sparkles, Sunrise } from 'lucide-react'

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Write before it fades',
    body: 'A morning dump, a full entry, or a few words. Fragments count. The first minute is the one that keeps the night.',
  },
  {
    icon: Sunrise,
    title: 'Notice what returns',
    body: 'People, places, feelings. Tag them as you go and watch the same nights come back.',
  },
  {
    icon: Sparkles,
    title: 'See the stretch of mornings',
    body: 'Streaks, lucidity, a calendar of the nights you remembered. The archive becomes something you can actually use.',
  },
]

export function LandingPage() {
  return (
    <div className="ambient min-h-full">
      <header className="relative z-10 flex items-center justify-between gap-3 px-5 py-4 max-w-5xl mx-auto" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <Moon size={18} color="var(--accent-contrast)" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold">Lucid</div>
            <div className="text-[11px] text-muted">Dream Journal</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn btn-ghost">Sign in</Link>
          <Link to="/login?mode=signup" className="btn btn-primary">Start writing</Link>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-5 pb-20">
        <section className="pt-10 sm:pt-16 pb-14 max-w-2xl fade-in">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
            Write the night down before it disappears.
          </h1>
          <p className="text-muted text-lg mt-5 leading-relaxed">
            A quiet journal for dreams. Capture what you remember, tag the people and places that return, and watch recall — and lucidity — come back.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/login?mode=signup" className="btn btn-primary px-5 py-2.5">
              Create your journal
            </Link>
            <Link to="/login" className="btn px-5 py-2.5">
              I already have one
            </Link>
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-3 mb-14">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}>
                <f.icon size={18} />
              </div>
              <h2 className="font-semibold mb-1.5">{f.title}</h2>
              <p className="text-sm text-muted leading-relaxed">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="card flex flex-col sm:flex-row sm:items-center gap-4" style={{ padding: '1.25rem 1.35rem' }}>
          <div className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}>
            <Mic size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Still half-asleep?</h2>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              Record from bed, then keep writing. A few minutes is enough.
            </p>
          </div>
          <Link to="/login?mode=signup" className="btn shrink-0">Get started</Link>
        </section>
      </main>
    </div>
  )
}
