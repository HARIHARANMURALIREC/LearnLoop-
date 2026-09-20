import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { Confetti } from '@/components/Confetti'
import { QuestionFlow, type QuestionResult } from '@/components/QuestionFlow'
import { BackButton, Button, Card, CountUp, Empty, ErrorBox, Rise, Screen, Spinner, T } from '@/components/ui'
import { nextQuestion } from '@/lib/ai'
import { useApp } from '@/lib/auth'
import { addFlashcard } from '@/lib/flashcards'
import { useGoalData } from '@/lib/goalData'
import { clamp, levelFromMastery, practiceDelta } from '@/lib/scoring'
import { supabase } from '@/lib/supabase'
import { C, F, masteryColor } from '@/lib/theme'
import type { Question, Skill } from '@/lib/types'

/** Review queue: the most-faded skills get one fresh question each, restoring (and committing) their score. */
export default function Review() {
  const { goal, skills, states, effective, reload, snapshot } = useGoalData()
  const { session } = useApp()
  const router = useRouter()
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
  const [results, setResults] = useState<{ correct: boolean; before: number; after: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [burst, setBurst] = useState(0)
  const started = useRef(false)

  async function load(idx: number) {
    setQ(null); setError('')
    const s = items[idx].skill
    try { setQ(await nextQuestion({ goal_title: goal.goal_title, skill_name: s.skill_name, difficulty: states.get(s.id)!.current_level, history: [], asked: [] })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not generate a question') }
  }
  useEffect(() => { if (items.length && !started.current) { started.current = true; load(0) } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const done = items.length > 0 && results.length === items.length
  const gained = results.reduce((a, r) => a + (r.after - r.before), 0)

  async function answered(r: QuestionResult) {
    if (!q) return
    setSaving(true)
    const { skill, before } = items[i]
    const st = states.get(skill.id)!
    await supabase.from('attempts').insert({ user_id: uid, skill_id: skill.id, question_text: q.question, answer_given: q.options[r.selected], correct: r.correct, confidence_rating: r.confidence, error_type: r.errorType, difficulty: st.current_level })
    if (!r.correct) await addFlashcard(uid, skill.id, q.question, q.options[q.correct_index], q.options[r.selected])
    const after = clamp(before + practiceDelta(r.correct, st.current_level) + (r.correct ? 2 : 0))
    const now = new Date().toISOString()
    const { error: e } = await supabase.from('skill_states').upsert({ user_id: uid, skill_id: skill.id, current_level: levelFromMastery(after), mastery_score: after, last_practiced_at: now, updated_at: now }, { onConflict: 'user_id,skill_id' })
    if (e) { setError(e.message); setSaving(false); return }
    const next = [...results, { correct: r.correct, before, after }]
    setResults(next); setSaving(false)
    if (next.length === items.length) { await snapshot(); await reload(); if (next.some((x) => x.correct)) { setBurst((b) => b + 1); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) } }
    else { setI(i + 1); load(i + 1) }
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <BackButton />
        <Rise><T v="h1">Review queue</T><T v="muted">The skills that faded the most get one quick question each.</T></Rise>
        {!items.length ? <Empty title="Everything is fresh ✨" hint="No skills have faded enough to review. Try flashcards or a simulation." />
        : <>
          <View style={{ flexDirection: 'row', gap: 8 }}>{items.map((it, n) => (
            <View key={it.skill.id} style={{ flex: 1, borderRadius: 16, borderWidth: 1, padding: 10, borderColor: n === i && !done ? C.primarySoft : C.border, backgroundColor: n === i && !done ? 'rgba(124,92,255,0.12)' : 'rgba(255,255,255,0.04)' }}>
              <T v="small" numberOfLines={1}>{it.skill.skill_name}</T><T style={{ fontFamily: F.display, fontSize: 22, color: masteryColor(results[n]?.after ?? it.before) }}>{Math.round(results[n]?.after ?? it.before)}</T></View>))}</View>
          {!!error && <ErrorBox message={error} onRetry={() => load(i)} />}
          {done ? (
            <Card style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}><T style={{ fontFamily: F.display, fontSize: 44, color: C.green }}>+</T><CountUp value={Math.max(0, gained)} style={{ fontFamily: F.display, fontSize: 56, color: C.green }} /></View>
              <T v="muted" style={{ textAlign: 'center' }}>readiness points restored · {results.filter((r) => r.correct).length}/{results.length} correct</T>
              {results.some((r) => !r.correct) && <T v="small" style={{ color: C.amber }}>Missed questions were added to your flashcards.</T>}
              <Button label="Done" onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 8 }} />
            </Card>
          ) : (
            <Card title={`${items[i].skill.skill_name} · ${i + 1} of ${items.length}`}>
              {saving ? <Spinner label="Saving…" /> : q ? <View key={q.question}><QuestionFlow q={q} onDone={answered} /></View> : !error && <Spinner label="Writing your question…" />}
            </Card>
          )}
        </>}
      </Screen>
      <Confetti burst={burst} />
    </View>
  )
}
