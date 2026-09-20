import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated'
import { Confetti } from '@/components/Confetti'
import { BackButton, Button, Card, Empty, ErrorBox, Rise, Screen, Spinner, T } from '@/components/ui'
import { useApp } from '@/lib/auth'
import { useGoalData } from '@/lib/goalData'
import { BOX_DAYS, isMastered, review } from '@/lib/srs'
import { supabase } from '@/lib/supabase'
import { C, F } from '@/lib/theme'

interface Card_ { id: string; skill_id: string | null; question_text: string; correct_answer: string; wrong_answer: string | null; box: number; reps: number; lapses: number; due_at: string }

/** Leitner flashcards from questions you missed. Known cards return after longer gaps; misses come back tomorrow. */
export default function Flashcards() {
  const { skills } = useGoalData()
  const { session } = useApp()
  const router = useRouter()
  const [cards, setCards] = useState<Card_[] | null>(null)
  const [error, setError] = useState('')
  const [shown, setShown] = useState(false)
  const [started, setStarted] = useState(false)
  const [burst, setBurst] = useState(0)
  const name = new Map(skills.map((s) => [s.id, s.skill_name]))

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('flashcards').select('*').eq('user_id', session!.user.id).in('skill_id', skills.map((s) => s.id)).order('due_at')
    if (error) setError(error.message); else setCards(data as Card_[])
  }, [skills, session])
  useEffect(() => { load() }, [load])

  if (error) return <Screen><BackButton /><ErrorBox message={error} /></Screen>
  if (!cards) return <Screen><BackButton /><Spinner /></Screen>
  const due = cards.filter((c) => new Date(c.due_at).getTime() <= Date.now())
  const current = due[0]
  const mastered = cards.filter((c) => isMastered(c.box)).length

  async function answer(gotIt: boolean) {
    const c = current!, next = review(c, gotIt)
    Haptics.notificationAsync(gotIt ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning)
    setShown(false)
    setCards((prev) => prev!.map((x) => (x.id === c.id ? { ...x, ...next } : x))) // optimistic: the card leaves the due queue right away
    await supabase.from('flashcards').update(next).eq('id', c.id)
    if (due.length === 1) setBurst((b) => b + 1)
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <BackButton />
        <Rise><T v="h1">Flashcards</T><T v="muted">Every question you miss becomes a card.</T></Rise>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[['Due now', due.length, C.amber], ['Total', cards.length, C.text], ['Mastered', mastered, C.green]].map(([l, n, c]) => (
            <View key={l as string} style={{ flex: 1, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, paddingVertical: 12 }}>
              <T style={{ fontFamily: F.display, fontSize: 28, color: c as string }}>{n as number}</T><T v="small">{l as string}</T></View>))}
        </View>
        {cards.length === 0 ? <Empty title="No flashcards yet" hint="Answer a question wrong in the diagnostic, practice or review and it lands here." />
        : !due.length ? <Empty title="All caught up 🎉" hint={`Next card due ${new Date(cards.map((c) => c.due_at).sort()[0]).toLocaleDateString()}.`}><Button label="Back" onPress={() => router.back()} /></Empty>
        : !started ? <Card style={{ alignItems: 'center' }}><T v="h2">{due.length} card{due.length > 1 ? 's' : ''} ready</T><Button label="Start reviewing" onPress={() => setStarted(true)} style={{ alignSelf: 'stretch' }} /></Card>
        : current && (
          <Animated.View key={current.id} entering={FadeInDown.springify().damping(16)} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T v="small">{name.get(current.skill_id ?? '') ?? 'Skill'}</T><T v="small">Box {current.box}/5 · {due.length} left</T></View>
            <Pressable onPress={() => setShown(true)}>
              <Card style={{ minHeight: 170, gap: 14 }}>
                <T v="h2" style={{ fontSize: 20, lineHeight: 27 }}>{current.question_text}</T>
                {shown ? <Animated.View entering={ZoomIn.springify()} style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>
                  <T v="label" style={{ color: C.green }}>Answer</T><T v="body" style={{ fontSize: 17 }}>{current.correct_answer}</T>
                  {!!current.wrong_answer && <T v="small" style={{ textDecorationLine: 'line-through' }}>You said: {current.wrong_answer}</T>}</Animated.View>
                  : <T v="small" style={{ textAlign: 'center' }}>Tap to reveal the answer</T>}
              </Card>
            </Pressable>
            {shown && <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={() => answer(false)} style={{ flex: 1, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#f8717166', backgroundColor: '#f8717120', paddingVertical: 14 }}><T v="title" style={{ color: C.red }}>Again</T><T v="small">tomorrow</T></Pressable>
              <Pressable onPress={() => answer(true)} style={{ flex: 1, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: '#34d39966', backgroundColor: '#34d39920', paddingVertical: 14 }}><T v="title" style={{ color: C.green }}>Got it</T><T v="small">in {BOX_DAYS[Math.min(4, current.box)]}d</T></Pressable>
            </View>}
          </Animated.View>
        )}
      </Screen>
      <Confetti burst={burst} count={90} />
    </View>
  )
}
