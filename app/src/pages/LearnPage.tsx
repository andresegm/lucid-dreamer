import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Brain,
  Feather,
  Moon,
  NotebookPen,
  Sparkles,
} from 'lucide-react'
import clsx from 'clsx'
import {
  INDUCTION_GUIDES,
  JOURNALING_WHY,
  LEARN_SECTIONS,
  LUCID_BASICS,
  RECALL_BASICS,
  SLEEP_CYCLE_NOTE,
  SLEEP_STAGES,
  type LearnSectionId,
} from '@/lib/learn'
import { PageHeader } from '@/components/ui'

const SECTION_ICONS: Record<LearnSectionId, typeof Moon> = {
  basics: Sparkles,
  sleep: Moon,
  recall: Brain,
  journaling: NotebookPen,
  methods: Feather,
}

function sectionFromHash(hash: string): LearnSectionId | null {
  const id = hash.replace(/^#/, '') as LearnSectionId
  return LEARN_SECTIONS.some((s) => s.id === id) ? id : null
}

export function LearnPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [active, setActive] = useState<LearnSectionId>(() => sectionFromHash(location.hash) ?? 'basics')
  const ignoreObsUntil = useRef(0)

  useEffect(() => {
    const next = sectionFromHash(location.hash)
    if (!next) return
    setActive(next)
    ignoreObsUntil.current = Date.now() + 800
    requestAnimationFrame(() =>
      document.getElementById(next)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }, [location.hash])

  useEffect(() => {
    const nodes = LEARN_SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    if (!nodes.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < ignoreObsUntil.current) return
        // The section nearest the top of the screen, not the one that fills the most of the band.
        const topmost = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (topmost?.target.id) setActive(topmost.target.id as LearnSectionId)
      },
      { rootMargin: '-120px 0px -50% 0px', threshold: [0, 0.2, 0.5] },
    )
    for (const n of nodes) observer.observe(n)
    return () => observer.disconnect()
  }, [])

  function go(id: LearnSectionId) {
    setActive(id)
    ignoreObsUntil.current = Date.now() + 800
    if (location.hash === `#${id}`) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      navigate({ pathname: '/learn', hash: id }, { replace: true })
    }
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Learn"
        subtitle="The quiet basics — awareness, sleep, recall, journaling, and the induction methods you can tag."
      />

      <nav
        className="sticky z-10 -mx-1 px-1 py-2 mb-5 backdrop-blur-xl"
        style={{ top: 'env(safe-area-inset-top, 0px)', background: 'color-mix(in srgb, var(--bg) 92%, transparent)' }}
        aria-label="Learn sections"
      >
        <div className="flex flex-wrap gap-1.5">
          {LEARN_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={clsx('chip chip-btn', active === s.id && 'chip-active')}
              onClick={() => go(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="grid gap-6">
        <Section id="basics">
          <SectionHead id="basics" />
          <p className="text-sm text-muted leading-relaxed mb-4">{LUCID_BASICS.lead}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {LUCID_BASICS.points.map((p) => (
              <article key={p.title} className="rounded-xl p-3.5" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}>
                <h3 className="font-medium mb-1">{p.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{p.body}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section id="sleep">
          <SectionHead id="sleep" />
          <ol className="grid gap-3 mb-4">
            {SLEEP_STAGES.map((stage, i) => (
              <li
                key={stage.id}
                className="flex gap-3 rounded-xl p-3.5"
                style={{
                  background: stage.lucid ? 'color-mix(in srgb, var(--lucid) 10%, var(--bg-elev-2))' : 'var(--bg-elev-2)',
                  border: `1px solid ${stage.lucid ? 'color-mix(in srgb, var(--lucid) 35%, transparent)' : 'var(--border)'}`,
                }}
              >
                <span
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{
                    background: stage.lucid ? 'color-mix(in srgb, var(--lucid) 22%, transparent)' : 'var(--bg-elev)',
                    color: stage.lucid ? 'var(--lucid)' : 'var(--text-muted)',
                  }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h3 className="font-medium">{stage.name}</h3>
                    <span className="text-xs text-faint">{stage.short}</span>
                  </div>
                  <p className="text-sm text-muted leading-relaxed mt-1">{stage.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted leading-relaxed">{SLEEP_CYCLE_NOTE}</p>
        </Section>

        <Section id="recall">
          <SectionHead id="recall" />
          <p className="text-sm text-muted leading-relaxed mb-4">{RECALL_BASICS.lead}</p>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {RECALL_BASICS.points.map((p) => (
              <article key={p.title} className="rounded-xl p-3.5" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}>
                <h3 className="font-medium mb-1">{p.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{p.body}</p>
              </article>
            ))}
          </div>
          <Link to="/stats#recall-tips" className="btn text-sm">
            <BookOpen size={16} /> Practical recall tips
          </Link>
        </Section>

        <Section id="journaling">
          <SectionHead id="journaling" />
          <p className="text-sm text-muted leading-relaxed mb-4">{JOURNALING_WHY.lead}</p>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {JOURNALING_WHY.points.map((p) => (
              <article key={p.title} className="rounded-xl p-3.5" style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}>
                <h3 className="font-medium mb-1">{p.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{p.body}</p>
              </article>
            ))}
          </div>
          <Link to="/capture" className="btn btn-primary text-sm">
            <NotebookPen size={16} /> Write now
          </Link>
        </Section>

        <Section id="methods">
          <SectionHead id="methods" />
          <p className="text-sm text-muted leading-relaxed mb-4">
            When a dream is lucid or semi-lucid, Lucid lets you tag how it happened. These are the built-in categories — short labels for the journal, with a little more context here.
          </p>
          <div className="grid gap-3">
            {INDUCTION_GUIDES.map((m) => (
              <article
                key={m.id}
                id={`method-${m.id.toLowerCase()}`}
                className="rounded-xl p-3.5 scroll-mt-[calc(env(safe-area-inset-top,0px)+4.5rem)]"
                style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--border)' }}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1.5">
                  <span className="chip chip-active">{m.name}</span>
                  <h3 className="font-medium">{m.fullName}</h3>
                </div>
                <p className="text-xs text-faint mb-2">{m.summary}</p>
                <p className="text-sm text-muted leading-relaxed">{m.how}</p>
                <p className="text-sm leading-relaxed mt-2" style={{ color: 'var(--text)' }}>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted mr-2">Try</span>
                  {m.tip}
                </p>
              </article>
            ))}
          </div>
          <p className="text-xs text-faint mt-4">
            You can also log a custom method as “Other” on any lucid entry. See which ones show up for you on{' '}
            <Link to="/stats#lucid" className="text-muted hover:text-fg underline-offset-2 hover:underline">Stats → Lucid</Link>.
          </p>
        </Section>
      </div>
    </div>
  )
}

function Section({ id, children }: { id: LearnSectionId; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-[calc(env(safe-area-inset-top,0px)+4.5rem)]">
      {children}
    </section>
  )
}

function SectionHead({ id }: { id: LearnSectionId }) {
  const meta = LEARN_SECTIONS.find((s) => s.id === id)!
  const Icon = SECTION_ICONS[id]
  return (
    <div className="flex items-start gap-3 mb-4">
      <span
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <h2 className="font-semibold text-lg tracking-tight">{meta.title}</h2>
        <p className="text-sm text-muted mt-0.5">{meta.blurb}</p>
      </div>
    </div>
  )
}
