import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DecayDemo, PodDemo, TypeWriter, VoiceDemo } from '../components/landing/Demos'
import FeatureExplorer from '../components/landing/Features'
import Particles from '../components/landing/Particles'
import { Reveal, Spot } from '../components/landing/Reveal'
import { useInView, useScrollProgress } from '../components/landing/hooks'
import { Logo } from '../components/Layout'
import { CountUp, Gauge } from '../components/ui'
import { masteryColor } from '../lib/scoring'

const GOALS = ['Frontend Developer', 'Conversational Spanish', 'Digital Marketer', 'Data Analyst', 'Public Speaker', 'Sales Rep']

const STEPS = [
  ['01', 'Set a goal', 'Type what you want to become. AI builds a weighted skill map with decay rates per skill.'],
  ['02', 'Diagnose', 'A short adaptive quiz per skill finds your true level and flags confident misconceptions.'],
  ['03', 'Practice', 'Targeted explanations, explain-it-back checks and fresh questions on your weakest skills.'],
  ['04', 'Simulate', 'Rehearse the real thing by voice: interviews, client calls, conversations.'],
  ['05', 'Prove it', 'Every pass lands in a verifiable ledger you can export and share.'],
]

const DOMAINS = [
  { icon: '💼', name: 'Technical', goals: 'Frontend Developer · Data Analyst', sim: 'Voice interview + live coding round + code review' },
  { icon: '🌍', name: 'Languages', goals: 'Conversational Spanish · Business French', sim: 'Native-speaker conversation, pace and vocabulary adapted to you' },
  { icon: '📣', name: 'Non-technical', goals: 'Digital Marketing · Sales · Public Speaking', sim: 'Skeptical-client call that pushes back on price and trust' },
]

const MARQUEE = ['Adaptive diagnostic', 'Confidence calibration', 'Explain it back', 'Skill decay', 'Time-to-Ready', 'Live voice simulation', 'Coding round', 'Reverse tutor', 'Study pods', 'Group challenges', 'Resume analysis', 'Proof of work', 'Ghost competitor', 'Mobile app']

function Stat({ to, suffix = '', label }: { to: number; suffix?: string; label: string }) {
  const [ref, seen] = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className="text-center">
      <p className="gradient-text font-display text-4xl font-bold sm:text-5xl">{seen ? <CountUp value={to} /> : 0}{suffix}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  )
}

