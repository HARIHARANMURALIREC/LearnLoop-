import { useRouter } from 'expo-router'
import { Pressable, View } from 'react-native'
import { Card, CountUp, T } from '@/components/ui'
import type { Streak } from '@/lib/streak'
import { C, F } from '@/lib/theme'

export function StreakCard({ streak, due, fading }: { streak: Streak | null; due: number; fading: number }) {
  const router = useRouter()
  if (!streak) return null
  const msg = streak.todayDone ? "Today's practice is done ✓" : streak.atRisk ? 'Practice today to keep your streak!' : 'Practice today to start a streak'
  const Row = ({ label, n, to }: { label: string; n: number; to: '/flashcards' | '/review' }) => (
    <Pressable onPress={() => router.push(to)} style={({ pressed }) => ({ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 12, paddingVertical: 12, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <T v="title" style={{ fontSize: 14 }}>{label}</T><T v="title" style={{ color: n ? C.amber : C.faint }}>{n} ›</T>
    </Pressable>
  )
  return (
    <Card title="Today">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <T style={{ fontSize: 44, opacity: streak.current ? 1 : 0.35 }}>🔥</T>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}><CountUp value={streak.current} style={{ fontFamily: F.display, fontSize: 34, color: C.text }} /><T v="muted">day{streak.current === 1 ? '' : 's'}</T></View>
          <T v="small" style={{ color: streak.atRisk ? C.amber : C.muted }}>{msg}</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 3 }}>{streak.last14.map((d, i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: d ? C.primarySoft : 'rgba(255,255,255,0.1)' }} />)}</View>
      <Row label="🗂️  Flashcards due" n={due} to="/flashcards" />
      <Row label="🔁  Skills fading — review" n={fading} to="/review" />
    </Card>
  )
}
