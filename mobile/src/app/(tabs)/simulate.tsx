import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Button, Card, Chip, Empty, Rise, Screen, T } from '@/components/ui'
import { useGoalData } from '@/lib/goalData'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/theme'

const LABEL: Record<string, string> = { conversation: 'Conversation practice', client_call: 'Client call', interview_behavioral: 'Mock interview', interview_coding: 'Mock interview + coding', reverse_tutor: 'Reverse tutor' }
interface SimRow { id: string; simulation_type: string; score: number | null; created_at: string; high_confidence_wrong_moment_flagged: boolean }

export default function Simulate() {
  const { goal, skills, states, effective } = useGoalData()
  const router = useRouter()
  const [recent, setRecent] = useState<SimRow[]>([])
  const [rt, setRt] = useState<string | null>(null)
  const strong = [...skills].filter((s) => states.has(s.id)).sort((a, b) => effective(b.id) - effective(a.id))
  const rtId = rt ?? strong[0]?.id
  const main = goal.domain_type === 'language' ? { type: 'conversation', icon: '🗣️', title: 'Conversation practice', text: 'Talk with a native-speaker persona that adapts pace and vocabulary to your level.' }
    : goal.domain_type === 'technical' ? { type: 'interview_behavioral', icon: '💼', title: 'Mock interview', text: 'A live voice interview that probes your weak points. (Coding round: use the web app.)' }
    : { type: 'client_call', icon: '📞', title: 'Client call', text: 'Pitch to a skeptical client who pushes back on price, ROI and trust.' }

  useFocusEffect(useCallback(() => {
    supabase.from('simulations').select('id, simulation_type, score, created_at, high_confidence_wrong_moment_flagged').eq('goal_id', goal.id).not('score', 'is', null).order('created_at', { ascending: false }).limit(8)
      .then(({ data }) => setRecent((data as SimRow[]) ?? []))
  }, [goal.id]))

  return (
    <Screen bottomInset={90}>
      <Rise><T v="h1">Simulate</T><T v="muted">Live, real-time voice. The AI probes your known weak points — use headphones somewhere quiet.</T></Rise>
      <Rise i={1}><Card style={{ gap: 8 }}><T style={{ fontSize: 34 }}>{main.icon}</T><T v="h2">{main.title}</T><T v="muted">{main.text}</T>
        <Button label="Start" onPress={() => router.push(`/session/${main.type}`)} /></Card></Rise>
      <Rise i={2}><Card style={{ gap: 8 }}><T style={{ fontSize: 34 }}>🧑‍🏫</T><T v="h2">Reverse tutor</T><T v="muted">Teach a skill you're strong at to a deliberately confused student.</T>
        {strong.length === 0 ? <T v="small">Finish the diagnostic first.</T> : <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {strong.slice(0, 6).map((s) => (
              <Pressable key={s.id} onPress={() => setRt(s.id)} style={{ borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 7, borderColor: rtId === s.id ? C.primarySoft : C.border, backgroundColor: rtId === s.id ? 'rgba(124,92,255,0.25)' : C.card }}>
                <T v="title" style={{ fontSize: 13 }}>{s.skill_name}</T></Pressable>
            ))}
          </View>
          <Button label="Start teaching" onPress={() => router.push(`/session/reverse_tutor?skill=${rtId}`)} /></>}
      </Card></Rise>
      <Rise i={3}><T v="label">Recent sessions</T></Rise>
      {recent.length === 0 ? <Empty title="No sessions yet" hint="Your scored sessions show up here." /> : recent.map((r, i) => (
        <Rise key={r.id} i={i + 4}><Pressable onPress={() => router.push(`/result/${r.id}`)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: 4 }}><T v="title">{LABEL[r.simulation_type]}</T><T v="small">{new Date(r.created_at).toLocaleDateString()}</T></View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>{r.high_confidence_wrong_moment_flagged && <Chip label="⚠️ flagged" color={C.amber} />}<T v="h2">{Math.round(r.score!)}</T></View>
          </Card></Pressable></Rise>
      ))}
    </Screen>
  )
}