const H2 = ({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) => (
  <Reveal className="mx-auto mb-10 max-w-2xl text-center">
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">{eyebrow}</p>
    <h2 className="font-display text-3xl font-bold leading-tight text-balance sm:text-5xl">{title}</h2>
    {sub && <p className="mt-3 text-slate-400">{sub}</p>}
  </Reveal>
)

function HeroMock() {
  const tiles = [['React hooks', 82], ['CSS layout', 41], ['Async JS', 67], ['Testing', 24], ['Accessibility', 55], ['Git', 90]] as const
  return (
    <div className="relative mx-auto mt-14 w-full max-w-4xl">
      <div className="glass border-beam relative rounded-3xl p-4 sm:p-6" style={{ boxShadow: '0 40px 120px -30px #7c5cff77' }}>
        <div className="mb-4 flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-400/70" /><span className="h-3 w-3 rounded-full bg-amber-400/70" /><span className="h-3 w-3 rounded-full bg-emerald-400/70" /><span className="ml-3 text-xs text-slate-500">learnloop · Frontend Developer</span></div>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-4 rounded-2xl bg-white/[.04] p-4">
            <Gauge value={64} max={80} size={112}><div><p className="font-display text-3xl font-bold leading-none"><CountUp value={64} duration={1600} /></p><p className="text-[10px] text-slate-500">of 80</p></div></Gauge>
            <div><p className="text-[11px] uppercase tracking-widest text-slate-400">Time to ready</p><p className="gradient-text font-display text-3xl font-bold">~18 days</p></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {tiles.map(([n, v], i) => (
              <div key={n} className="tile tile-in rounded-xl p-2.5 text-left" style={{ background: masteryColor(v), animationDelay: `${600 + i * 90}ms`, opacity: 0.6 + v / 250 }}>
                <p className="text-[11px] font-medium leading-tight">{n}</p><p className="font-display text-xl font-bold">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bob glass absolute -left-2 top-10 hidden rounded-2xl px-3 py-2 text-xs sm:block sm:-left-10" style={{ ['--r' as string]: '-4deg' }}>⚠️ <b className="text-amber-300">High-confidence wrong</b> flagged: CSS layout</div>
      <div className="bob glass absolute -right-2 -top-4 hidden rounded-2xl px-3 py-2 text-xs sm:block sm:-right-10" style={{ ['--r' as string]: '3deg', animationDelay: '-1.5s' }}>✅ Explain-back <b className="text-emerald-300">passed</b> · logged to proof</div>
      <div className="bob glass absolute -bottom-5 left-1/4 hidden rounded-2xl px-3 py-2 text-xs sm:block" style={{ ['--r' as string]: '2deg', animationDelay: '-3s' }}>🎙️ Mock interview · <b className="text-indigo-300">score 82</b></div>
    </div>
  )
}

export default function Landing() {
  const progress = useScrollProgress()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => { const on = () => setScrolled(scrollY > 16); on(); addEventListener('scroll', on, { passive: true }); return () => removeEventListener('scroll', on) }, [])

  return (
    <div className="relative overflow-x-clip">
      <div className="fixed left-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-400" style={{ transform: `scaleX(${progress})`, width: '100%' }} />

      <header className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${scrolled ? 'glass !rounded-none !border-x-0 !border-t-0' : ''}`}>
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <a href="#top" className="flex items-center gap-2 font-display text-lg font-bold"><Logo /><span className="gradient-text">LearnLoop</span></a>
          <nav className="ml-auto hidden items-center gap-6 text-sm text-slate-300 md:flex">
            {[['features', 'Features'], ['how', 'How it works'], ['simulation', 'Simulation'], ['pods', 'Pods'], ['proof', 'Proof']].map(([id, l]) => <a key={id} href={`#${id}`} className="transition-colors hover:text-white">{l}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link to="/auth?mode=login" className="rounded-xl px-3 py-1.5 text-sm text-slate-300 transition-colors hover:text-white">Log in</Link>
            <Link to="/auth?mode=signup" className="btn !px-4 !py-1.5 text-sm">Get started</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="top" className="relative overflow-hidden px-4 pb-28 pt-32 text-center sm:pt-40">
        <div className="grid-bg" /><div className="grid-floor" /><Particles />
        <div className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 animate-float rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="relative mx-auto max-w-4xl">
          <Reveal><span className="chip mb-5 !bg-white/[.06] py-1"><span className="pulse-ring h-2 w-2 rounded-full bg-emerald-400" />Live AI voice simulation · now on iOS &amp; Android</span></Reveal>
          <Reveal delay={80}><h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">Go from “I want to be a<br /><span className="inline-block min-h-[1.1em]"><TypeWriter words={GOALS} /></span>”<br />to <span className="gradient-text">provably ready.</span></h1></Reveal>
          <Reveal delay={160}><p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">LearnLoop diagnoses your real level, teaches in the style that fits you, lets you rehearse the real thing out loud with AI, and keeps verifiable proof of everything you can do.</p></Reveal>
          <Reveal delay={240} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth?mode=signup" className="btn !px-6 !py-3 text-base">Start free →</Link>
            <a href="#simulation" className="glass lift rounded-xl px-6 py-3 text-base font-medium">▶ See it talk</a>
          </Reveal>
          <Reveal delay={320}><p className="mt-4 text-xs text-slate-500">Works for technical, language and non-technical goals · no credit card</p></Reveal>
          <Reveal delay={400}><HeroMock /></Reveal>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee glass overflow-hidden !rounded-none !border-x-0 py-4" aria-hidden>
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i} className="mx-5 flex items-center gap-10 whitespace-nowrap text-sm font-medium text-slate-300">{m}<span className="text-indigo-400">✦</span></span>)}
        </div>
      </div>

      {/* STATS */}
      <section className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 py-20 md:grid-cols-4">
        <Stat to={5} label="live simulation modes" /><Stat to={3} label="explanation styles" /><Stat to={17} suffix="+" label="learning features" /><Stat to={14} label="row-secured data tables" />
      </section>

      {/* HOW */}
      <section id="how" className="mx-auto max-w-5xl px-4 py-16">
        <H2 eyebrow="How it works" title={<>One loop. <span className="gradient-text">Five steps.</span></>} sub="From a blank goal to exportable proof." />
        <div className="relative">
          <div className="absolute bottom-6 left-[27px] top-6 hidden w-px bg-gradient-to-b from-indigo-500/60 via-pink-500/40 to-transparent md:block" />
          <div className="space-y-4">
            {STEPS.map(([n, t, d], i) => (
              <Reveal key={n} delay={i * 80}>
                <div className="flex items-start gap-5">
                  <div className="glass relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-display text-lg font-bold text-indigo-300">{n}</div>
                  <div className="glass lift flex-1 rounded-2xl p-4"><h3 className="font-display text-xl font-semibold">{t}</h3><p className="text-sm text-slate-400">{d}</p></div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <H2 eyebrow="Everything in one place" title={<>Not a quiz app. <span className="gradient-text">A full readiness system.</span></>} sub="Pick a category. Every feature shown is in the product today." />
        <FeatureExplorer />
      </section>

      {/* SIMULATION */}
      <section id="simulation" className="relative mx-auto max-w-5xl px-4 py-20">
        <div className="pointer-events-none absolute inset-x-0 top-10 mx-auto h-64 max-w-md rounded-full bg-indigo-500/20 blur-3xl" />
        <H2 eyebrow="The centerpiece" title={<>Practice the real thing, <span className="gradient-text">out loud.</span></>} sub="Sub-second AI replies make it feel like a conversation, not a turn-based chat." />
        <Reveal><div className="glass border-beam relative rounded-3xl p-5 sm:p-8"><VoiceDemo /></div></Reveal>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {DOMAINS.map((d, i) => (
            <Spot key={d.name} delay={i * 80}><span className="text-3xl">{d.icon}</span><h3 className="mt-2 font-display text-lg font-semibold">{d.name}</h3>
              <p className="text-xs text-indigo-300">{d.goals}</p><p className="mt-2 text-sm text-slate-400">{d.sim}</p></Spot>
          ))}
        </div>
      </section>

      {/* DECAY */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-20 md:grid-cols-2">
        <div>
          <Reveal><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Skill decay</p>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Skills you don’t use <span className="gradient-text">visibly fade.</span></h2>
            <p className="mt-3 text-slate-400">Each skill has its own decay rate. Vocabulary slips fast; grammar structure sticks. Your dashboard shows what’s still sharp today, not what you knew last month. Drag the slider and watch it happen.</p></Reveal>
        </div>
        <Reveal delay={120}><div className="glass rounded-3xl p-5"><DecayDemo /></div></Reveal>
      </section>

      {/* PODS */}
      <section id="pods" className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-20 md:grid-cols-2">
        <Reveal delay={120} className="order-2 md:order-1"><div className="glass rounded-3xl p-5"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">⚡ Live group challenge · Async JavaScript</p><PodDemo /></div></Reveal>
        <div className="order-1 md:order-2">
          <Reveal><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Study pods</p>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Learn faster <span className="gradient-text">together.</span></h2>
            <ul className="mt-4 space-y-3 text-slate-300">
              {['Join with a six-character code', 'Shared gap map of everyone’s skills', 'Automatic strong-teaches-weak peer pairs', 'Realtime challenges with live presence and leaderboard', 'Passed explanations shared with pod-mates who need them'].map((t) => (
                <li key={t} className="flex gap-3"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/20 text-xs text-emerald-300">✓</span><span className="text-sm">{t}</span></li>
              ))}
            </ul></Reveal>
        </div>
      </section>

      {/* PROOF */}
      <section id="proof" className="mx-auto max-w-5xl px-4 py-20">
        <H2 eyebrow="Proof of work" title={<>Receipts, <span className="gradient-text">not badges.</span></>} sub="Every verified skill is timestamped and evidence-backed, then exportable and resume-ready." />
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal><div className="glass h-full space-y-3 rounded-3xl p-5">
            {[['Explain-back passed', 'React hooks', 'Explained useEffect cleanup (analogy style) and answered 3/3 questions; mastery 52 → 71.', 'text-indigo-300'],
              ['Simulation passed', 'Frontend Developer', 'Mock interview scored 82/100; coding round tests passed.', 'text-emerald-300'],
              ['Peer taught', 'CSS layout', 'Taught flexbox to a confused student; teaching held up under questioning.', 'text-sky-300']].map(([t, s, e, c]) => (
              <div key={t} className="rounded-2xl bg-white/[.04] p-3"><div className="flex items-center gap-2 text-xs"><span className={`chip ${c}`}>{t}</span><b>{s}</b></div><p className="mt-1.5 text-sm text-slate-400">{e}</p></div>
            ))}</div></Reveal>
          <Reveal delay={120}><div className="glass h-full rounded-3xl p-5">
            <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Export · markdown</p><span className="chip">resume &amp; LinkedIn ready</span></div>
            <pre className="overflow-x-auto rounded-2xl bg-black/30 p-4 font-mono text-xs leading-relaxed text-slate-300">{`# Skill Provenance: Frontend Developer
_3 verified entries_

- **Sep 20** · Simulation passed
  Mock interview: 82/100; coding
  round tests passed.
- **Sep 18** · Explain-back passed
  · React hooks
  Explained useEffect cleanup…`}</pre>
            <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/[.06] p-3 text-sm"><b className="text-amber-300">Resume gap check:</b> <span className="text-slate-300">“Advanced React” claimed · <b>Intermediate</b> tested — level mismatch flagged.</span></div>
          </div></Reveal>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <H2 eyebrow="What’s next" title={<>On the <span className="gradient-text">roadmap.</span></>} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Spot><span className="chip mb-2">Vision</span><h3 className="font-display text-lg font-semibold">Pod-to-Opportunity pipeline</h3><p className="mt-1 text-sm text-slate-400">When a pod’s collective proof crosses a threshold: an open-source issue for dev pods, a language-exchange group, a pro-bono campaign brief.</p></Spot>
          <Spot delay={80}><span className="chip mb-2">Vision</span><h3 className="font-display text-lg font-semibold">Fully adaptive micro-lessons</h3><p className="mt-1 text-sm text-slate-400">Custom lessons generated on the fly for your exact gap, style and domain, instead of a static resource library.</p></Spot>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-4 py-24">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="glass border-beam relative overflow-hidden rounded-[2rem] p-8 text-center sm:p-14">
              <div className="grid-bg !opacity-60" />
              <div className="relative">
                <h2 className="font-display text-4xl font-bold leading-tight sm:text-5xl">Ready to become <span className="gradient-text">provably ready?</span></h2>
                <p className="mx-auto mt-3 max-w-md text-slate-400">Set a goal, take the diagnostic, and have your first voice session in about ten minutes.</p>
                <div className="mt-7 flex flex-wrap justify-center gap-3"><Link to="/auth?mode=signup" className="btn !px-7 !py-3 text-base">Create free account →</Link><Link to="/auth?mode=login" className="glass lift rounded-xl px-7 py-3 text-base font-medium">Log in</Link></div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span className="flex items-center gap-2"><Logo size={22} />LearnLoop · learn, simulate, prove.</span>
          <span>Built By TEAM OG</span>
        </div>
      </footer>
    </div>
  )
}
