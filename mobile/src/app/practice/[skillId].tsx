import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated'
import { QuestionFlow, type QuestionResult } from '@/components/QuestionFlow'
import { ResourcesCard } from '@/components/ResourcesCard'
import { BackButton, Button, Card, CountUp, ErrorBox, Input, Rise, Screen, Spinner, T } from '@/components/ui'
import { explain, feynman, nextQuestion } from '@/lib/ai'
import { Confetti } from '@/components/Confetti'
import { useApp } from '@/lib/auth'
import { addFlashcard } from '@/lib/flashcards'
import { useGoalData } from '@/lib/goalData'
import { clamp, levelFromMastery, nextDifficulty, practiceDelta, type DiagStep } from '@/lib/scoring'
import { supabase } from '@/lib/supabase'
import { C, F } from '@/lib/theme'
import type { Level, Question, Style } from '@/lib/types'

const STYLES: { key: Style; label: string; blurb: string }[] = [
  { key: 'analogy', label: 'Analogy', blurb: 'Understand it through a familiar comparison' },
  { key: 'step_by_step', label: 'Step by step', blurb: 'Numbered steps with a worked example' },
  { key: 'visual', label: 'Visual', blurb: 'Diagrams and structured layouts' },
]
const QUIZ_LEN = 3
type Step = 'style' | 'explain' | 'quiz' | 'done'

