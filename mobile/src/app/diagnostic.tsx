import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { QuestionFlow, type QuestionResult } from '@/components/QuestionFlow'
import { Alert, View } from 'react-native'
import { BackButton, Bar, ErrorBox, Rise, Screen, Spinner, T } from '@/components/ui'
import { nextQuestion } from '@/lib/ai'
import { useApp } from '@/lib/auth'
import { addFlashcard } from '@/lib/flashcards'
import { useGoalData } from '@/lib/goalData'
import { diagnosticResult, isSettled, nextDifficulty, type DiagStep } from '@/lib/scoring'
import { supabase } from '@/lib/supabase'
import type { Level, Question, Skill } from '@/lib/types'

/** Adaptive diagnostic: per-skill loop; difficulty moves with correctness x confidence until the level settles. */
export default function Diagnostic() {
  const { goal, skills, states, reload, snapshot } = useGoalData()
  const { session } = useApp()
  const router = useRouter()
  const todo = useRef(skills.filter((s) => !states.has(s.id))).current
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
    try { setQ(await nextQuestion({ goal_title: goal.goal_title, skill_name: skill.skill_name, difficulty: diff, history: hist.slice(-2), asked: askedQs })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not generate a question') }
  }

  useEffect(() => {
    if (!todo.length) { router.replace('/'); return }
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
    if (isSettled(newSteps)) {
      const { level, mastery } = diagnosticResult(newSteps)
      const now = new Date().toISOString()
      const { error: sErr } = await supabase.from('skill_states').upsert({ user_id: session!.user.id, skill_id: skill.id, current_level: level, mastery_score: mastery, last_practiced_at: now, updated_at: now }, { onConflict: 'user_id,skill_id' })
      if (sErr) { setError(sErr.message); setSaving(false); return }
      if (idx === todo.length - 1) { await snapshot(); await reload(); router.replace('/'); return }
      setIdx(idx + 1); setSteps([]); setAsked([]); setDifficulty(start); setSaving(false)
      load(todo[idx + 1], start, [], [])
    } else {
      const nd = nextDifficulty(difficulty, r), na = [...asked, q.question]
      setSteps(newSteps); setAsked(na); setDifficulty(nd); setSaving(false)
      load(skill, nd, newSteps, na)
    }
  }

  return (
    <Screen>
      <BackButton label="Leave diagnostic" onPress={() => Alert.alert('Leave the diagnostic?', 'Skills you have finished are saved. You can resume any time.', [
        { text: 'Keep going', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) },
      ])} />
      <Rise style={{ gap: 8, marginTop: 4 }}>
        <T v="label">Skill {idx + 1} of {todo.length}</T><T v="h1">{skill.skill_name}</T>
        <Bar value={idx + steps.length / 5} max={todo.length} />
      </Rise>
      {!!error && <ErrorBox message={error} onRetry={() => load(skill, difficulty, steps, asked)} />}
      {saving ? <Spinner label="Saving…" /> : q ? <View key={q.question}><QuestionFlow q={q} onDone={answered} /></View> : !error && <Spinner label="Writing your next question…" />}
    </Screen>
  )
}
