import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { CodeSubmission } from '../components/CodeRound'
import VoiceSession from '../components/VoiceSession'
import { Card, ErrorBox, Spinner } from '../components/ui'
import { simEval } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { useGoalData } from '../lib/goalData'
import { levelFromMastery } from '../lib/scoring'
import { supabase } from '../lib/supabase'
import type { Level, SimType, TranscriptEntry } from '../lib/types'
import { weakPoints } from '../lib/weak'

const CodeRound = lazy(() => import('../components/CodeRound')) // keeps Monaco out of the main bundle
const PASS_SCORE = 70
const TITLES: Record<string, string> = {
  conversation: 'Conversation practice', client_call: 'Client call', interview_behavioral: 'Mock interview', reverse_tutor: 'Reverse tutor',
}
type Phase = 'live' | 'coding' | 'followup' | 'evaluating'

/** Orchestrates one simulation: live voice -> (interview: coding round -> code follow-up) -> evaluation -> ledger -> result. */
export default function Session() {
  const { type } = useParams() as { type: SimType }
  const [sp] = useSearchParams()
  const { goal, skills, states, attempts, effective } = useGoalData()
  const { session } = useAuth()
  const nav = useNavigate()
  const uid = session!.user.id

  const skill = skills.find((s) => s.id === sp.get('skill'))
  const weakest = [...skills].sort((a, b) => effective(a.id) - effective(b.id))[0]
  const avg = states.size ? [...states.values()].reduce((a, s) => a + s.mastery_score, 0) / states.size : null
  const level: Level = avg !== null ? levelFromMastery(avg) : goal.declared_level ?? 'beginner'
  const weak = useRef(weakPoints(skills, effective, attempts)).current
  const hasCoding = type === 'interview_behavioral' && goal.domain_type === 'technical'

  const [phase, setPhase] = useState<Phase>('live')
  const [simId, setSimId] = useState<string | null>(null)
  const [code, setCode] = useState<CodeSubmission | null>(null)
  const [error, setError] = useState('')
  const transcript = useRef<TranscriptEntry[]>([])
  const created = useRef(false)

  useEffect(() => {
    if (created.current) return
    created.current = true
    supabase.from('simulations').insert({ user_id: uid, goal_id: goal.id, simulation_type: type, transcript: [] }).select('id').single()
      .then(({ data, error }) => error ? setError(error.message) : setSimId(data.id))
  }, [uid, goal.id, type])

  // Live transcript logging (fire-and-forget; the final write on evaluation is authoritative).
  const log = (t: TranscriptEntry[]) => { transcript.current = t; if (simId) void supabase.from('simulations').update({ transcript: t }).eq('id', simId) }

  async function evaluate(t: TranscriptEntry[], sub: CodeSubmission | null) {
    setPhase('evaluating'); setError('')
    try {
      const ev = await simEval({ type, goal_title: goal.goal_title, level, transcript: t, code: sub ?? undefined })
      const { error: uErr } = await supabase.from('simulations').update({
        transcript: t, score: ev.score, overall_feedback: ev.summary, evaluation: ev,
        high_confidence_wrong_moment_flagged: !!ev.high_confidence_wrong_moment,
        simulation_type: sub ? 'interview_coding' : type,
      }).eq('id', simId!)
      if (uErr) throw uErr
      const passed = type === 'reverse_tutor' ? ev.teaching_held_up === true && ev.score >= 60 : ev.score >= PASS_SCORE
      if (passed) {
        await supabase.from('proof_ledger').insert({
          user_id: uid, skill_id: type === 'reverse_tutor' ? skill?.id : sub ? weakest?.id : null,
          proof_type: type === 'reverse_tutor' ? 'peer_taught' : 'simulation_passed',
          evidence_summary: type === 'reverse_tutor'
            ? `Taught "${skill?.skill_name}" to a confused student; teaching held up under questioning (score ${Math.round(ev.score)}).`
            : `${TITLES[type]} for ${goal.goal_title}: scored ${Math.round(ev.score)}/100${sub ? `; coding round ${sub.passed ? 'tests passed' : 'reviewed'}` : ''}.`,
        })
      }
      nav(`/g/${goal.id}/simulation/${simId}`, { replace: true })
    } catch (e) { setError(e instanceof Error ? e.message : (e as { message: string }).message); setPhase('live') }
  }

  function afterVoice(t: TranscriptEntry[]) {
    transcript.current = t
    if (phase === 'live' && hasCoding) setPhase('coding')
    else evaluate(t, code)
  }

  if (type === 'reverse_tutor' && !skill) return <ErrorBox message="Pick a skill to teach from the Simulate page." />
  if (!simId) return error ? <ErrorBox message={error} /> : <Spinner label="Setting up your session…" />
  if (phase === 'evaluating') return <Spinner label="Evaluating your session…" />

  const codeContext = code ? `Problem: ${code.problem}\nTheir code:\n${code.code}\nTests ${code.passed ? 'passed' : 'failed'}:\n${code.output}` : undefined
  return (
    <div className="stagger mx-auto max-w-2xl space-y-4">
      <div><Link className="text-sm text-slate-400 hover:text-white" to={`/g/${goal.id}/simulate`}>← Exit</Link>
        <h1 className="font-display text-3xl font-bold">{TITLES[type]}{phase === 'followup' && ' · code follow-up'}{phase === 'coding' && ' · coding round'}</h1>
        {skill && type === 'reverse_tutor' && <p className="text-sm text-slate-400">Teach: {skill.skill_name}</p>}</div>
      {error && <ErrorBox message={error} />}

      {phase === 'coding' ? (
        <Suspense fallback={<Spinner label="Loading coding round…" />}><CodeRound simId={simId} goalTitle={goal.goal_title} skillName={weakest.skill_name} level={level}
          onDone={(sub, followup) => { setCode(sub); if (sub && followup) setPhase('followup'); else evaluate(transcript.current, sub) }} /></Suspense>
      ) : (
        <Card>
          <VoiceSession key={phase} simType={phase === 'followup' ? 'interview_followup' : type} goalTitle={goal.goal_title} level={level}
            skillName={skill?.skill_name} weak={phase === 'followup' ? [] : weak} codeContext={codeContext}
            initial={transcript.current} onTranscript={log} onEnd={afterVoice}
            endLabel={phase === 'followup' ? 'Finish & evaluate' : hasCoding ? 'Continue to coding round' : 'End session & get feedback'} />
        </Card>
      )}
    </div>
  )
}
