import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { BackButton, Bar, Button, Card, CountUp, ErrorBox, Gauge, Rise, Screen, Spinner, T } from '@/components/ui'
import { Confetti } from '@/components/Confetti'
import { coachSession } from '@/lib/ai'
import { speechStats } from '@/lib/fillers'
import { supabase } from '@/lib/supabase'
import { C, F } from '@/lib/theme'
import type { Evaluation, TranscriptEntry } from '@/lib/types'

interface Sim { transcript: TranscriptEntry[]; score: number; evaluation: Evaluation | null; simulation_type: string; created_at: string }

export default function Result() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [sim, setSim] = useState<Sim | null>(null)
  const [error, setError] = useState('')
  const [coach, setCoach] = useState<{ turn_index: number; kind: 'strong' | 'improve' | 'flag'; tip: string }[] | null>(null)
  const [coaching, setCoaching] = useState(false)
  const [burst, setBurst] = useState(0)

  useEffect(() => {
    supabase.from('simulations').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
      if (error || !data) return setError(error?.message ?? 'Session not found')
      setSim(data as Sim)
      if ((data as Sim).score >= 70) { setBurst(1); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) }
    })
  }, [id])

  async function getCoaching() {
    setCoaching(true); setError('')
    try { setCoach((await coachSession({ type: sim!.simulation_type, goal_title: 'this session', transcript: sim!.transcript.map(({ role, text }) => ({ role, text })) })).moments) }
    catch (e) { setError(e instanceof Error ? e.message : 'Coaching failed') }
    setCoaching(false)
  }

  if (error && !sim) return <Screen><BackButton /><ErrorBox message={error} /></Screen>
  if (!sim) return <Screen><BackButton /><Spinner /></Screen>
  const ev = sim.evaluation, passed = sim.score >= 70
  const stats = speechStats(sim.transcript)
  const KIND = { strong: { icon: '✅', c: C.green }, improve: { icon: '💡', c: C.primarySoft }, flag: { icon: '🚩', c: C.amber } }
  const quote = ev?.high_confidence_wrong_moment?.quote?.toLowerCase().slice(0, 40)

  return (
    <View style={{ flex: 1 }}>
    <Screen>
      <BackButton />
      <Rise style={{ alignItems: 'center', gap: 8, marginTop: 4 }}>
        <Gauge value={sim.score} size={170}><View style={{ alignItems: 'center' }}><CountUp value={sim.score} style={{ fontFamily: F.display, fontSize: 52, color: C.text }} /><T v="small">/ 100</T></View></Gauge>
        <T v="h2" style={{ color: passed ? C.green : C.amber, textAlign: 'center' }}>{passed ? '✓ Passed — logged to Proof of Work' : 'Keep practicing'}</T>
      </Rise>
      {ev && <Rise i={1}><Card style={{ gap: 12 }}>
        <View style={{ gap: 4 }}><T v="label">Correctness · {Math.round(ev.correctness)}</T><Bar value={ev.correctness} /></View>
        <View style={{ gap: 4 }}><T v="label">Communication clarity · {Math.round(ev.communication)}</T><Bar value={ev.communication} /></View>
      </Card></Rise>}
      {ev?.high_confidence_wrong_moment && <Rise i={2}><Card tint="rgba(251,191,36,0.09)" style={{ gap: 8 }}>
        <T v="title" style={{ color: C.amber }}>⚠️ This is exactly the kind of high-confidence-wrong moment that costs interviews</T>
        <T v="body" style={{ fontStyle: 'italic', borderLeftWidth: 2, borderLeftColor: C.amber, paddingLeft: 10 }}>“{ev.high_confidence_wrong_moment.quote}”</T>
        <T v="muted">{ev.high_confidence_wrong_moment.why}</T></Card></Rise>}
      {ev && <Rise i={3}><Card title="Feedback"><T v="body">{ev.summary}</T>
        <T v="title" style={{ color: C.green, marginTop: 6 }}>Strengths</T>{ev.strengths.map((s, i) => <T key={i} v="muted">• {s}</T>)}
        <T v="title" style={{ color: C.amber, marginTop: 6 }}>To improve</T>{ev.improvements.map((s, i) => <T key={i} v="muted">• {s}</T>)}
        {sim.simulation_type === 'reverse_tutor' && ev.teaching_held_up !== undefined && <T v="title" style={{ marginTop: 6 }}>Teaching {ev.teaching_held_up ? 'held up ✓' : 'did not hold up ✗'}</T>}
      </Card></Rise>}
      <Rise i={4}><Card title="🎧 Delivery coaching">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[['Answers', stats.turns], ['Words/answer', stats.avgWords], ['Fillers', stats.fillers], ['Per 100', stats.per100]].map(([l, v]) => (
            <View key={l as string} style={{ flex: 1, alignItems: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 10 }}>
              <T style={{ fontFamily: F.display, fontSize: 20, color: l === 'Per 100' && (v as number) > 6 ? C.amber : C.text }}>{v as number}</T><T v="small">{l as string}</T></View>))}
        </View>
        {stats.top.length > 0 && <T v="muted" style={{ fontSize: 13 }}>Most used: {stats.top.map(([w, n]) => `“${w}” ×${n}`).join(' · ')}</T>}
        {!coach && <Button label="Get AI coaching on my answers" loading={coaching} onPress={getCoaching} />}
        {!!error && <ErrorBox message={error} />}
      </Card></Rise>
      <Rise i={5}><Card title="Transcript" style={{ gap: 8 }}>
        {sim.transcript.map((t, i) => {
          const flagged = quote && t.role === 'user' && t.text.toLowerCase().includes(quote)
          const tips = (coach ?? []).filter((m) => m.turn_index === i)
          return <View key={i} style={{ alignItems: t.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
            <View style={{ maxWidth: '88%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: t.role === 'user' ? 'rgba(124,92,255,0.4)' : 'rgba(255,255,255,0.09)', borderWidth: flagged ? 2 : 0, borderColor: C.amber }}>
              <T v="body" style={{ fontSize: 14 }}>{flagged ? '⚠️ ' : ''}{t.text}</T></View>
            {tips.map((m, k) => <View key={k} style={{ maxWidth: '88%', borderRadius: 12, borderWidth: 1, borderColor: KIND[m.kind].c + '66', backgroundColor: KIND[m.kind].c + '18', paddingHorizontal: 10, paddingVertical: 6 }}><T v="small" style={{ color: KIND[m.kind].c }}>{KIND[m.kind].icon} {m.tip}</T></View>)}</View>
        })}
      </Card></Rise>
      <Button label="Done" onPress={() => router.dismissAll()} />
    </Screen>
    <Confetti burst={burst} />
    </View>
  )
}
