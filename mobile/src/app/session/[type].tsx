import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Alert, View } from 'react-native'
import { VoiceSession } from '@/components/VoiceSession'
import { BackButton, ErrorBox, Screen, Spinner, T } from '@/components/ui'
import { simEval } from '@/lib/ai'
import { useApp } from '@/lib/auth'
import { useGoalData } from '@/lib/goalData'
import { levelFromMastery } from '@/lib/scoring'
import { supabase } from '@/lib/supabase'
import type { Level, SimType, TranscriptEntry } from '@/lib/types'
import { weakPoints } from '@/lib/weak'

const PASS_SCORE = 70
const TITLES: Record<string, string> = { conversation: 'Conversation practice', client_call: 'Client call', interview_behavioral: 'Mock interview', reverse_tutor: 'Reverse tutor' }

/** One simulation: live voice -> evaluation -> proof ledger -> result. (The coding round is web-only for now.) */
export default function Session() {
  const { type, skill: skillId } = useLocalSearchParams<{ type: SimType; skill?: string }>()
  const { goal, skills, states, attempts, effective } = useGoalData()
  const { session } = useApp()
  const router = useRouter()
  const uid = session!.user.id

  const skill = skills.find((s) => s.id === skillId)
  const avg = states.size ? [...states.values()].reduce((a, s) => a + s.mastery_score, 0) / states.size : null
  const level: Level = avg !== null ? levelFromMastery(avg) : goal.declared_level ?? 'beginner'
  const weak = useRef(weakPoints(skills, effective, attempts)).current

  const [simId, setSimId] = useState<string | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState('')
  const created = useRef(false)

  useEffect(() => {
    if (created.current) return
    created.current = true
    supabase.from('simulations').insert({ user_id: uid, goal_id: goal.id, simulation_type: type, transcript: [] }).select('id').single()
      .then(({ data, error }) => (error ? setError(error.message) : setSimId(data.id)))
  }, [uid, goal.id, type])

  // Live transcript logging (fire-and-forget; the final write on evaluation is authoritative).
  const log = (t: TranscriptEntry[]) => { if (simId) void supabase.from('simulations').update({ transcript: t }).eq('id', simId) }

  async function evaluate(t: TranscriptEntry[]) {
    setEvaluating(true); setError('')
    try {
      const ev = await simEval({ type, goal_title: goal.goal_title, level, transcript: t })
      const { error: uErr } = await supabase.from('simulations').update({ transcript: t, score: ev.score, overall_feedback: ev.summary, evaluation: ev, high_confidence_wrong_moment_flagged: !!ev.high_confidence_wrong_moment }).eq('id', simId!)
      if (uErr) throw uErr
      const ok = type === 'reverse_tutor' ? ev.teaching_held_up === true && ev.score >= 60 : ev.score >= PASS_SCORE
      if (ok) {
        await supabase.from('proof_ledger').insert({ user_id: uid, skill_id: type === 'reverse_tutor' ? skill?.id : null, proof_type: type === 'reverse_tutor' ? 'peer_taught' : 'simulation_passed',
          evidence_summary: type === 'reverse_tutor' ? `Taught "${skill?.skill_name}" to a confused student; teaching held up under questioning (score ${Math.round(ev.score)}).` : `${TITLES[type]} for ${goal.goal_title}: scored ${Math.round(ev.score)}/100.` })
      }
      router.replace(`/result/${simId}`)
    } catch (e) { setError(e instanceof Error ? e.message : (e as { message: string }).message); setEvaluating(false) }
  }

  if (type === 'reverse_tutor' && !skill) return <Screen><ErrorBox message="Pick a skill to teach from the Simulate tab." /></Screen>
  if (!simId) return <Screen>{error ? <ErrorBox message={error} /> : <Spinner label="Setting up your session…" />}</Screen>
  if (evaluating) return <Screen><Spinner label="Evaluating your session…" /></Screen>

  return (
    <Screen scroll={false}>
      <View style={{ marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton label="Exit session" onPress={() => Alert.alert('Leave this session?', 'Your conversation so far is saved, but it won\'t be scored.', [
          { text: 'Keep going', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => (router.canGoBack() ? router.back() : router.replace('/')) },
        ])} />
        <View style={{ flex: 1 }}><T v="h2">{TITLES[type]}</T>{skill && type === 'reverse_tutor' && <T v="small">Teach: {skill.skill_name}</T>}</View>
      </View>
      {!!error && <ErrorBox message={error} />}
      <VoiceSession simType={type} goalTitle={goal.goal_title} level={level} skillName={skill?.skill_name} weak={weak} initial={[]} onTranscript={log} onEnd={evaluate} endLabel="End session & get feedback" />
    </Screen>
  )
}
