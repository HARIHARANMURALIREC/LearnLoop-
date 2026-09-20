import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated'
import { Button, ErrorBox, Input, T } from '@/components/ui'
import { simTurn } from '@/lib/ai'
import { createRecognizer, speak, stopSpeaking, sttSupported, type Recognizer } from '@/lib/speech'
import { C } from '@/lib/theme'
import type { Level, TranscriptEntry } from '@/lib/types'

const MAX_QUESTIONS = 5
const DURATIONS = [5, 10, 15] // minutes
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

type Status = 'idle' | 'thinking' | 'speaking' | 'listening'
const ORB: Record<Status, { color: string; label: string }> = {
  idle: { color: '#475569', label: 'Paused' }, thinking: { color: '#f59e0b', label: 'Thinking…' },
  speaking: { color: '#818cf8', label: 'Speaking' }, listening: { color: '#34d399', label: 'Listening — go ahead' },
}

function Ripple({ color, delay, fast }: { color: string; delay: number; fast: boolean }) {
  const p = useSharedValue(0)
  useEffect(() => { p.value = 0; p.value = withDelay(delay, withRepeat(withTiming(1, { duration: fast ? 1500 : 2400, easing: Easing.out(Easing.quad) }), -1, false)) }, [fast, delay, p])
  const s = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - p.value), transform: [{ scale: 0.7 + p.value * 1.2 }] }))
  return <Animated.View style={[{ position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: color }, s]} />
}

