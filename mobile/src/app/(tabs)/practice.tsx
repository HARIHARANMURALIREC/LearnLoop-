import { useRouter } from 'expo-router'
import { Pressable, View } from 'react-native'
import { Button, Card, Empty, Rise, Screen, T } from '@/components/ui'
import { useGoalData } from '@/lib/goalData'
import { masteryColor } from '@/lib/theme'

export default function PracticeList() {
  const { skills, states, effective, attempts } = useGoalData()
  const router = useRouter()
  const sorted = [...skills].sort((a, b) => effective(a.id) - effective(b.id))
  const flagged = new Set(attempts.filter((a) => a.is_high_confidence_wrong).map((a) => a.skill_id))
  return (
    <Screen bottomInset={90}>
      <Rise><T v="h1">Practice</T><T v="muted">Weakest skills first.</T></Rise>
      {!states.size ? <Empty title="Take the diagnostic first" hint="Practice targets your weakest skills."><Button label="Start diagnostic" onPress={() => router.push('/diagnostic')} /></Empty>
        : sorted.map((s, i) => (
          <Rise key={s.id} i={i + 1}>
            <Pressable onPress={() => router.push(`/practice/${s.id}`)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}><T v="title">{s.skill_name} {flagged.has(s.id) ? '⚠️' : ''}</T>
                  <T v="small" style={{ textTransform: 'capitalize' }}>{states.get(s.id)?.current_level ?? 'not tested'}</T></View>
                <View style={{ backgroundColor: states.has(s.id) ? masteryColor(effective(s.id)) : 'rgba(255,255,255,0.09)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <T v="title">{states.has(s.id) ? Math.round(effective(s.id)) : 'new'}</T></View>
              </Card>
            </Pressable>
          </Rise>
        ))}
    </Screen>
  )
}
