import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuestionFlow, { type QuestionResult } from '../components/QuestionFlow'
import { ErrorBox, Spinner } from '../components/ui'
import { nextQuestion } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { addFlashcard } from '../lib/flashcards'
import { useGoalData } from '../lib/goalData'
import { diagnosticResult, isSettled, nextDifficulty, type DiagStep } from '../lib/scoring'
import { supabase } from '../lib/supabase'
import type { Level, Question, Skill } from '../lib/types'

/** Adaptive diagnostic: per-skill loop; difficulty moves with correctness x confidence until the level settles. */
export default function Diagnostic() {
  const { goal, skills, states, reload, snapshot } = useGoalData()
  const { session } = useAuth()
  const nav = useNavigate()
  const todo = useRef(skills.filter((s) => !states.has(s.id))).current // resume-safe: skip already-diagnosed skills
  const start: Level = goal.declared_level ?? 'beginner'
  const [idx, setIdx] = useState(0)
  const [steps, setSteps] = useState<DiagStep[]>([])
  const [difficulty, setDifficulty] = useState<Level>(start)
  const [asked, setAsked] = useState<string[]>([])
  const [q, setQ] = useState<Question | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const started = useRef(false)

  async function load(skill: Skill, diff: Level, hist: DiagStep[], askedQs: string[]) {
    setQ(null); setError('')
    try {
      setQ(await nextQuestion({ goal_title: goal.goal_title, skill_name: skill.skill_name, difficulty: diff, history: hist.slice(-2), asked: askedQs }))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not generate a question') }
  }

  useEffect(() => {
    if (!todo.length) { nav(`/g/${goal.id}/dashboard`, { replace: true }); return }
    if (started.current) return
    started.current = true
    load(todo[0], start, [], [])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!todo.length) return null
  const skill = todo[idx]

  async function answered(r: QuestionResult) {
    if (!q) return
    setSaving(true)
    const { error: aErr } = await supabase.from('attempts').insert({
      user_id: session!.user.id, skill_id: skill.id, question_text: q.question, answer_given: q.options[r.selected],
      correct: r.correct, confidence_rating: r.confidence, error_type: r.errorType, difficulty,
    })
    if (aErr) { setError(aErr.message); setSaving(false); return }
    if (!r.correct) void addFlashcard(session!.user.id, skill.id, q.question, q.options[q.correct_index], q.options[r.selected])
    const newSteps = [...steps, { difficulty, correct: r.correct, confidence: r.confidence }]
    const newAsked = [...asked, q.question]

    if (isSettled(newSteps)) {
      const { level, mastery } = diagnosticResult(newSteps)
      const { error: sErr } = await supabase.from('skill_states').upsert({
        user_id: session!.user.id, skill_id: skill.id, current_level: level, mastery_score: mastery,
        last_practiced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,skill_id' })
      if (sErr) { setError(sErr.message); setSaving(false); return }
      if (idx === todo.length - 1) {
        await snapshot(); await reload()
        nav(`/g/${goal.id}/dashboard`, { replace: true }); return
      }
      setIdx(idx + 1); setSteps([]); setAsked([]); setDifficulty(start); setSaving(false)
      load(todo[idx + 1], start, [], [])
    } else {
      const nd = nextDifficulty(difficulty, r)
      setSteps(newSteps); setAsked(newAsked); setDifficulty(nd); setSaving(false)
      load(skill, nd, newSteps, newAsked)
    }
  }

  return (
    <div className="stagger mx-auto max-w-xl space-y-4">
      <div>
        <p className="text-sm text-slate-400">Skill {idx + 1} of {todo.length}</p>
        <h1 className="font-display text-3xl font-bold">{skill.skill_name}</h1>
        <div className="mt-2 h-1.5 rounded bg-white/10"><div className="bar h-full rounded bg-gradient-to-r from-indigo-500 to-pink-400 transition-all" style={{ width: `${((idx + steps.length / 5) / todo.length) * 100}%` }} /></div>
      </div>
      {error && <ErrorBox message={error} onRetry={() => load(skill, difficulty, steps, asked)} />}
      {saving ? <Spinner label="Saving…" /> : q ? <QuestionFlow key={q.question} q={q} onDone={answered} /> : !error && <Spinner label="Writing your next question…" />}
    </div>
  )
}