function Orb({ status }: { status: Status }) {
  const { color } = ORB[status]
  const b = useSharedValue(1)
  useEffect(() => { b.value = status === 'idle' ? withTiming(1) : withRepeat(withTiming(1.09, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true) }, [status, b])
  const s = useAnimatedStyle(() => ({ transform: [{ scale: b.value }] }))
  return (
    <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
      {status !== 'idle' && [0, 1, 2].map((i) => <Ripple key={`${status}${i}`} color={color} delay={i * 700} fast={status === 'listening'} />)}
      <Animated.View style={[{ width: 96, height: 96, borderRadius: 48, backgroundColor: color, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 30, shadowOffset: { width: 0, height: 0 }, elevation: 12 }, s]}>
        <View style={{ position: 'absolute', left: 18, top: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.35)' }} />
      </Animated.View>
    </View>
  )
}

interface Props {
  simType: string; goalTitle: string; level: Level; skillName?: string; weak: string[]
  initial: TranscriptEntry[]
  onTranscript: (t: TranscriptEntry[]) => void // live transcript logging
  onEnd: (t: TranscriptEntry[]) => void
  endLabel: string
}

/** Live loop: mic -> STT -> Groq turn -> ElevenLabs voice -> mic. Typing is always available (and is the only input in Expo Go). */
export function VoiceSession(p: Props) {
  const [entries, setEntries] = useState(p.initial)
  const [status, setStatus] = useState<Status>('idle')
  const [started, setStarted] = useState(false)
  const [interim, setInterim] = useState('')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [latency, setLatency] = useState<number | null>(null)
  const [minutes, setMinutes] = useState(10)
  const [left, setLeft] = useState(0)
  const ref = useRef(p.initial)
  const statusRef = useRef<Status>('idle')
  const active = useRef(false)
  const lang = useRef('en-US')
  const rec = useRef<Recognizer | null>(null)
  const silent = useRef(0)
  const scroll = useRef<ScrollView>(null)
  const propsRef = useRef(p); propsRef.current = p

  const st = (s: Status) => { statusRef.current = s; setStatus(s) }
  useEffect(() => () => { active.current = false; rec.current?.stop(); stopSpeaking() }, [])

  function push(role: 'user' | 'ai', text: string) {
    ref.current = [...ref.current, { role, text, timestamp: new Date().toISOString() }]
    setEntries(ref.current); propsRef.current.onTranscript(ref.current)
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50)
  }

  async function aiTurn() {
    st('thinking'); setError('')
    const t0 = Date.now()
    try {
      const c = propsRef.current
      const r = await simTurn({ type: c.simType, goal_title: c.goalTitle, level: c.level, skill_name: c.skillName, weak: c.weak, question_no: ref.current.filter((e) => e.role === 'ai').length + 1, max_questions: MAX_QUESTIONS, transcript: ref.current.map(({ role, text }) => ({ role, text })) })
      if (!active.current) return
      if (!r.reply) throw new Error('Empty reply from the model')
      setLatency(Date.now() - t0)
      lang.current = r.lang || lang.current
      push('ai', r.reply)
      st('speaking')
      speak(r.reply, lang.current, () => { if (active.current && statusRef.current === 'speaking') listen() })
    } catch (e) { if (active.current) { setError(e instanceof Error ? e.message : 'The AI did not respond'); st('idle') } }
  }

  function handleUser(text: string) {
    if (!text.trim() || statusRef.current === 'thinking') return
    rec.current?.stop(); stopSpeaking(); setInterim('')
    push('user', text.trim())
    if (ref.current.filter((e) => e.role === 'user').length >= MAX_QUESTIONS) return endRef.current() // 5th answer given: wrap up
    aiTurn()
  }

  function listen() {
    if (!sttSupported || !active.current) return st('idle')
    st('listening'); setInterim('')
    rec.current?.stop()
    const r = createRecognizer(lang.current, {
      onInterim: setInterim,
      onFinal: (t) => { silent.current = 0; if (statusRef.current === 'listening') handleUser(t) },
      onError: (c) => {
        if (c === 'not-allowed' || c === 'service-not-allowed') { setError('Microphone or speech permission was denied. Enable it in Settings, or type your replies below.'); st('idle') }
        else if (c === 'audio-capture') { setError('No microphone available. You can type your replies below.'); st('idle') }
        else if (c === 'network') { setError('Speech service unreachable. You can type your replies below.'); st('idle') }
      },
      onEnd: (got) => {
        if (got || !active.current || statusRef.current !== 'listening') return
        silent.current++
        if (silent.current >= 4) return st('idle') // give up after a few silent rounds; user can tap the mic
        setTimeout(() => { if (active.current && statusRef.current === 'listening') r.start() }, 250)
      },
    })
    rec.current = r; r.start()
  }

  function begin() { active.current = true; setLeft(minutes * 60); setStarted(true); aiTurn() }
  function send() { if (typed.trim()) { handleUser(typed); setTyped('') } }
  function end() { active.current = false; rec.current?.stop(); stopSpeaking(); p.onEnd(ref.current) }

  const endRef = useRef(end); endRef.current = end
  useEffect(() => {
    if (!started) return
    const t = setInterval(() => setLeft((l) => l - 1), 1000)
    return () => clearInterval(t)
  }, [started])
  useEffect(() => {
    if (!started || left > 0) return
    if (ref.current.some((e) => e.role === 'user')) return endRef.current()
    active.current = false; rec.current?.stop(); stopSpeaking(); st('idle')
    setError('Time is up before you answered anything. Go back and try again.')
  }, [started, left])

  const qNo = Math.min(entries.filter((e) => e.role === 'ai').length, MAX_QUESTIONS)
  const userTurns = entries.filter((e) => e.role === 'user').length
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={10}>
      {!sttSupported && <ErrorBox message="Voice input needs a development build (it isn't available in Expo Go). You can type your replies; the AI still speaks." />}
      {!!error && <ErrorBox message={error} onRetry={started && status === 'idle' && ref.current.at(-1)?.role === 'user' ? aiTurn : undefined} />}

      <View style={{ alignItems: 'center', paddingVertical: 8, gap: 6 }}>
        <Orb status={status} />
        <T v="muted">{started ? ORB[status].label : 'Ready when you are'}</T>
        {latency !== null && <T v="small">AI replied in {latency} ms</T>}
        {started && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 4 }}><T v="small">Question {qNo || 1} of {MAX_QUESTIONS}</T></View>
            <View style={{ borderRadius: 99, backgroundColor: left <= 30 ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 4 }}><T v="small" style={left <= 30 ? { color: '#fca5a5' } : undefined}>⏱ {fmt(Math.max(left, 0))}</T></View>
          </View>
        )}
        {!started && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T v="small">{MAX_QUESTIONS} questions · time limit</T>
            {DURATIONS.map((m) => (
              <Pressable key={m} onPress={() => setMinutes(m)} style={{ borderRadius: 99, borderWidth: 1, borderColor: minutes === m ? '#818cf8' : C.border, backgroundColor: minutes === m ? 'rgba(124,92,255,0.25)' : 'transparent', paddingHorizontal: 12, paddingVertical: 4 }}><T v="small" style={minutes === m ? { color: C.text } : undefined}>{m} min</T></Pressable>
            ))}
          </View>
        )}
        {!started ? <Button label="Start session" onPress={begin} style={{ alignSelf: 'stretch', marginTop: 8 }} />
          : status === 'idle' && sttSupported && <Pressable onPress={() => { silent.current = 0; listen() }} style={{ borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: C.card }}><T v="title" style={{ fontSize: 14 }}>🎤 Tap to talk</T></Pressable>}
      </View>

      <ScrollView ref={scroll} style={{ flex: 1, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: 'rgba(0,0,0,0.25)' }} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {entries.length === 0 && <T v="small">The transcript appears here as you talk.</T>}
        {entries.map((e, i) => (
          <View key={i} style={{ alignItems: e.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <View style={{ maxWidth: '86%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: e.role === 'user' ? 'rgba(124,92,255,0.4)' : 'rgba(255,255,255,0.09)',
              borderBottomRightRadius: e.role === 'user' ? 4 : 18, borderBottomLeftRadius: e.role === 'user' ? 18 : 4 }}><T v="body" style={{ fontSize: 14 }}>{e.text}</T></View>
          </View>
        ))}
        {!!interim && <T v="small" style={{ textAlign: 'right', fontStyle: 'italic' }}>{interim}…</T>}
      </ScrollView>

      {started && <View style={{ gap: 10, marginTop: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Input style={{ flex: 1 }} placeholder="Or type your reply…" value={typed} onChangeText={setTyped} onSubmitEditing={send} returnKeyType="send" />
          <Button label="Send" onPress={send} disabled={!typed.trim() || status === 'thinking'} />
        </View>
        <Button variant="ghost" label={userTurns < 1 ? `${p.endLabel} (answer one question first)` : p.endLabel} disabled={userTurns < 1 || status === 'thinking'}
          onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); end() }} />
      </View>}
    </KeyboardAvoidingView>
  )
}
