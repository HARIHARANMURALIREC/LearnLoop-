import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated'
import { Button, ErrorBox, T } from '@/components/ui'
import { classifyError } from '@/lib/ai'
import { C } from '@/lib/theme'
import type { ErrorType, Question } from '@/lib/types'

export interface QuestionResult { selected: number; correct: boolean; confidence: number; errorType: ErrorType | null }
const REASONS = [{ key: 'guessed', label: 'I guessed' }, { key: 'misread', label: 'I misread it' }, { key: "didn't know", label: "I didn't know" }]
// Only used if the classifier call fails, so a network blip never blocks the learner.
const FALLBACK: Record<string, ErrorType> = { guessed: 'concept_gap', misread: 'misread', "didn't know": 'concept_gap' }
const CONF = ['Guessing', 'Unsure', 'Maybe', 'Fairly', 'Certain']

/** One question: confidence is captured BEFORE correctness is revealed; wrong answers get a 1-tap reason + AI error classification. */
export function QuestionFlow({ q, onDone }: { q: Question; onDone: (r: QuestionResult) => void }) {
  const [sel, setSel] = useState<number | null>(null)
  const [conf, setConf] = useState(3)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState('')
  const correct = sel === q.correct_index

  async function reveal() {
    setRevealed(true)
    Haptics.notificationAsync(sel === q.correct_index ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error)
  }
  async function pickReason(reason: string) {
    setBusy(true); setWarn('')
    let errorType: ErrorType
    try { errorType = (await classifyError({ question: q.question, answer_given: q.options[sel!], correct_answer: q.options[q.correct_index], reason })).error_type }
    catch { errorType = FALLBACK[reason]; setWarn('Classifier unavailable — used a default.') }
    onDone({ selected: sel!, correct: false, confidence: conf, errorType })
  }

  return (
    <View style={{ gap: 14 }}>
      <T v="h2" style={{ fontSize: 20, lineHeight: 27 }}>{q.question}</T>
      <View style={{ gap: 9 }}>
        {q.options.map((o, i) => {
          const chosen = sel === i
          const bg = !revealed ? (chosen ? 'rgba(124,92,255,0.28)' : 'rgba(255,255,255,0.05)')
            : i === q.correct_index ? 'rgba(52,211,153,0.22)' : chosen ? 'rgba(248,113,113,0.22)' : 'rgba(255,255,255,0.03)'
          const border = !revealed ? (chosen ? C.primarySoft : C.border) : i === q.correct_index ? C.green : chosen ? C.red : 'transparent'
          return (
            <Animated.View key={i} entering={FadeInDown.delay(i * 70).springify().damping(16)}>
              <Pressable disabled={revealed} onPress={() => { Haptics.selectionAsync(); setSel(i) }}
                style={({ pressed }) => ({ backgroundColor: bg, borderColor: border, borderWidth: 1.5, borderRadius: 16, padding: 14, opacity: revealed && i !== q.correct_index && !chosen ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <T v="body">{o}</T>
              </Pressable>
            </Animated.View>
          )
        })}
      </View>

      {!revealed ? (
        <View style={{ gap: 10 }}>
          <T v="label">How sure are you? <T v="title" style={{ color: C.primarySoft }}>{CONF[conf - 1]}</T></T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => { Haptics.selectionAsync(); setConf(n) }} style={{ flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: n <= conf ? 'rgba(124,92,255,0.45)' : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: n === conf ? C.primarySoft : C.border }}>
                <T v="title">{n}</T></Pressable>
            ))}
          </View>
          <Button label="Lock in answer" disabled={sel === null} onPress={reveal} />
        </View>
      ) : correct ? (
        <Animated.View entering={ZoomIn.springify()} style={{ gap: 10 }}>
          <T v="title" style={{ color: C.green }}>Correct!</T>
          <Button label="Continue" onPress={() => onDone({ selected: sel!, correct: true, confidence: conf, errorType: null })} />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown} style={{ gap: 10 }}>
          {conf >= 4 && <View style={{ backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.4)', borderWidth: 1, borderRadius: 14, padding: 10 }}>
            <T v="muted" style={{ color: C.amber }}>⚠ You were confident and wrong — that's the most valuable thing to fix. It's been flagged.</T></View>}
          <T v="title" style={{ color: C.red }}>Not quite. What happened?</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {REASONS.map((r) => (
              <Pressable key={r.key} disabled={busy} onPress={() => pickReason(r.key)} style={{ borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 10, opacity: busy ? 0.5 : 1 }}>
                <T v="title" style={{ fontSize: 14 }}>{r.label}</T></Pressable>
            ))}
          </View>
          {busy && <T v="muted">Analysing…</T>}
          {!!warn && <ErrorBox message={warn} />}
        </Animated.View>
      )}
    </View>
  )
}
