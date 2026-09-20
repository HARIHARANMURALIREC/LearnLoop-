import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Button, Card, Chip, Empty, Rise, Screen, T } from '@/components/ui'
import { useApp } from '@/lib/auth'
import { useGoalData } from '@/lib/goalData'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/theme'

interface Entry { id: string; skill_id: string | null; proof_type: string; evidence_summary: string; verified_at: string }
const TYPE: Record<string, { label: string; color: string }> = {
  practice: { label: 'Practice', color: C.muted }, peer_taught: { label: 'Peer taught', color: C.cyan },
  simulation_passed: { label: 'Simulation passed', color: C.green }, explain_back_passed: { label: 'Explain-back passed', color: C.primarySoft },
}

export default function More() {
  const { session, goals, goalId, setGoalId } = useApp()
  const { skills } = useGoalData()
  const router = useRouter()
  const [ledger, setLedger] = useState<Entry[] | null>(null)
  const name = new Map(skills.map((s) => [s.id, s.skill_name]))

  useEffect(() => {
    supabase.from('proof_ledger').select('*').eq('user_id', session!.user.id).order('verified_at', { ascending: false }).limit(30)
      .then(({ data }) => { const ids = new Set(skills.map((s) => s.id)); setLedger(((data as Entry[]) ?? []).filter((e) => !e.skill_id || ids.has(e.skill_id))) })
  }, [session, skills])

  return (
    <Screen bottomInset={90}>
      <Rise><T v="h1">You</T><T v="muted">{session!.user.email}</T></Rise>
      <Rise i={1}><Card title="Goals">
        {goals.map((g) => (
          <Pressable key={g.id} onPress={() => setGoalId(g.id)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
            <T v="title" style={{ color: g.id === goalId ? C.primarySoft : C.text }}>{g.goal_title}</T>{g.id === goalId && <Chip label="active" color={C.primarySoft} />}
          </Pressable>
        ))}
        <Button variant="ghost" label="+ New goal" onPress={() => router.push('/onboarding')} />
      </Card></Rise>
      <Rise i={2}><T v="label">Proof of work</T></Rise>
      {ledger && ledger.length === 0 && <Empty title="Nothing verified yet" hint="Pass an explain-back or a simulation to add entries." />}
      {ledger?.map((e, i) => (
        <Rise key={e.id} i={i + 3}><Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Chip label={TYPE[e.proof_type]?.label ?? e.proof_type} color={TYPE[e.proof_type]?.color} />
            {e.skill_id && <T v="title" style={{ fontSize: 14 }}>{name.get(e.skill_id)}</T>}</View>
          <T v="muted">{e.evidence_summary}</T><T v="small">{new Date(e.verified_at).toLocaleString()}</T>
        </Card></Rise>
      ))}
      <Button variant="ghost" label="Sign out" onPress={() => supabase.auth.signOut()} style={{ marginTop: 8 }} />
    </Screen>
  )
}
