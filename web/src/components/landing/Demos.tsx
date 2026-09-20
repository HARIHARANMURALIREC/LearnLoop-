import { useEffect, useMemo, useState } from 'react'
import { decayFactor, masteryColor } from '../../lib/scoring'

/** Cycles through phrases with a typing/deleting effect. */
export function TypeWriter({ words }: { words: string[] }) {
  const [i, setI] = useState(0), [txt, setTxt] = useState(''), [del, setDel] = useState(false)
  useEffect(() => {
    const w = words[i]
    const t = setTimeout(() => {
      if (!del) { setTxt(w.slice(0, txt.length + 1)); if (txt.length + 1 === w.length) setTimeout(() => setDel(true), 1400) }
      else { setTxt(w.slice(0, txt.length - 1)); if (txt.length - 1 === 0) { setDel(false); setI((i + 1) % words.length) } }
    }, del ? 35 : 75)
    return () => clearTimeout(t)
  }, [txt, del, i, words])
  return <span className="caret gradient-text">{txt}</span>
}

const SCRIPT = [
  { role: 'ai', text: 'Tell me about a time you debugged a tricky layout issue.' },
  { role: 'user', text: 'A flexbox overflow on mobile. I fixed the vertical alignment with justify-content.' },
  { role: 'ai', text: 'Hold on — justify-content runs along the main axis. Which property controls the cross axis?', probe: true },
  { role: 'user', text: '…align-items. I mixed those up, honestly.' },
] as const
type Status = 'thinking' | 'speaking' | 'listening'
const ORB: Record<Status, { c: string; l: string }> = { thinking: { c: '#f59e0b', l: 'Thinking…' }, speaking: { c: '#818cf8', l: 'AI speaking' }, listening: { c: '#34d399', l: 'Listening — go ahead' } }

/** Auto-playing mock of the live voice interview, including a deliberate weak-point probe. */
export function VoiceDemo() {
  const [n, setN] = useState(0)
  const [status, setStatus] = useState<Status>('thinking')
  useEffect(() => {
    let alive = true; const ids: number[] = []
    const later = (fn: () => void, ms: number) => { ids.push(window.setTimeout(() => alive && fn(), ms)) }
    const step = (i: number) => {
      if (i >= SCRIPT.length) return later(() => { setN(0); step(0) }, 4200)
      if (SCRIPT[i].role === 'ai') {
        setStatus('thinking')
        later(() => { setN(i + 1); setStatus('speaking'); later(() => { setStatus('listening'); later(() => step(i + 1), 1600) }, 2400) }, 900)
      } else { setStatus('listening'); later(() => { setN(i + 1); step(i + 1) }, 2200) }
    }
    step(0)
    return () => { alive = false; ids.forEach(clearTimeout) }
  }, [])
  const o = ORB[status]
  return (
    <div className="grid items-center gap-8 sm:grid-cols-[auto_1fr] sm:gap-12">
      <div className="mx-auto flex flex-col items-center gap-2">
        <div className="relative grid h-36 w-36 place-items-center">
          {[0, 1, 2].map((i) => <span key={status + i} className="ring" style={{ borderColor: o.c, animationDelay: `${i * 0.7}s` }} />)}
          <div className="orb-core orb-active h-24 w-24 rounded-full" style={{ background: `radial-gradient(circle at 30% 28%, #ffffffaa, ${o.c} 55%)`, boxShadow: `0 0 70px ${o.c}99` }} />
        </div>
        <p className="mt-3 text-sm text-slate-300">{o.l}</p>
        <p className="text-xs text-slate-500">replies in ~600 ms</p>
      </div>
      <div className="min-h-[260px] space-y-2">
        {SCRIPT.slice(0, n).map((l, i) => (
          <div key={i} className={`msg-in flex ${l.role === 'user' ? 'justify-end' : ''}`}>
            <div className="max-w-[88%] space-y-1">
              {'probe' in l && <p className="text-[11px] font-medium text-amber-300">🎯 Probing a known weak point: CSS Flexbox</p>}
              <p className={`rounded-2xl px-3 py-2 text-sm ${l.role === 'user' ? 'rounded-br-md bg-gradient-to-br from-indigo-500/50 to-pink-500/30' : 'rounded-bl-md bg-white/8'} ${'probe' in l ? 'ring-1 ring-amber-400/50' : ''}`}>{l.text}</p>
            </div>
          </div>
        ))}
        {status === 'thinking' && <p className="flex gap-1 px-2 text-slate-500">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: `${i * 0.15}s` }} />)}</p>}
      </div>
    </div>
  )
}

const DECAY = [
  { name: 'Spanish vocabulary', base: 88, rate: 1.8 }, { name: 'Verb conjugations', base: 74, rate: 1.4 },
  { name: 'Pronunciation', base: 66, rate: 1.1 }, { name: 'Grammar structure', base: 80, rate: 0.6 },
]
/** Drag the slider: skills fade at their own domain-aware rates, using the app's real decay formula. */
export function DecayDemo() {
  const [days, setDays] = useState(21)
  const last = useMemo(() => new Date(Date.now() - days * 86_400_000).toISOString(), [days])
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm"><span className="text-slate-400">Days without practice</span><span className="font-display text-xl font-bold">{days}</span></div>
      <input type="range" min={0} max={90} value={days} onChange={(e) => setDays(+e.target.value)} className="w-full accent-indigo-400" aria-label="Days without practice" />
      <div className="grid grid-cols-2 gap-3">
        {DECAY.map((s) => {
          const eff = s.base * decayFactor(days ? last : null, s.rate)
          return (
            <div key={s.name} className="rounded-2xl p-3 transition-all duration-500" style={{ background: masteryColor(eff), opacity: 0.55 + eff / 230 }}>
              <p className="text-sm font-medium leading-tight">{s.name}</p>
              <p className="font-display text-3xl font-bold">{Math.round(eff)}</p>
              <p className="text-xs text-white/70">{eff < s.base - 0.5 ? `↓${Math.round(s.base - eff)} · decay ×${s.rate}` : 'fresh'}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const NAMES = ['Aarav', 'Maya', 'Leo', 'Sana']
/** Leaderboard that reorders as pod-mates answer the live group challenge. */
export function PodDemo() {
  const [scores, setScores] = useState([3, 2, 2, 1])
  useEffect(() => {
    const id = setInterval(() => setScores((s) => { const n = [...s]; n[(Math.random() * 4) | 0] += 1; return n.some((x) => x > 9) ? [1, 0, 0, 0] : n }), 1500)
    return () => clearInterval(id)
  }, [])
  const rank = useMemo(() => NAMES.map((_, i) => scores.filter((s, j) => s > scores[i] || (s === scores[i] && j < i)).length), [scores])
  return (
    <div className="relative" style={{ height: NAMES.length * 54 }} aria-label="Live leaderboard demo">
      {NAMES.map((n, i) => (
        <div key={n} className="absolute left-0 right-0 flex items-center gap-3 transition-[top] duration-700 ease-out" style={{ top: rank[i] * 54, height: 46 }}>
          <span className="w-5 text-center font-display text-slate-500">{rank[i] + 1}</span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-xs font-bold">{n[0]}</span>
          <div className="flex-1"><div className="flex justify-between text-sm"><span>{n}</span><span className="text-slate-400">{scores[i]} correct</span></div>
            <div className="mt-1 h-1.5 rounded bg-white/10"><div className="h-full rounded bg-gradient-to-r from-indigo-500 to-pink-400 transition-all duration-700" style={{ width: `${Math.min(100, scores[i] * 11)}%` }} /></div></div>
        </div>
      ))}
    </div>
  )
}
