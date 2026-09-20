import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ProgressChart from '../components/ProgressChart'
import StreakCard from '../components/StreakCard'
import TransferPanel from '../components/TransferPanel'
import { Card, CountUp, Empty, Gauge } from '../components/ui'
import { ghostBenchmark } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { fireConfetti } from '../lib/confetti'
import { useDueCards, useStreak } from '../lib/useActivity'
import { useGoalData } from '../lib/goalData'
import { masteryColor, READY_THRESHOLD, timeToReady } from '../lib/scoring'

const ACTIONS = [
  ['practice', 'Practice', '🎯'], ['pods', 'Study Pod', '👥'], ['simulate', 'Real-World Simulation', '🎙️'],
  ['resume', 'Resume Check', '📄'], ['proof', 'Proof of Work', '🏅'],
] as const

export default function Dashboard() {
  const { goal, skills, states, attempts, snapshots, effective, overall } = useGoalData()
  const [ghost, setGhost] = useState<{ day: number; score: number }[] | null>(null)
  const base = `/g/${goal.id}`
  const { session } = useAuth()
  const streak = useStreak(session!.user.id, attempts.length)
  const due = useDueCards(session!.user.id, attempts.length)
  const fading = skills.filter((s) => states.has(s.id) && states.get(s.id)!.mastery_score - effective(s.id) >= 3).length

  useEffect(() => { // one-time celebration the first time readiness reaches the threshold
    const key = `ready-celebrated:${goal.id}`
    try { if (overall >= READY_THRESHOLD && !localStorage.getItem(key)) { localStorage.setItem(key, '1'); fireConfetti(220) } } catch { /* ignore */ }
  }, [overall, goal.id])

  useEffect(() => {
    const key = `ghost:${goal.id}`
    try { const c = localStorage.getItem(key); if (c) { setGhost(JSON.parse(c)); return } } catch { /* no cache */ }
    ghostBenchmark({ goal_title: goal.goal_title, level: goal.declared_level ?? 'beginner' })
      .then((r) => { setGhost(r.points); try { localStorage.setItem(key, JSON.stringify(r.points)) } catch { /* ignore */ } })
      .catch(() => { /* benchmark is optional */ })
  }, [goal.id, goal.goal_title, goal.declared_level])

  const ttr = useMemo(() => timeToReady(snapshots, overall), [snapshots, overall])
  const skillName = useMemo(() => new Map(skills.map((s) => [s.id, s.skill_name])), [skills])
  const flags = attempts.filter((a) => a.is_high_confidence_wrong).slice(0, 5)

  if (!states.size) return <Empty title="No diagnostic yet" hint="Take the adaptive diagnostic to build your skill map."><Link className="btn inline-block" to={`${base}/diagnostic`}>Start diagnostic</Link></Empty>

  return (
    <div className="stagger space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Readiness" className="sm:col-span-1">
          <div className="flex items-center justify-center gap-4">
            <Gauge value={overall} max={READY_THRESHOLD}>
              <div><p className="font-display text-4xl font-bold leading-none"><CountUp value={overall} /></p><p className="text-[11px] text-slate-500">of {READY_THRESHOLD}</p></div>
            </Gauge>
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">Weighted mastery, decay applied</p>
        </Card>
        <Card title="Time to ready" className="sm:col-span-2">
          {ttr.kind === 'ready' && <p className="pop text-3xl font-bold text-emerald-400">You're ready for {goal.goal_title} 🎉</p>}
          {ttr.kind === 'eta' && (<>
            <p className="gradient-text font-display text-5xl font-bold">~<CountUp value={ttr.days} /> day{ttr.days === 1 ? '' : 's'}</p>
            <p className="text-sm text-slate-400">Linear projection to {READY_THRESHOLD}: readiness is rising ~{ttr.slope.toFixed(1)} pts/day across {snapshots.length} snapshots.</p>
          </>)}
          {ttr.kind === 'insufficient' && (<><p className="text-xl font-semibold text-slate-300">Not enough data yet</p><p className="text-sm text-slate-400">{ttr.reason}</p></>)}
        </Card>
      </div>

      <StreakCard streak={streak} due={due} fading={fading} base={base} />

      <Card title="Skill heatmap">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {skills.map((s, i) => {
            const st = states.get(s.id), eff = effective(s.id)
            const decayed = st ? st.mastery_score - eff : 0
            const flagged = flags.some((f) => f.skill_id === s.id)
            return (
              <Link key={s.id} to={`${base}/practice/${s.id}`} className="tile tile-in relative rounded-2xl p-3.5"
                style={{ background: st ? masteryColor(eff) : '#1e293b', animationDelay: `${i * 60}ms`, opacity: st ? 0.6 + Math.min(eff, 100) / 250 : 1 }}>
                {flagged && <span title="High-confidence wrong answer" className="absolute right-2 top-2">⚠️</span>}
                <p className="pr-5 font-medium leading-tight">{s.skill_name}</p>
                {st ? (<>
                  <p className="mt-1 font-display text-3xl font-bold"><CountUp value={eff} /></p>
                  <p className="text-xs opacity-80"><span className="capitalize">{st.current_level}</span>{decayed >= 1 && <> · ↓{Math.round(decayed)} decay</>}</p>
                </>) : <p className="mt-1 text-sm text-slate-400">Not tested</p>}
              </Link>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Colors fade as unused skills decay — practice a tile to restore it.</p>
      </Card>

      {flags.length > 0 && (
        <Card title="⚠️ High-confidence wrong" className="!border-amber-500/40 !bg-amber-500/[.06]">
          <ul className="space-y-2 text-sm">
            {flags.map((f) => (
              <li key={f.id}><span className="font-medium text-amber-300">{skillName.get(f.skill_id)}</span> — you were {f.confidence_rating}/5 sure and wrong:
                <span className="text-slate-400"> “{f.question_text}”</span></li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Confident misconceptions cost the most in real interviews. The simulator will probe these live.</p>
        </Card>
      )}

      <Card title="Progress vs. benchmark">
        <ProgressChart snapshots={snapshots} current={overall} ghost={ghost} />
        <p className="text-xs text-slate-500"><span className="text-indigo-400">━</span> You · <span className="text-slate-400">╍</span> Ghost competitor (a simulated, illustrative benchmark for a similar learner — not real user data) · green line = ready at {READY_THRESHOLD}</p>
      </Card>

      <TransferPanel goalId={goal.id} goalTitle={goal.goal_title} skills={skills.map((s) => s.skill_name)} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ACTIONS.map(([to, label, icon]) => (
          <Link key={to} to={`${base}/${to}`} className="glass lift rounded-2xl p-3 text-center text-sm">
            <div className="text-2xl">{icon}</div>{label}
          </Link>
        ))}
      </div>
    </div>
  )
}
