import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import MicButton from '../components/MicButton'
import QuestionFlow, { type QuestionResult } from '../components/QuestionFlow'
import ResourcesCard from '../components/ResourcesCard'
import { Card, Empty, ErrorBox, Spinner } from '../components/ui'
import { explain, feynman, nextQuestion } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { fireConfetti } from '../lib/confetti'
import { addFlashcard } from '../lib/flashcards'
import { useGoalData } from '../lib/goalData'
import { clamp, levelFromMastery, masteryColor, nextDifficulty, practiceDelta, type DiagStep } from '../lib/scoring'
import { supabase } from '../lib/supabase'
import type { Level, Question, Skill, Style } from '../lib/types'

const STYLES: { key: Style; label: string; blurb: string }[] = [
  { key: 'analogy', label: 'Analogy', blurb: 'Understand it through a familiar comparison' },
  { key: 'step_by_step', label: 'Step by step', blurb: 'Numbered steps with a worked example' },
  { key: 'visual', label: 'Visual', blurb: 'Diagrams and structured layouts' },
]
const QUIZ_LEN = 3

export default function Practice() {
  const { skillId } = useParams()
  const { skills } = useGoalData()
  const skill = skills.find((s) => s.id === skillId)
  return skill ? <PracticeSession key={skill.id} skill={skill} /> : <SkillPicker />
}

function SkillPicker() {
  const { goal, skills, states, effective, attempts } = useGoalData()
  const sorted = [...skills].sort((a, b) => effective(a.id) - effective(b.id))
  const flagged = new Set(attempts.filter((a) => a.is_high_confidence_wrong).map((a) => a.skill_id))
  if (!states.size) return <Empty title="Take the diagnostic first" hint="Practice targets your weakest skills."><Link className="btn inline-block" to={`/g/${goal.id}/diagnostic`}>Start diagnostic</Link></Empty>
  return (
    <div className="stagger space-y-3">
      <h1 className="font-display text-3xl font-bold">Pick a skill to practice</h1>
      <p className="text-slate-400 text-sm">Weakest first.</p>
      {sorted.map((s) => (
        <Link key={s.id} to={s.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] p-3 lift">
          <span>{s.skill_name} {flagged.has(s.id) && <span title="High-confidence wrong">⚠️</span>}</span>
          <span className="rounded px-2 py-0.5 text-sm font-semibold" style={{ background: states.has(s.id) ? masteryColor(effective(s.id)) : '#1e293b' }}>
            {states.has(s.id) ? Math.round(effective(s.id)) : 'new'}
          </span>
        </Link>
      ))}
    </div>
  )
}

type Step = 'style' | 'explain' | 'quiz' | 'done'

