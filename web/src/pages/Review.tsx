import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QuestionFlow, { type QuestionResult } from '../components/QuestionFlow'
import { Card, CountUp, Empty, ErrorBox, Spinner } from '../components/ui'
import { nextQuestion } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { fireConfetti } from '../lib/confetti'
import { addFlashcard } from '../lib/flashcards'
import { useGoalData } from '../lib/goalData'
import { clamp, levelFromMastery, masteryColor, practiceDelta } from '../lib/scoring'
import { supabase } from '../lib/supabase'
import type { Question, Skill } from '../lib/types'

/** Review queue: the skills that have decayed the most get one fresh question each, restoring (and committing) their score. */
export default function Review() {
  const { goal, skills, states, effective, reload, snapshot } = useGoalData()
  const { session } = useAuth()
  const uid = session!.user.id
  const queue = useRef<{ skill: Skill; before: number }[] | null>(null)
  if (queue.current === null) {
    queue.current = skills.filter((s) => states.has(s.id))
      .map((s) => ({ skill: s, before: effective(s.id), loss: states.get(s.id)!.mastery_score - effective(s.id) }))
      .filter((x) => x.loss >= 3).sort((a, b) => b.loss - a.loss).slice(0, 3).map(({ skill, before }) => ({ skill, before }))
  }
  const items = queue.current
  const [i, setI] = useState(0)
  const [q, setQ] = useState<Question | null>(null)
  const [error, setError] = useState('')
  const [results, setResults] = useState<{ skill: string; correct: boolean; before: number; after: number }[]>([])
  const [saving, setSaving] = useState(false)
  const started = useRef(false)

  async function load(idx: number) {
    setQ(null); setError('')
    const s = items[idx].skill
    try { setQ(await nextQuestion({ goal_title: goal.goal_title, skill_name: s.skill_name, difficulty: states.get(s.id)!.current_level, history: [], asked: [] })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not generate a question') }
  }
  useEffect(() => { if (items.length && !started.current) { started.current = true; load(0) } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const done = results.length === items.length && items.length > 0
  const gained = useMemo(() => results.reduce((a, r) => a + (r.after - r.before), 0), [results])

  async function answered(r: QuestionResult) {
    if (!q) return
    setSaving(true)
    const { skill, before } = items[i]
    const st = states.get(skill.id)!
    await supabase.from('attempts').insert({ user_id: uid, skill_id: skill.id, question_text: q.question, answer_given: q.options[r.selected], correct: r.correct, confidence_rating: r.confidence, error_type: r.errorType, difficulty: st.current_level })
    if (!r.correct) await addFlashcard(uid, skill.id, q.question, q.options[q.correct_index], q.options[r.selected])
    // Re-practicing commits the decayed score, then adds the usual delta.
    const after = clamp(before + practiceDelta(r.correct, st.current_level) + (r.correct ? 2 : 0))
    const now = new Date().toISOString()
    const { error: e } = await supabase.from('skill_states').upsert({ user_id: uid, skill_id: skill.id, current_level: levelFromMastery(after), mastery_score: after, last_practiced_at: now, updated_at: now }, { onConflict: 'user_id,skill_id' })
    if (e) { setError(e.message); setSaving(false); return }
    const next = [...results, { skill: skill.skill_name, correct: r.correct, before, after }]
    setResults(next); setSaving(false)
    if (next.length === items.length) { await snapshot(); await reload(); if (next.some((x) => x.correct)) fireConfetti(80) }
    else { setI(i + 1); load(i + 1) }
  }

  if (!states.size) return <Empty title="Take the diagnostic first" hint="Review targets skills that fade over time."><Link className="btn inline-block" to={`/g/${goal.id}/diagnostic`}>Start diagnostic</Link></Empty>
  if (!items.length) return <Empty title="Everything is fresh ✨" hint="No skills have faded enough to need a review. Nice work — try flashcards or a simulation instead."><Link className="btn inline-block" to={`/g/${goal.id}/flashcards`}>Open flashcards</Link></Empty>

  return (
    <div className="stagger mx-auto max-w-xl space-y-4">
      <div><h1 className="font-display text-3xl font-bold">Review queue</h1>
        <p className="text-sm text-slate-400">{items.length} skill{items.length > 1 ? 's are' : ' is'} fading. One quick question each restores them.</p></div>
      <div className="flex gap-2">{items.map((it, n) => (
        <div key={it.skill.id} className={`flex-1 rounded-2xl border p-3 transition-all ${n === i && !done ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-white/10 bg-white/[.03]'}`}>
          <p className="truncate text-xs text-slate-400">{it.skill.skill_name}</p>
          <p className="font-display text-xl font-bold" style={{ color: masteryColor(results[n]?.after ?? it.before) }}>{Math.round(results[n]?.after ?? it.before)}</p>
        </div>))}</div>
      {error && <ErrorBox message={error} onRetry={() => load(i)} />}
      {done ? (
        <Card title="Review complete" className="text-center">
          <p className="pop font-display text-5xl font-bold text-emerald-400">+<CountUp value={Math.max(0, gained)} /></p>
          <p className="text-sm text-slate-400">readiness points restored across {items.length} skills · {results.filter((r) => r.correct).length}/{results.length} correct</p>
          {results.some((r) => !r.correct) && <p className="mt-2 text-sm text-amber-300">Missed questions were added to your flashcards.</p>}
          <div className="mt-4 flex justify-center gap-2"><Link className="btn" to={`/g/${goal.id}/dashboard`}>Dashboard</Link><Link className="rounded-xl border border-white/15 px-4 py-2" to={`/g/${goal.id}/flashcards`}>Flashcards</Link></div>
        </Card>
      ) : (
        <Card title={`${items[i].skill.skill_name} · question ${i + 1} of ${items.length}`}>
          {saving ? <Spinner label="Saving…" /> : q ? <QuestionFlow key={q.question} q={q} onDone={answered} /> : !error && <Spinner label="Writing your question…" />}
        </Card>
      )}
    </div>
  )
}
