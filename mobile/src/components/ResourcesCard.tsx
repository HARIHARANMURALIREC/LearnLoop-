import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import { Linking, Pressable, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Button, Card, ErrorBox, T } from '@/components/ui'
import { learningResources } from '@/lib/ai'
import { resourceUrl, TYPE_META, type Resource } from '@/lib/resources'
import { C } from '@/lib/theme'
import type { Level } from '@/lib/types'

/** Study path matched to the learner's level for one skill. Cached per skill+level so it costs one AI call. */
export function ResourcesCard({ skillId, goalTitle, skillName, level, gap }: { skillId: string; goalTitle: string; skillName: string; level: Level; gap?: string }) {
  const key = `resources:${skillId}:${level}`
  const [items, setItems] = useState<Resource[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setItems(null); setError('')
    AsyncStorage.getItem(key).then((c) => { if (c) setItems(JSON.parse(c)) }).catch(() => {})
  }, [key])

  async function load() {
    setBusy(true); setError('')
    try {
      const r = (await learningResources({ goal_title: goalTitle, skill_name: skillName, level, gap })).resources
      setItems(r); AsyncStorage.setItem(key, JSON.stringify(r)).catch(() => {})
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load resources') }
    setBusy(false)
  }

  return (
    <Card title={`📚 Study path · ${level}`}>
      {!items ? (
        <>
          <T v="muted">Get a handpicked path of videos, docs and practice matched to your <T v="title" style={{ textTransform: 'capitalize' }}>{level}</T> level in {skillName}.</T>
          <Button label={busy ? 'Finding resources…' : 'Show my study path'} loading={busy} onPress={load} />
        </>
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((r, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 70).springify().damping(16)}>
              <Pressable onPress={() => Linking.openURL(resourceUrl(r))} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}><T style={{ fontSize: 18 }}>{TYPE_META[r.type].icon}</T></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="small"><T v="small" style={{ color: C.primarySoft }}>Step {i + 1}</T>  {TYPE_META[r.type].label} · {r.provider} · ~{r.minutes} min</T>
                  <T v="title" style={{ fontSize: 15 }}>{r.title}</T>
                  <T v="muted" style={{ fontSize: 13 }}>{r.why}</T>
                </View>
                <T v="muted">↗</T>
              </Pressable>
            </Animated.View>
          ))}
          <T v="small">AI-suggested. Links open a search so they never break.</T>
          <Pressable onPress={load} disabled={busy}><T v="small" style={{ color: C.primarySoft }}>{busy ? 'Refreshing…' : 'Refresh suggestions'}</T></Pressable>
        </View>
      )}
      {!!error && <ErrorBox message={error} onRetry={load} />}
    </Card>
  )
}