function PracticeSession({ skill }: { skill: Skill }) {
  const { goal, states, effective, attempts, reload, snapshot } = useGoalData()
  const { session } = useAuth()
  const uid = session!.user.id
  const state = states.get(skill.id)
  const startLevel: Level = state?.current_level ?? goal.declared_level ?? 'beginner'
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
  const [summary, setSummary] = useState<{ before: number; after: number; correct: number; level: Level } | null>(null)
  const feynmanPassed = useRef(false)

  // Suggest the style that has worked for this learner before.
  useEffect(() => {
    supabase.from('explanations').select('style').eq('user_id', uid).eq('passed_feynman_check', true).then(({ data }) => {
      const counts: Record<string, number> = {}
      data?.forEach((r) => { counts[r.style] = (counts[r.style] ?? 0) + 1 })
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as Style | undefined
      if (best) { setSuggested(best); setStyle(best) }
    })
  }, [uid])

  async function getExplanation(s: Style) {
    setStyle(s); setBusy('Writing your explanation…'); setError(''); setFb(null); setExplainBack('')
    const gaps = attempts.filter((a) => a.skill_id === skill.id && !a.correct).slice(0, 2).map((a) => a.question_text)
    try {
      const r = await explain({
        goal_title: goal.goal_title, skill_name: skill.skill_name, style: s, level: startLevel,
        gap: gaps.length ? `The learner got these wrong: ${gaps.join(' | ')}` : `General understanding of ${skill.skill_name}`,
      })
      setText(r.explanation); setStep('explain')
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to generate explanation') }
    setBusy('')
  }

  async function checkExplainBack() {
    setBusy('Checking your explanation…'); setError('')
    try {
      const r = await feynman({ skill_name: skill.skill_name, explanation: text, user_text: explainBack })
      setFb(r); feynmanPassed.current = r.passed
      await supabase.from('explanations').insert({
        user_id: uid, skill_id: skill.id, style, explanation_text: text, user_explained_back: explainBack, passed_feynman_check: r.passed,
      })
    } catch (e) { setError(e instanceof Error ? e.message : 'Check failed') }
    setBusy('')
  }

  async function loadQ(diff: Level, hist: DiagStep[], askedQs: string[]) {
    setQ(null); setError('')
    try {
      setQ(await nextQuestion({ goal_title: goal.goal_title, skill_name: skill.skill_name, difficulty: diff, history: hist.slice(-2), asked: askedQs }))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not generate a question') }
  }
  function startQuiz() { setStep('quiz'); loadQ(startLevel, [], []) }

  async function answered(r: QuestionResult) {
    if (!q) return
    setBusy('Saving…')
    const { error: aErr } = await supabase.from('attempts').insert({
      user_id: uid, skill_id: skill.id, question_text: q.question, answer_given: q.options[r.selected],
      correct: r.correct, confidence_rating: r.confidence, error_type: r.errorType, difficulty,
    })
    if (aErr) { setError(aErr.message); setBusy(''); return }
    if (!r.correct) void addFlashcard(uid, skill.id, q.question, q.options[q.correct_index], q.options[r.selected])
    const ns = [...steps, { difficulty, correct: r.correct, confidence: r.confidence }]
    setSteps(ns); setBusy('')
    if (ns.length < QUIZ_LEN) {
      const nd = nextDifficulty(difficulty, r); const na = [...asked, q.question]
      setDifficulty(nd); setAsked(na); loadQ(nd, ns, na)
    } else finish(ns)
  }

  async function finish(ns: DiagStep[]) {
    setBusy('Updating your skill…')
    const correct = ns.filter((s) => s.correct).length
    const delta = ns.reduce((a, s) => a + practiceDelta(s.correct, s.difficulty), 0) + (feynmanPassed.current ? 4 : 0)
    const after = clamp(baseMastery + delta)
    const level = levelFromMastery(after)
    const now = new Date().toISOString()
    const { error: sErr } = await supabase.from('skill_states').upsert({
      user_id: uid, skill_id: skill.id, current_level: level, mastery_score: after, last_practiced_at: now, updated_at: now,
    }, { onConflict: 'user_id,skill_id' })
    if (sErr) { setError(sErr.message); setBusy(''); return }
    // Ledger: explain-back pass is the stronger proof; otherwise log practice only if they did reasonably well.
    if (feynmanPassed.current || correct >= 2) {
      await supabase.from('proof_ledger').insert({
        user_id: uid, skill_id: skill.id, proof_type: feynmanPassed.current ? 'explain_back_passed' : 'practice',
        evidence_summary: `${feynmanPassed.current ? `Explained "${skill.skill_name}" back correctly (${style.replace('_', ' ')} style) and a` : 'A'}nswered ${correct}/${ns.length} confirmation questions; mastery ${Math.round(baseMastery)} → ${Math.round(after)} (${level}).`,
      })
    }
    await snapshot(); await reload()
    setSummary({ before: baseMastery, after, correct, level }); setStep('done'); setBusy('')
    if (level !== startLevel && after > baseMastery) fireConfetti(160) // level-up: bigger burst
    else if (feynmanPassed.current || correct === ns.length) fireConfetti(70)
  }

  return (
    <div className="stagger mx-auto max-w-2xl space-y-4">
      <div><Link to=".." relative="path" className="text-sm text-slate-400 hover:text-white">← All skills</Link>
        <h1 className="font-display text-3xl font-bold">{skill.skill_name}</h1>
        <p className="text-sm text-slate-400 capitalize">{startLevel} · mastery {Math.round(baseMastery)}</p></div>
      {error && <ErrorBox message={error} />}

      {step === 'style' && (
        <Card title="How do you want it explained?">
          <div className="space-y-2">
            {STYLES.map((s) => (
              <button key={s.key} disabled={!!busy} onClick={() => getExplanation(s.key)}
                className={`w-full rounded-lg border p-3 text-left hover:border-indigo-400 disabled:opacity-50 ${suggested === s.key ? 'border-indigo-500' : 'border-slate-700'}`}>
                <span className="font-medium">{s.label}</span>{suggested === s.key && <span className="ml-2 text-xs text-indigo-300">suggested for you</span>}
                <p className="text-sm text-slate-400">{s.blurb}</p>
              </button>
            ))}
          </div>
          {busy && <div className="mt-3"><Spinner label={busy} /></div>}
        </Card>
      )}

      {(step === 'style' || step === 'done') && (
        <ResourcesCard skillId={skill.id} goalTitle={goal.goal_title} skillName={skill.skill_name} level={step === 'done' && summary ? summary.level : startLevel}
          gap={attempts.filter((a) => a.skill_id === skill.id && !a.correct).slice(0, 2).map((a) => a.question_text).join(' | ') || undefined} />
      )}

      {step === 'explain' && (
        <>
          <Card title={`Explanation · ${style.replace('_', ' ')}`}><div className="whitespace-pre-wrap leading-relaxed">{text}</div>
            <button className="mt-3 text-sm text-slate-400 underline" onClick={() => setStep('style')}>Try a different style</button></Card>
          <Card title="Now explain it back to me">
            <textarea className="input min-h-28" placeholder="In your own words, without looking…" value={explainBack} onChange={(e) => setExplainBack(e.target.value)} disabled={!!fb?.passed} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <MicButton onText={(t) => setExplainBack((p) => (p ? p + ' ' : '') + t)} onError={setError} />
              <button className="btn" disabled={!!busy || explainBack.trim().length < 15 || !!fb?.passed} onClick={checkExplainBack}>Check my explanation</button>
              {busy && <Spinner label={busy} />}
            </div>
            {fb && (
              <div className={`mt-3 rounded-lg border p-3 text-sm ${fb.passed ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-amber-500/50 bg-amber-500/10'}`}>
                <p className="font-medium">{fb.passed ? '✓ That holds up' : 'Needs work'}</p><p className="mt-1">{fb.feedback}</p>
              </div>
            )}
            {fb && <button className="btn mt-3 w-full" onClick={startQuiz}>{fb.passed ? 'Continue to questions' : 'Continue anyway'}</button>}
          </Card>
        </>
      )}

      {step === 'quiz' && (
        <Card title={`Question ${Math.min(steps.length + 1, QUIZ_LEN)} of ${QUIZ_LEN}`}>
          {busy ? <Spinner label={busy} /> : q ? <QuestionFlow key={q.question} q={q} onDone={answered} /> : !error && <Spinner label="Writing your next question…" />}
          {error && <button className="mt-2 underline text-sm" onClick={() => loadQ(difficulty, steps, asked)}>Retry</button>}
        </Card>
      )}

      {step === 'done' && summary && (
        <Card title="Session complete">
          <p className="text-3xl font-bold">{Math.round(summary.before)} → <span className={summary.after >= summary.before ? 'text-emerald-400' : 'text-amber-400'}>{Math.round(summary.after)}</span></p>
          <p className="text-slate-400">{summary.correct}/{QUIZ_LEN} correct · now {summary.level}{feynmanPassed.current && ' · explain-back passed (logged to your Proof of Work)'}</p>
          <div className="mt-4 flex gap-2"><Link className="btn" to={`/g/${goal.id}/dashboard`}>Dashboard</Link>
            <Link className="rounded-lg border border-slate-700 px-4 py-2" to={`/g/${goal.id}/practice`}>Another skill</Link></div>
        </Card>
      )}
    </div>
  )
}
