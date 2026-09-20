import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Empty } from '../components/ui'
import { useGoalData } from '../lib/goalData'
import { supabase } from '../lib/supabase'
import type { SimType } from '../lib/types'

const LABEL: Record<string, string> = {
  conversation: 'Conversation practice', client_call: 'Client call', interview_behavioral: 'Mock interview',
  interview_coding: 'Mock interview + coding', reverse_tutor: 'Reverse tutor',
}
interface SimRow { id: string; simulation_type: SimType; score: number | null; created_at: string; high_confidence_wrong_moment_flagged: boolean }

export default function Simulate() {
  const { goal, skills, states, effective } = useGoalData()
  const [recent, setRecent] = useState<SimRow[]>([])
  const [rtSkill, setRtSkill] = useState('')
  const base = `/g/${goal.id}`
  const strong = [...skills].filter((s) => states.has(s.id)).sort((a, b) => effective(b.id) - effective(a.id))
  const main = goal.domain_type === 'language'
    ? { type: 'conversation', icon: '🗣️', title: 'Conversation practice', text: 'Talk with a native speaker persona that adapts pace and vocabulary to your level.' }
    : goal.domain_type === 'technical'
    ? { type: 'interview_behavioral', icon: '💼', title: 'Mock interview', text: 'Voice behavioral round, then a live coding round with AI code review and a spoken follow-up.' }
    : { type: 'client_call', icon: '📞', title: 'Client call simulation', text: 'Pitch to a skeptical client who pushes back on price, ROI and trust.' }

  useEffect(() => {
    supabase.from('simulations').select('id, simulation_type, score, created_at, high_confidence_wrong_moment_flagged')
      .eq('goal_id', goal.id).not('score', 'is', null).order('created_at', { ascending: false }).limit(8)
      .then(({ data }) => setRecent((data as SimRow[]) ?? []))
  }, [goal.id])

  return (
    <div className="stagger space-y-4">
      <h1 className="font-display text-3xl font-bold">Real-world simulation</h1>
      <p className="text-slate-400 text-sm">Live voice, real-time. The AI will probe your known weak points — best used with headphones in a quiet room.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><div className="text-3xl">{main.icon}</div><h2 className="mt-1 text-lg font-semibold">{main.title}</h2><p className="mb-3 text-sm text-slate-400">{main.text}</p>
          <Link className="btn inline-block" to={`${base}/simulate/${main.type}`}>Start</Link></Card>
        <Card><div className="text-3xl">🧑‍🏫</div><h2 className="mt-1 text-lg font-semibold">Reverse tutor</h2><p className="mb-3 text-sm text-slate-400">Teach a skill you're strong at to a deliberately confused student.</p>
          {strong.length === 0 ? <p className="text-sm text-slate-500">Finish the diagnostic first.</p> : (<div className="flex gap-2">
            <select className="input" value={rtSkill || strong[0].id} onChange={(e) => setRtSkill(e.target.value)}>{strong.map((s) => <option key={s.id} value={s.id}>{s.skill_name} ({Math.round(effective(s.id))})</option>)}</select>
            <Link className="btn" to={`${base}/simulate/reverse_tutor?skill=${rtSkill || strong[0].id}`}>Start</Link></div>)}
        </Card>
      </div>
      <Card title="Recent sessions">
        {recent.length === 0 ? <Empty title="No sessions yet" hint="Your scored sessions and feedback show up here." /> : (
          <ul className="space-y-1">{recent.map((r) => (
            <li key={r.id}><Link className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-slate-800" to={`${base}/simulation/${r.id}`}>
              <span>{LABEL[r.simulation_type]} {r.high_confidence_wrong_moment_flagged && '⚠️'}</span>
              <span className="text-slate-400">{Math.round(r.score!)} · {new Date(r.created_at).toLocaleDateString()}</span></Link></li>
          ))}</ul>
        )}
      </Card>
    </div>
  )
}
