import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Empty, ErrorBox, Spinner } from '../components/ui'
import { weeklyPlanNotes } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { useGoalData } from '../lib/goalData'
import { buildPlan, planToIcs, totalMinutes, type Activity, type PlanDay } from '../lib/plan'
import { READY_THRESHOLD } from '../lib/scoring'
import { supabase } from '../lib/supabase'

const META: Record<Activity, { label: string; icon: string; color: string }> = {
  practice: { label: 'Practice', icon: '⚡', color: 'text-indigo-300' }, review: { label: 'Review', icon: '🔁', color: 'text-sky-300' },
  flashcards: { label: 'Flashcards', icon: '🗂️', color: 'text-amber-300' }, simulate: { label: 'Simulate', icon: '🎙️', color: 'text-pink-300' }, teach: { label: 'Teach-back', icon: '🧑‍🏫', color: 'text-emerald-300' },
}

export default function Plan() {
  const { goal, skills, states, attempts, effective, overall } = useGoalData()
  const { session } = useAuth()
  const [hours, setHours] = useState(5)
  const [startHour, setStartHour] = useState(18)
  const [days, setDays] = useState<PlanDay[] | null>(null)
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const base = `/g/${goal.id}`
  const skillId = useMemo(() => new Map(skills.map((s) => [s.skill_name, s.id])), [skills])

  useEffect(() => { // resume the latest saved plan
    supabase.from('study_plans').select('*').eq('goal_id', goal.id).order('created_at', { ascending: false }).limit(1).then(({ data }) => {
      const p = data?.[0]; if (p) { setDays(p.plan.days); setSummary(p.plan.summary ?? ''); setHours(Number(p.hours_per_week) || 5); setSaved(true) }
    })
  }, [goal.id])

  async function generate() {
    setError(''); setSaved(false); setBusy('Building your week…')
    const flagged = new Set(attempts.filter((a) => a.is_high_confidence_wrong).map((a) => a.skill_id))
    const plan = buildPlan(skills.filter((s) => states.has(s.id)).map((s) => ({ name: s.skill_name, eff: effective(s.id), mastery: states.get(s.id)!.mastery_score, weight: s.weight || 0.5, flagged: flagged.has(s.id) })), hours)
    setDays(plan); setSummary('')
    try { // the schedule works without AI; tips are a bonus
      const flat = plan.flatMap((d) => d.sessions.map((s) => ({ day: d.day, skill: s.skill, activity: s.activity, minutes: s.minutes })))
      setBusy('Adding coaching tips…')
      const r = await weeklyPlanNotes({ goal_title: goal.goal_title, current: Math.round(overall), target: READY_THRESHOLD, sessions: flat })
      let k = 0; setDays(plan.map((d) => ({ ...d, sessions: d.sessions.map((s) => ({ ...s, note: r.notes[k++] })) }))); setSummary(r.summary)
    } catch { /* keep the deterministic plan */ }
    setBusy('')
  }

  async function save() {
    const { error } = await supabase.from('study_plans').insert({ user_id: session!.user.id, goal_id: goal.id, hours_per_week: hours, plan: { days, summary } })
    if (error) setError(error.message); else setSaved(true)
  }
  function exportIcs() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([planToIcs(days!, goal.goal_title, startHour)], { type: 'text/calendar' }))
    a.download = 'learnloop-study-plan.ics'; a.click(); URL.revokeObjectURL(a.href)
  }
  const href = (s: { skill: string; activity: Activity }) =>
    s.activity === 'practice' && skillId.get(s.skill) ? `${base}/practice/${skillId.get(s.skill)}` : s.activity === 'review' ? `${base}/review` : s.activity === 'flashcards' ? `${base}/flashcards` : `${base}/simulate`

  if (!states.size) return <Empty title="Take the diagnostic first" hint="Your plan is built from your weakest skills."><Link className="btn inline-block" to={`${base}/diagnostic`}>Start diagnostic</Link></Empty>
  return (
    <div className="stagger space-y-4">
      <div><h1 className="font-display text-3xl font-bold">Weekly plan</h1><p className="text-sm text-slate-400">Your time, spent where it moves readiness the most. Weak and confidently-wrong skills get the biggest share.</p></div>
      <Card>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label className="block text-sm text-slate-400">Hours per week <b className="font-display text-xl text-slate-100">{hours}</b>
            <input type="range" min={1} max={15} value={hours} onChange={(e) => setHours(+e.target.value)} className="w-full accent-indigo-400" /></label>
          <label className="block text-sm text-slate-400">Usual start time
            <select className="input mt-1" value={startHour} onChange={(e) => setStartHour(+e.target.value)}>{[6, 7, 8, 12, 17, 18, 19, 20, 21].map((h) => <option key={h} value={h}>{h > 12 ? h - 12 : h}:00 {h >= 12 ? 'PM' : 'AM'}</option>)}</select></label>
          <button className="btn" disabled={!!busy} onClick={generate}>{days ? 'Rebuild plan' : 'Build my plan'}</button>
        </div>
        {busy && <div className="mt-3"><Spinner label={busy} /></div>}
      </Card>
      {error && <ErrorBox message={error} />}
      {days && (<>
        {summary && <p className="pop rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-3 text-sm">💡 {summary}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
          <span>{Math.round(totalMinutes(days) / 6) / 10} h planned · {days.filter((d) => d.sessions.length).length} study days</span>
          <span className="flex gap-2"><button className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/10" onClick={exportIcs}>📅 Add to calendar (.ics)</button>
            <button className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/10 disabled:opacity-50" disabled={saved} onClick={save}>{saved ? '✓ Saved' : 'Save plan'}</button></span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {days.map((d) => (
            <div key={d.day} className={`glass rounded-2xl p-3 ${d.sessions.length ? '' : 'opacity-60'}`}>
              <p className="mb-2 flex items-center justify-between font-display font-semibold">{d.day}<span className="text-xs font-normal text-slate-500">{d.sessions.length ? `${d.sessions.reduce((a, s) => a + s.minutes, 0)} min` : 'Rest 😴'}</span></p>
              <div className="space-y-2">{d.sessions.map((s, i) => (
                <Link key={i} to={href(s)} className="lift block rounded-xl border border-white/10 bg-white/[.04] p-2.5">
                  <p className={`text-xs font-semibold ${META[s.activity].color}`}>{META[s.activity].icon} {META[s.activity].label} · {s.minutes}m</p>
                  <p className="text-sm font-medium leading-tight">{s.skill}</p>{s.note && <p className="mt-0.5 text-xs leading-snug text-slate-400">{s.note}</p>}
                </Link>))}</div>
            </div>))}
        </div>
      </>)}
    </div>
  )
}
