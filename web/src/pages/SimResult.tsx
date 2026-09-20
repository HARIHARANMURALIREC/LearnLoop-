import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { coachSession } from '../lib/ai'
import { fireConfetti } from '../lib/confetti'
import { speechStats } from '../lib/fillers'
import { Card, CountUp, ErrorBox, Gauge, Spinner } from '../components/ui'
import { useGoalData } from '../lib/goalData'
import { speak, stopSpeaking } from '../lib/speech'
import { supabase } from '../lib/supabase'
import type { Evaluation, TranscriptEntry } from '../lib/types'

interface Sim { transcript: TranscriptEntry[]; score: number; evaluation: Evaluation | null; simulation_type: string; created_at: string }
interface Sub { problem_statement: string; code_submitted: string; execution_output: string; execution_passed: boolean; ai_review_notes: string }

const Bar = ({ label, v }: { label: string; v: number }) => (
  <div><div className="flex justify-between text-sm"><span>{label}</span><span>{Math.round(v)}</span></div>
    <div className="h-2 rounded bg-white/10"><div className="bar h-full rounded bg-gradient-to-r from-indigo-500 to-pink-400 transition-all duration-700" style={{ width: `${v}%` }} /></div></div>
)

export default function SimResult() {
  const { id } = useParams()
  const { goal } = useGoalData()
  const [sim, setSim] = useState<Sim | null>(null)
  const [subs, setSubs] = useState<Sub[]>([])
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [coach, setCoach] = useState<{ turn_index: number; kind: 'strong' | 'improve' | 'flag'; tip: string }[] | null>(null)
  const [coaching, setCoaching] = useState(false)
  const playRef = useRef(false)

  useEffect(() => {
    Promise.all([
      supabase.from('simulations').select('*').eq('id', id!).maybeSingle(),
      supabase.from('coding_round_submissions').select('*').eq('simulation_id', id!),
    ]).then(([s, c]) => {
      if (s.error || !s.data) return setError(s.error?.message ?? 'Session not found')
      setSim(s.data as Sim); setSubs((c.data as Sub[]) ?? [])
      try { const c2 = localStorage.getItem(`coach:${id}`); if (c2) setCoach(JSON.parse(c2)) } catch { /* no cache */ }
      try { if ((s.data as Sim).score >= 70 && !sessionStorage.getItem(`celebrated:${id}`)) { sessionStorage.setItem(`celebrated:${id}`, '1'); fireConfetti() } } catch { /* ignore */ }
    })
    return () => { playRef.current = false; stopSpeaking() }
  }, [id])

  function playback() {
    if (playing) { playRef.current = false; stopSpeaking(); return setPlaying(false) }
    playRef.current = true; setPlaying(true)
    const lines = sim!.transcript
    const next = (i: number) => {
      if (!playRef.current || i >= lines.length) { playRef.current = false; return setPlaying(false) }
      speak(lines[i].text, 'en-US', () => next(i + 1), false) // browser voice: playback shouldn't spend ElevenLabs credits
    }
    next(0)
  }

  async function getCoaching() {
    setCoaching(true); setError('')
    try {
      const r = await coachSession({ type: sim!.simulation_type, goal_title: goal.goal_title, transcript: sim!.transcript.map(({ role, text }) => ({ role, text })) })
      setCoach(r.moments); try { localStorage.setItem(`coach:${id}`, JSON.stringify(r.moments)) } catch { /* cache optional */ }
    } catch (e) { setError(e instanceof Error ? e.message : 'Coaching failed') }
    setCoaching(false)
  }

  if (error && !sim) return <ErrorBox message={error} />
  if (!sim) return <Spinner />
  const ev = sim.evaluation
  const quote = ev?.high_confidence_wrong_moment?.quote?.toLowerCase().slice(0, 40)
  const passed = sim.score >= 70
  const stats = speechStats(sim.transcript)
  const KIND = { strong: { icon: '✅', cls: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' }, improve: { icon: '💡', cls: 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200' }, flag: { icon: '🚩', cls: 'border-amber-400/40 bg-amber-500/10 text-amber-200' } }

  return (
    <div className="stagger mx-auto max-w-2xl space-y-4">
      <Card className="flex flex-col items-center gap-5 sm:flex-row">
        <Gauge value={sim.score} size={150}><div><p className="font-display text-5xl font-bold leading-none"><CountUp value={sim.score} /></p><p className="text-xs text-slate-500">/ 100</p></div></Gauge>
        <div className="w-full flex-1">
          <p className="text-sm text-slate-400">{new Date(sim.created_at).toLocaleString()}</p>
          <p className={`pop font-display text-xl font-semibold ${passed ? 'text-emerald-400' : 'text-amber-400'}`}>{passed ? '✓ Passed — logged to your Proof of Work' : 'Keep practicing — not logged as proof yet'}</p>
          {ev && <div className="mt-3 space-y-2"><Bar label="Correctness" v={ev.correctness} /><Bar label="Communication clarity" v={ev.communication} /></div>}
        </div>
      </Card>

      {ev?.high_confidence_wrong_moment && (
        <Card className="!border-amber-500/50 !bg-amber-500/[.07]">
          <p className="font-semibold text-amber-300">⚠️ This is exactly the kind of high-confidence-wrong moment that costs interviews</p>
          <blockquote className="mt-2 border-l-2 border-amber-500 pl-3 italic">“{ev.high_confidence_wrong_moment.quote}”</blockquote>
          <p className="mt-2 text-sm">{ev.high_confidence_wrong_moment.why}</p>
        </Card>
      )}

      {ev && <Card title="Feedback">
        <p className="text-sm">{ev.summary}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
          <div><p className="font-medium text-emerald-400">Strengths</p><ul className="list-disc pl-4 text-slate-300">{ev.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          <div><p className="font-medium text-amber-400">To improve</p><ul className="list-disc pl-4 text-slate-300">{ev.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        </div>
        {sim.simulation_type === 'reverse_tutor' && ev.teaching_held_up !== undefined && <p className="mt-3 text-sm">Teaching {ev.teaching_held_up ? 'held up ✓' : 'did not hold up under questioning ✗'}</p>}
      </Card>}

      <Card title="🎧 Delivery coaching">
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          {[['Your answers', stats.turns], ['Avg words / answer', stats.avgWords], ['Filler words', stats.fillers], ['Fillers per 100 words', stats.per100]].map(([l, v]) => (
            <div key={l as string} className="rounded-2xl bg-white/[.04] p-3"><p className={`font-display text-2xl font-bold ${l === 'Fillers per 100 words' && (v as number) > 6 ? 'text-amber-300' : ''}`}>{v as number}</p><p className="text-xs text-slate-400">{l}</p></div>))}
        </div>
        {stats.top.length > 0 && <p className="mt-2 text-sm text-slate-400">Most used: {stats.top.map(([w, n]) => `“${w}” ×${n}`).join(' · ')}{stats.per100 > 6 ? ' — try pausing silently instead.' : ''}</p>}
        {stats.avgWords > 0 && stats.avgWords < 12 && <p className="mt-1 text-sm text-amber-300">Answers are quite short — add a concrete example or reason.</p>}
        {!coach && <button className="btn mt-3" disabled={coaching} onClick={getCoaching}>{coaching ? 'Analysing your answers…' : 'Get AI coaching on my answers'}</button>}
        {error && <div className="mt-2"><ErrorBox message={error} /></div>}
      </Card>

      {subs.map((s, i) => (
        <Card key={i} title="Coding round">
          <p className="whitespace-pre-wrap text-sm">{s.problem_statement}</p>
          <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-2 text-xs">{s.code_submitted}</pre>
          <pre className={`mt-2 overflow-x-auto rounded border p-2 text-xs ${s.execution_passed ? 'border-emerald-500/50' : 'border-red-500/50'}`}>{s.execution_output}</pre>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{s.ai_review_notes}</p>
        </Card>
      ))}

      <Card title="Transcript">
        <button className="mb-3 rounded-lg border border-slate-600 px-3 py-1 text-sm" onClick={playback}>{playing ? '■ Stop' : '▶ Play back'}</button>
        <div className="space-y-2">{sim.transcript.map((t, i) => {
          const flagged = quote && t.role === 'user' && t.text.toLowerCase().includes(quote)
          const tips = (coach ?? []).filter((m) => m.turn_index === i)
          return <div key={i} className={`flex flex-col gap-1 ${t.role === 'user' ? 'items-end' : 'items-start'}`}>
            <p className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${t.role === 'user' ? 'bg-indigo-500/30' : 'bg-slate-800'} ${flagged ? 'ring-2 ring-amber-400' : ''}`}>{flagged && '⚠️ '}{t.text}</p>
            {tips.map((m, k) => <p key={k} className={`msg-in max-w-[85%] rounded-xl border px-3 py-1.5 text-xs ${KIND[m.kind].cls}`}>{KIND[m.kind].icon} {m.tip}</p>)}</div>
        })}</div>
      </Card>
      <div className="flex gap-2"><Link className="btn" to={`/g/${goal.id}/dashboard`}>Dashboard</Link>
        <Link className="rounded-lg border border-slate-700 px-4 py-2" to={`/g/${goal.id}/simulate`}>Another session</Link></div>
    </div>
  )
}