export default function PracticeSession() {
  const { skillId } = useLocalSearchParams<{ skillId: string }>()
  const { goal, skills, states, effective, attempts, reload, snapshot } = useGoalData()
  const { session } = useApp()
  const router = useRouter()
  const skill = skills.find((s) => s.id === skillId)!
  const uid = session!.user.id
  const startLevel: Level = states.get(skill.id)?.current_level ?? goal.declared_level ?? 'beginner'
  // Relearning starts from the decayed score, so committing practice also commits the decay.
  const baseMastery = useRef(effective(skill.id)).current

  const [step, setStep] = useState<Step>('style')
  const [style, setStyle] = useState<Style>('analogy')
  const [suggested, setSuggested] = useState<Style | null>(null)
  const [text, setText] = useState('')
  const [explainBack, setExplainBack] = useState('')
  const [fb, setFb] = useState<{ passed: boolean; feedback: string } | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [q, setQ] = useState<Question | null>(null)
  const [difficulty, setDifficulty] = useState<Level>(startLevel)
  const [steps, setSteps] = useState<DiagStep[]>([])
  const [asked, setAsked] = useState<string[]>([])
  const [summary, setSummary] = useState<{ after: number; correct: number; level: Level } | null>(null)
  const passed = useRef(false)
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    supabase.from('explanations').select('style').eq('user_id', uid).eq('passed_feynman_check', true).then(({ data }) => {
      const counts: Record<string, number> = {}
      data?.forEach((r) => { counts[r.style] = (counts[r.style] ?? 0) + 1 })
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as Style | undefined
      if (best) { setSuggested(best); setStyle(best) }
    })
  }, [uid])

  if (!skill) return <Screen><ErrorBox message="Skill not found." /></Screen>

  async function getExplanation(s: Style) {
    setStyle(s); setBusy('Writing your explanation…'); setError(''); setFb(null); setExplainBack('')
    const gaps = attempts.filter((a) => a.skill_id === skill.id && !a.correct).slice(0, 2).map((a) => a.question_text)
    try {
      const r = await explain({ goal_title: goal.goal_title, skill_name: skill.skill_name, style: s, level: startLevel, gap: gaps.length ? `The learner got these wrong: ${gaps.join(' | ')}` : `General understanding of ${skill.skill_name}` })
      setText(r.explanation); setStep('explain')
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to generate explanation') }
    setBusy('')
  }

  async function checkExplainBack() {
    setBusy('Checking your explanation…'); setError('')
    try {
      const r = await feynman({ skill_name: skill.skill_name, explanation: text, user_text: explainBack })
      setFb(r); passed.current = r.passed
      await supabase.from('explanations').insert({ user_id: uid, skill_id: skill.id, style, explanation_text: text, user_explained_back: explainBack, passed_feynman_check: r.passed })
    } catch (e) { setError(e instanceof Error ? e.message : 'Check failed') }
    setBusy('')
  }

  async function loadQ(diff: Level, hist: DiagStep[], askedQs: string[]) {
    setQ(null); setError('')
    try { setQ(await nextQuestion({ goal_title: goal.goal_title, skill_name: skill.skill_name, difficulty: diff, history: hist.slice(-2), asked: askedQs })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not generate a question') }
  }

  async function answered(r: QuestionResult) {
    if (!q) return
    setBusy('Saving…')
    const { error: aErr } = await supabase.from('attempts').insert({ user_id: uid, skill_id: skill.id, question_text: q.question, answer_given: q.options[r.selected], correct: r.correct, confidence_rating: r.confidence, error_type: r.errorType, difficulty })
    if (aErr) { setError(aErr.message); setBusy(''); return }
    if (!r.correct) void addFlashcard(uid, skill.id, q.question, q.options[q.correct_index], q.options[r.selected])
    const ns = [...steps, { difficulty, correct: r.correct, confidence: r.confidence }]
    setSteps(ns); setBusy('')
    if (ns.length < QUIZ_LEN) { const nd = nextDifficulty(difficulty, r), na = [...asked, q.question]; setDifficulty(nd); setAsked(na); loadQ(nd, ns, na) }
    else finish(ns)
  }

  async function finish(ns: DiagStep[]) {
    setBusy('Updating your skill…')
    const correct = ns.filter((s) => s.correct).length
    const after = clamp(baseMastery + ns.reduce((a, s) => a + practiceDelta(s.correct, s.difficulty), 0) + (passed.current ? 4 : 0))
    const level = levelFromMastery(after), now = new Date().toISOString()
    const { error: sErr } = await supabase.from('skill_states').upsert({ user_id: uid, skill_id: skill.id, current_level: level, mastery_score: after, last_practiced_at: now, updated_at: now }, { onConflict: 'user_id,skill_id' })
    if (sErr) { setError(sErr.message); setBusy(''); return }
    if (passed.current || correct >= 2) {
      await supabase.from('proof_ledger').insert({ user_id: uid, skill_id: skill.id, proof_type: passed.current ? 'explain_back_passed' : 'practice',
        evidence_summary: `${passed.current ? `Explained "${skill.skill_name}" back correctly (${style.replace('_', ' ')} style) and a` : 'A'}nswered ${correct}/${ns.length} confirmation questions; mastery ${Math.round(baseMastery)} → ${Math.round(after)} (${level}).` })
    }
    await snapshot(); await reload()
    setSummary({ after, correct, level }); setStep('done'); setBusy('')
    if ((level !== startLevel && after > baseMastery) || passed.current || correct === ns.length) { setBurst((b) => b + 1); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) }
  }

  return (
    <View style={{ flex: 1 }}>
    <Screen>
      <Rise style={{ marginTop: 8, gap: 8 }}>
        <BackButton />
        <T v="h1">{skill.skill_name}</T><T v="small" style={{ textTransform: 'capitalize' }}>{startLevel} · mastery {Math.round(baseMastery)}</T>
      </Rise>
      {!!error && <ErrorBox message={error} />}

      {step === 'style' && <Rise i={1}><Card title="How do you want it explained?">
        {STYLES.map((s) => (
          <Pressable key={s.key} disabled={!!busy} onPress={() => getExplanation(s.key)} style={({ pressed }) => ({ borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 2, opacity: busy ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }],
            borderColor: suggested === s.key ? C.primarySoft : C.border, backgroundColor: 'rgba(255,255,255,0.04)' })}>
            <T v="title">{s.label}{suggested === s.key && <T v="small" style={{ color: C.primarySoft }}>  suggested for you</T>}</T><T v="muted">{s.blurb}</T>
          </Pressable>
        ))}
        {!!busy && <Spinner label={busy} />}
      </Card></Rise>}

      {(step === 'style' || step === 'done') && (
        <Rise i={2}><ResourcesCard skillId={skill.id} goalTitle={goal.goal_title} skillName={skill.skill_name} level={step === 'done' && summary ? summary.level : startLevel}
          gap={attempts.filter((a) => a.skill_id === skill.id && !a.correct).slice(0, 2).map((a) => a.question_text).join(' | ') || undefined} /></Rise>
      )}

      {step === 'explain' && <>
        <Rise i={1}><Card title={`Explanation · ${style.replace('_', ' ')}`}><T v="body">{text}</T>
          <Pressable onPress={() => setStep('style')}><T v="small" style={{ color: C.primarySoft }}>Try a different style</T></Pressable></Card></Rise>
        <Rise i={2}><Card title="Now explain it back to me">
          <Input multiline placeholder="In your own words, without looking…" value={explainBack} onChangeText={setExplainBack} editable={!fb?.passed} style={{ minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }} />
          <Button label="Check my explanation" loading={!!busy} disabled={explainBack.trim().length < 15 || !!fb?.passed} onPress={checkExplainBack} />
          {fb && <Animated.View entering={ZoomIn.springify()} style={{ borderRadius: 14, borderWidth: 1, padding: 12, gap: 4,
            borderColor: fb.passed ? 'rgba(52,211,153,0.5)' : 'rgba(251,191,36,0.5)', backgroundColor: fb.passed ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)' }}>
            <T v="title">{fb.passed ? '✓ That holds up' : 'Needs work'}</T><T v="muted">{fb.feedback}</T></Animated.View>}
          {fb && <Button label={fb.passed ? 'Continue to questions' : 'Continue anyway'} onPress={() => { setStep('quiz'); loadQ(startLevel, [], []) }} />}
        </Card></Rise>
      </>}

      {step === 'quiz' && <Card title={`Question ${Math.min(steps.length + 1, QUIZ_LEN)} of ${QUIZ_LEN}`}>
        {busy ? <Spinner label={busy} /> : q ? <View key={q.question}><QuestionFlow q={q} onDone={answered} /></View> : !error && <Spinner label="Writing your next question…" />}
        {!!error && <Pressable onPress={() => loadQ(difficulty, steps, asked)}><T v="title" style={{ color: C.primarySoft }}>Retry</T></Pressable>}
      </Card>}

      {step === 'done' && summary && <Animated.View entering={FadeInDown.springify()}><Card title="Session complete" style={{ alignItems: 'center', gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <T v="h2" style={{ color: C.muted }}>{Math.round(baseMastery)} →</T>
          <CountUp value={summary.after} style={{ fontFamily: F.display, fontSize: 56, color: summary.after >= baseMastery ? C.green : C.amber }} /></View>
        <T v="muted">{summary.correct}/{QUIZ_LEN} correct · now {summary.level}{passed.current ? ' · explain-back passed, logged to Proof of Work' : ''}</T>
        <Button label="Back to dashboard" onPress={() => router.dismissAll()} style={{ alignSelf: 'stretch', marginTop: 8 }} />
      </Card></Animated.View>}
    </Screen>
    <Confetti burst={burst} count={100} />
    </View>
  )
}
