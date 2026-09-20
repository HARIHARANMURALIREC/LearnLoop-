import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { ProgressChart } from '@/components/ProgressChart'
import { StreakCard } from '@/components/StreakCard'
import { Button, Card, CountUp, Empty, Gauge, Rise, Screen, T } from '@/components/ui'
import { ghostBenchmark } from '@/lib/ai'
import { useApp } from '@/lib/auth'
import { useDueCards, useStreak } from '@/lib/useActivity'
import { useGoalData } from '@/lib/goalData'
import { masteryColor, C, F } from '@/lib/theme'
import { READY_THRESHOLD, timeToReady } from '@/lib/scoring'

export default function Dashboard() {
  const { goal, skills, states, attempts, snapshots, effective, overall } = useGoalData()
  const router = useRouter()
  const { session } = useApp()
  const streak = useStreak(session!.user.id, attempts.length)
  const due = useDueCards(session!.user.id, attempts.length)
  const fading = skills.filter((s) => states.has(s.id) && states.get(s.id)!.mastery_score - effective(s.id) >= 3).length
  const [ghost, setGhost] = useState<{ day: number; score: number }[] | null>(null)

  useEffect(() => {
    const key = `ghost:${goal.id}`
    AsyncStorage.getItem(key).then(async (c) => {
      if (c) return setGhost(JSON.parse(c))
      try {
        const r = await ghostBenchmark({ goal_title: goal.goal_title, level: goal.declared_level ?? 'beginner' })
        setGhost(r.points); AsyncStorage.setItem(key, JSON.stringify(r.points)).catch(() => {})
      } catch { /* benchmark is optional */ }
    })
  }, [goal.id, goal.goal_title, goal.declared_level])

  const ttr = useMemo(() => timeToReady(snapshots, overall), [snapshots, overall])
  const skillName = useMemo(() => new Map(skills.map((s) => [s.id, s.skill_name])), [skills])
  const flags = attempts.filter((a) => a.is_high_confidence_wrong).slice(0, 4)
  const flagged = new Set(flags.map((f) => f.skill_id))

  if (!states.size) return (
    <Screen><Rise><T v="label">Your goal</T><T v="h1">{goal.goal_title}</T></Rise>
      <Empty title="No diagnostic yet" hint="Take the adaptive diagnostic to build your skill map."><Button label="Start diagnostic" onPress={() => router.push('/diagnostic')} /></Empty></Screen>
  )

  return (
    <Screen bottomInset={90}>
      <Rise><T v="label">Your goal</T><T v="h1">{goal.goal_title}</T></Rise>

      <Rise i={1}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Gauge value={overall} max={READY_THRESHOLD} size={122}>
            <View style={{ alignItems: 'center' }}><CountUp value={overall} style={{ fontFamily: F.display, fontSize: 34, color: C.text }} /><T v="small">of {READY_THRESHOLD}</T></View>
          </Gauge>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="label">Time to ready</T>
            {ttr.kind === 'ready' && <T v="h2" style={{ color: C.green }}>You're ready 🎉</T>}
            {ttr.kind === 'eta' && <><T v="h1" style={{ color: C.primarySoft }}>~{ttr.days}d</T><T v="small">+{ttr.slope.toFixed(1)} pts/day trend</T></>}
            {ttr.kind === 'insufficient' && <><T v="h2">Not enough data</T><T v="small">{ttr.reason}</T></>}
          </View>
        </Card>
      </Rise>

      <Rise i={2}><StreakCard streak={streak} due={due} fading={fading} /></Rise>

      <Rise i={3}><T v="label" style={{ marginTop: 6 }}>Skill heatmap</T></Rise>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {skills.map((s, i) => {
          const st = states.get(s.id), eff = effective(s.id), decayed = st ? st.mastery_score - eff : 0
          return (
            <Animated.View key={s.id} entering={FadeInDown.delay(180 + i * 55).springify().damping(15)} style={{ width: '48.5%' }}>
              <Pressable onPress={() => router.push(`/practice/${s.id}`)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }], borderRadius: 20, padding: 14, minHeight: 104, justifyContent: 'space-between',
                backgroundColor: st ? masteryColor(eff) : 'rgba(255,255,255,0.07)', opacity: st ? 0.6 + Math.min(eff, 100) / 250 : 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' })}>
                <T v="title" style={{ fontSize: 14, paddingRight: flagged.has(s.id) ? 18 : 0 }} numberOfLines={2}>{s.skill_name}</T>
                {flagged.has(s.id) && <T style={{ position: 'absolute', right: 10, top: 8 }}>⚠️</T>}
                {st ? <View><CountUp value={eff} style={{ fontFamily: F.display, fontSize: 30, color: '#fff' }} />
                  <T v="small" style={{ color: 'rgba(255,255,255,0.75)', textTransform: 'capitalize' }}>{st.current_level}{decayed >= 1 ? ` · ↓${Math.round(decayed)}` : ''}</T></View>
                  : <T v="small">Not tested</T>}
              </Pressable>
            </Animated.View>
          )
        })}
      </View>

      {flags.length > 0 && (
        <Rise i={4}><Card title="⚠️ High-confidence wrong" tint="rgba(251,191,36,0.08)">
          {flags.map((f) => <T key={f.id} v="muted"><T v="title" style={{ color: C.amber, fontSize: 14 }}>{skillName.get(f.skill_id)}</T> — {f.confidence_rating}/5 sure and wrong: “{f.question_text}”</T>)}
          <T v="small">Confident misconceptions cost the most in interviews. The simulator probes these live.</T>
        </Card></Rise>
      )}

      <Rise i={5}><Card title="Progress vs. benchmark">
        <ProgressChart snapshots={snapshots} current={overall} ghost={ghost} />
        <T v="small">Solid: you · dashed: ghost competitor (a simulated, illustrative benchmark — not real user data) · green: ready at {READY_THRESHOLD}</T>
      </Card></Rise>
    </Screen>
  )
}
