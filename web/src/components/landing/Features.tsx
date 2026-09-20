import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Gauge } from '../ui'
import { Reveal } from './Reveal'

/* ---- tiny live visuals for each category's featured card ---- */
const ConfidenceVisual = () => (
  <div className="space-y-3">
    <p className="text-sm text-slate-200">Which property controls the cross axis?</p>
    <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => <span key={n} className={`grid h-9 flex-1 place-items-center rounded-lg text-sm ${n === 5 ? 'bg-indigo-500/50 ring-1 ring-indigo-300' : 'bg-white/[.07]'}`}>{n}</span>)}</div>
    <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-2 text-xs text-amber-200">⚠ 5/5 sure · wrong → flagged as a priority fix</p>
  </div>
)
const TrackVisual = () => (
  <div className="flex items-center gap-4">
    <Gauge value={64} max={80} size={96}><div><p className="font-display text-2xl font-bold leading-none">64</p><p className="text-[10px] text-slate-500">of 80</p></div></Gauge>
    <div><p className="text-[11px] uppercase tracking-widest text-slate-400">Time to ready</p><p className="gradient-text font-display text-3xl font-bold">~18 days</p><p className="text-xs text-slate-500">+2.1 pts / day trend</p></div>
  </div>
)
const WaveVisual = () => (
  <div className="space-y-2">
    <div className="flex h-16 items-center justify-center gap-[3px]">
      {Array.from({ length: 28 }, (_, i) => <span key={i} className="wave-bar w-1 rounded-full bg-gradient-to-t from-indigo-500 to-pink-400" style={{ height: `${30 + ((i * 37) % 70)}%`, animationDelay: `${(i % 9) * 0.12}s` }} />)}
    </div>
    <p className="text-center text-xs text-slate-400">AI replied in <b className="text-emerald-300">~600 ms</b></p>
  </div>
)
const PodVisual = () => (
  <div className="space-y-3">
    <div className="flex items-center"><div className="flex -space-x-2">{['A', 'M', 'L', 'S'].map((n, i) => <span key={n} className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-900 bg-gradient-to-br from-indigo-500 to-pink-500 text-xs font-bold" style={{ filter: `hue-rotate(${i * 40}deg)` }}>{n}</span>)}</div>
      <span className="ml-3 flex items-center gap-1.5 text-xs text-emerald-300"><span className="pulse-ring h-2 w-2 rounded-full bg-emerald-400" />3 online</span></div>
    <div className="flex gap-1.5">{[82, 41, 67, 24].map((v) => <span key={v} className="grid h-9 flex-1 place-items-center rounded-lg text-xs font-semibold" style={{ background: `hsl(${(v / 100) * 130} 65% 38%)` }}>{v}</span>)}</div>
    <p className="text-xs text-slate-400">Pod gap map · weakest skill becomes the next challenge</p>
  </div>
)
const LedgerVisual = () => (
  <div className="space-y-2">
    {[['Explain-back passed', 'text-indigo-300'], ['Simulation passed', 'text-emerald-300'], ['Peer taught', 'text-sky-300']].map(([t, c], i) => (
      <div key={t} className="flex items-center justify-between rounded-xl bg-white/[.05] px-3 py-2 text-xs"><span className={c}>● {t}</span><span className="text-slate-500">Sep {20 - i * 2}</span></div>
    ))}
  </div>
)

interface Item { icon: string; title: string; text: string }
interface Category { id: string; icon: string; label: string; blurb: string; featured: Item & { visual: ReactNode }; items: Item[] }

const CATEGORIES: Category[] = [
  { id: 'learn', icon: '🎯', label: 'Learn', blurb: 'Find the real gap, then close it your way.',
    featured: { icon: '🎚️', title: 'Confidence calibration', text: 'Rate how sure you are before the answer appears. Confident-but-wrong answers become your top priority.', visual: <ConfidenceVisual /> },
    items: [
      { icon: '🎯', title: 'Adaptive diagnostic', text: 'Finds your level per sub-skill. Difficulty shifts with every answer.' },
      { icon: '🔬', title: 'Error-type detection', text: 'Tells a concept gap from a careless slip or a misread.' },
      { icon: '🎨', title: 'Explanations that fit', text: 'Analogy, step-by-step or visual, matched to your level.' },
      { icon: '🗣️', title: 'Explain it back', text: 'Say it in your own words. AI checks if it holds up.' },
    ] },
  { id: 'track', icon: '📈', label: 'Track', blurb: 'An honest picture of where you stand today.',
    featured: { icon: '⏱️', title: 'Time-to-Ready', text: 'A deterministic projection from your real progress trend. Explainable maths, never an AI guess.', visual: <TrackVisual /> },
    items: [
      { icon: '📉', title: 'Skill decay', text: 'Unused skills fade at domain-aware rates. Vocabulary fades fastest.' },
      { icon: '🚀', title: 'Cross-domain head start', text: 'See how much skills from other goals already transfer.' },
      { icon: '👻', title: 'Ghost competitor', text: 'Race a simulated benchmark learner. Clearly labelled as illustrative.' },
    ] },
  { id: 'simulate', icon: '🎙️', label: 'Simulate', blurb: 'Rehearse the real thing, out loud, in real time.',
    featured: { icon: '🎙️', title: 'Live voice simulation', text: 'Talk to a native speaker, a skeptical client or an interviewer. It deliberately probes the weak spots your diagnostic found.', visual: <WaveVisual /> },
    items: [
      { icon: '💻', title: 'Live coding round', text: 'Real editor, sandboxed run, AI review and a spoken follow-up.' },
      { icon: '🧑‍🏫', title: 'Reverse tutor', text: 'Teach a confused AI student. Surviving their questions is real proof.' },
    ] },
  { id: 'together', icon: '👥', label: 'Together', blurb: 'Learn faster with people on the same goal.',
    featured: { icon: '👥', title: 'Study pods', text: 'Join with a code. See the shared gap map, get matched peer pairs, and swap explanations that passed the check.', visual: <PodVisual /> },
    items: [{ icon: '⚡', title: 'Live group challenges', text: 'Realtime questions on the pod’s weakest skill, with presence and a live leaderboard.' }] },
  { id: 'prove', icon: '🏅', label: 'Prove & go', blurb: 'Turn practice into evidence you can show.',
    featured: { icon: '🏅', title: 'Proof of work ledger', text: 'A timestamped, evidence-backed record of what you can verifiably do. Export it as markdown for your resume or LinkedIn.', visual: <LedgerVisual /> },
    items: [
      { icon: '📄', title: 'Resume gap analysis', text: 'Verified vs. unproven claims, with level mismatches flagged.' },
      { icon: '📱', title: 'iOS & Android app', text: 'Dashboard, practice and live voice, in your pocket.' },
    ] },
]

/** Category tabs + one featured card and a few scannable cards per category. */
export default function FeatureExplorer() {
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const cat = CATEGORIES[active]
  const cols = cat.items.length % 3 === 0 ? 'sm:grid-cols-3' : cat.items.length === 1 ? 'sm:grid-cols-1' : 'sm:grid-cols-2'

  function onKey(e: KeyboardEvent) {
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = (active + d + CATEGORIES.length) % CATEGORIES.length
    setActive(n); refs.current[n]?.focus()
  }

  return (
    <Reveal>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div role="tablist" aria-label="Feature categories" aria-orientation="vertical" onKeyDown={onKey}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c, i) => {
            const on = i === active
            return (
              <button key={c.id} ref={(el) => { refs.current[i] = el }} role="tab" id={`tab-${c.id}`} aria-selected={on} aria-controls="feature-panel" tabIndex={on ? 0 : -1} onClick={() => setActive(i)}
                className={`group relative flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-300 lg:w-full ${on ? 'border-indigo-400/50 bg-gradient-to-r from-indigo-500/25 to-pink-500/10 shadow-[0_0_30px_-10px_#7c5cff]' : 'border-white/10 bg-white/[.03] hover:border-white/25 hover:bg-white/[.06]'}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-xl text-lg transition-transform duration-300 ${on ? 'scale-110 bg-white/15' : 'bg-white/[.07]'}`}>{c.icon}</span>
                <span className="flex-1"><span className={`block font-display font-semibold ${on ? 'text-white' : 'text-slate-300'}`}>{c.label}</span>
                  <span className="hidden text-xs text-slate-500 lg:block">{c.items.length + 1} features</span></span>
                <span className={`hidden h-1.5 w-1.5 rounded-full bg-indigo-300 transition-opacity lg:block ${on ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            )
          })}
        </div>

        <div key={cat.id} id="feature-panel" role="tabpanel" aria-labelledby={`tab-${cat.id}`} className="page-in space-y-4">
          <div><h3 className="font-display text-2xl font-bold sm:text-3xl">{cat.label}</h3><p className="text-slate-400">{cat.blurb}</p></div>

          <div className="glass border-beam relative grid items-center gap-6 rounded-3xl p-5 sm:p-7 md:grid-cols-[1.1fr_1fr]">
            <div>
              <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/40 to-pink-500/25 text-2xl">{cat.featured.icon}</span>
              <h4 className="font-display text-2xl font-bold">{cat.featured.title}</h4>
              <p className="mt-2 leading-relaxed text-slate-300">{cat.featured.text}</p>
            </div>
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">{cat.featured.visual}</div>
          </div>

          <div className={`grid gap-4 ${cols}`}>
            {cat.items.map((it, i) => (
              <div key={it.title} className="fade-up spot glass lift rounded-2xl p-4" style={{ animationDelay: `${120 + i * 70}ms` }}
                onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`) }}>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.08] text-lg">{it.icon}</span>
                  <div><h4 className="font-display font-semibold">{it.title}</h4><p className="mt-0.5 text-sm leading-snug text-slate-400">{it.text}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  )
}
