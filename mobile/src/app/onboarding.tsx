import { useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native'
import { BackButton, Bar, Button, Card, ErrorBox, Input, Rise, Screen, T } from '@/components/ui'
import { generateSkillMap } from '@/lib/ai'
import { useApp } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { C } from '@/lib/theme'
import type { DomainType, Level, SkillDraft } from '@/lib/types'

const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced']

export default function Onboarding() {
  const { session, reloadGoals, setGoalId, goalId } = useApp()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState<Level>('beginner')
  const [map, setMap] = useState<{ domain_type: DomainType; skills: SkillDraft[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setBusy(true); setError('')
    try { setMap(await generateSkillMap(title.trim(), level)) } catch (e) { setError(e instanceof Error ? e.message : 'Failed to generate skill map') }
    setBusy(false)
  }

  async function start() {
    if (!map || !session) return
    setBusy(true); setError('')
    const { data: goal, error: gErr } = await supabase.from('goals').insert({ user_id: session.user.id, goal_title: title.trim(), domain_type: map.domain_type, declared_level: level }).select().single()
    if (gErr) { setError(gErr.message); setBusy(false); return }
    const { error: sErr } = await supabase.from('skills').insert(map.skills.map((s) => ({ ...s, goal_id: goal.id })))
    if (sErr) { await supabase.from('goals').delete().eq('id', goal.id); setError(sErr.message); setBusy(false); return }
    setGoalId(goal.id); await reloadGoals()
    router.replace('/diagnostic')
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        {/* first-time users have nowhere to go back to; everyone else can leave, and step 2 goes back to step 1 */}
        {(map || goalId) && <BackButton onPress={() => (map ? setMap(null) : router.canGoBack() ? router.back() : router.replace('/'))} />}
        {!map ? (
          <>
            <Rise><T v="h1" style={{ marginTop: 24 }}>What are you learning to <T v="h1" style={{ color: C.primarySoft }}>become</T>?</T></Rise>
            <Rise i={1}><Input placeholder="e.g. Frontend Developer, Conversational Spanish" value={title} onChangeText={setTitle} /></Rise>
            <Rise i={2}><T v="label" style={{ marginBottom: 8 }}>Where are you starting from?</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {LEVELS.map((l) => (
                  <Pressable key={l} onPress={() => setLevel(l)} style={{ flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', borderWidth: 1.5,
                    borderColor: level === l ? C.primarySoft : C.border, backgroundColor: level === l ? 'rgba(124,92,255,0.25)' : C.card }}>
                    <T v="title" style={{ fontSize: 14, textTransform: 'capitalize' }}>{l}</T></Pressable>
                ))}
              </View></Rise>
            {!!error && <ErrorBox message={error} />}
            <Rise i={3}><Button label={busy ? 'Building your skill map…' : 'Generate skill map'} loading={busy} disabled={title.trim().length < 3} onPress={generate} /></Rise>
            {goalId && <Button variant="ghost" label="Cancel" onPress={() => router.back()} />}
          </>
        ) : (
          <>
            <Rise><T v="h1" style={{ marginTop: 24 }}>Your skill map</T><T v="muted" style={{ textTransform: 'capitalize' }}>{title} · {map.domain_type} · starting {level}</T></Rise>
            {map.skills.map((s, i) => (
              <Rise key={s.skill_name} i={i + 1}><Card style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T v="title">{s.skill_name}</T><T v="small">{Math.round(s.weight * 100)}%</T></View>
                <Bar value={s.weight} max={0.4} /></Card></Rise>
            ))}
            {!!error && <ErrorBox message={error} />}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button variant="ghost" label="Back" onPress={() => setMap(null)} style={{ flex: 1 }} />
              <Button label="Start diagnostic" loading={busy} onPress={start} style={{ flex: 2 }} />
            </View>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  )
}
