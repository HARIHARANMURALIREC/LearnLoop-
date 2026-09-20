import { useEffect, useRef, useState, type FormEvent } from 'react'
import { simTurn } from '../lib/ai'
import { createRecognizer, speak, stopSpeaking, sttSupported, ttsSupported, type Recognizer } from '../lib/speech'
import type { Level, TranscriptEntry } from '../lib/types'
import { ErrorBox } from './ui'

const MAX_QUESTIONS = 5
const DURATIONS = [5, 10, 15] // minutes
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

type Status = 'idle' | 'thinking' | 'speaking' | 'listening'
const ORB: Record<Status, { color: string; label: string }> = {
  idle: { color: '#475569', label: 'Paused' }, thinking: { color: '#f59e0b', label: 'Thinking…' },
  speaking: { color: '#818cf8', label: 'Speaking' }, listening: { color: '#34d399', label: 'Listening — go ahead' },
}

interface Props {
  simType: string; goalTitle: string; level: Level; skillName?: string; weak: string[]; codeContext?: string
  initial: TranscriptEntry[]
  onTranscript: (t: TranscriptEntry[]) => void   // called live after every turn (transcript logging)
  onEnd: (t: TranscriptEntry[]) => void
  endLabel: string
}

/** Live loop: mic -> Web Speech STT -> Groq turn -> SpeechSynthesis -> mic. Text input is always available as a fallback. */
export default function VoiceSession(p: Props) {
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
  const bottom = useRef<HTMLDivElement>(null)
  const propsRef = useRef(p); propsRef.current = p

  const st = (s: Status) => { statusRef.current = s; setStatus(s) }
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [entries, interim])
  useEffect(() => () => { active.current = false; rec.current?.stop(); stopSpeaking() }, [])

  function push(role: 'user' | 'ai', text: string) {
    ref.current = [...ref.current, { role, text, timestamp: new Date().toISOString() }]
    setEntries(ref.current); propsRef.current.onTranscript(ref.current)
  }

  async function aiTurn() {
    st('thinking'); setError('')
    const t0 = performance.now()
    try {
      const c = propsRef.current
      const r = await simTurn({
        type: c.simType, goal_title: c.goalTitle, level: c.level, skill_name: c.skillName, weak: c.weak,
        code_context: c.codeContext,
        question_no: ref.current.filter((e) => e.role === 'ai').length + 1, max_questions: MAX_QUESTIONS, transcript: ref.current.map(({ role, text }) => ({ role, text })),
      })
      if (!active.current) return
      if (!r.reply) throw new Error('Empty reply from the model')
      setLatency(Math.round(performance.now() - t0))
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
        if (c === 'not-allowed' || c === 'service-not-allowed') { setError('Microphone access was denied. Allow it in your browser settings, or type your replies below.'); st('idle') }
        else if (c === 'audio-capture') { setError('No microphone found. You can type your replies below.'); st('idle') }
        else if (c === 'network') { setError('Speech service unreachable. You can type your replies below.'); st('idle') }
      },
      onEnd: (got) => {
        if (got || !active.current || statusRef.current !== 'listening') return
        silent.current++
        if (silent.current >= 4) return st('idle') // give up after a few silent rounds; user can tap mic
        setTimeout(() => { if (active.current && statusRef.current === 'listening') r.start() }, 250)
      },
    })
    rec.current = r; r.start()
  }

  function begin() { active.current = true; setLeft(minutes * 60); setStarted(true); aiTurn() }
  function submitTyped(e: FormEvent) { e.preventDefault(); if (typed.trim()) { handleUser(typed); setTyped('') } }
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
    setError('Time is up before you answered anything. Refresh to try again.')
  }, [started, left])

  const orb = ORB[status]
  const userTurns = entries.filter((e) => e.role === 'user').length
  const qNo = Math.min(entries.filter((e) => e.role === 'ai').length, MAX_QUESTIONS)
  return (
    <div className="stagger space-y-4">
      {!sttSupported && <ErrorBox message="Speech recognition isn't supported in this browser (use Chrome or Edge for voice). You can still type your replies." />}
      {!ttsSupported && <ErrorBox message="Speech synthesis isn't available; you'll read the AI's replies instead." />}
      {error && <ErrorBox message={error} onRetry={started && status === 'idle' && ref.current.at(-1)?.role === 'user' ? aiTurn : undefined} />}

      <div className="flex flex-col items-center gap-2 py-4">
        <div className="relative grid h-36 w-36 place-items-center">
          {status !== 'idle' && [0, 1, 2].map((i) => <span key={i} className="ring" style={{ borderColor: orb.color, animationDelay: `${i * 0.7}s`, animationDuration: status === 'listening' ? '1.6s' : '2.4s' }} />)}
          <div className={`orb-core h-24 w-24 rounded-full ${status !== 'idle' ? 'orb-active' : ''}`}
            style={{ background: `radial-gradient(circle at 30% 28%, #ffffffaa, ${orb.color} 55%)`, boxShadow: `0 0 70px ${orb.color}99, inset 0 -8px 20px #0004` }} />
        </div>
        <p className="text-sm text-slate-300">{started ? orb.label : 'Ready when you are'}</p>
        {latency !== null && <p className="text-xs text-slate-500">AI replied in {latency} ms</p>}
        {started && (
          <div className="flex items-center gap-2 text-sm">
            <span className="rounded-full bg-white/10 px-3 py-1">Question {qNo || 1} of {MAX_QUESTIONS}</span>
            <span className={`rounded-full px-3 py-1 font-mono tabular-nums ${left <= 30 ? 'animate-pulse bg-red-500/20 text-red-300' : 'bg-white/10'}`} aria-label="Time left">⏱ {fmt(Math.max(left, 0))}</span>
          </div>
        )}
        {!started && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>{MAX_QUESTIONS} questions · time limit</span>
            {DURATIONS.map((m) => (
              <button key={m} onClick={() => setMinutes(m)} className={`rounded-full border px-3 py-1 transition-all ${minutes === m ? 'border-indigo-400 bg-indigo-500/25 text-white' : 'border-white/10 hover:border-white/30'}`}>{m} min</button>
            ))}
          </div>
        )}
        {!started ? <button className="btn" onClick={begin}>Start session</button>
          : status === 'idle' && sttSupported && <button className="rounded-xl border border-white/20 px-3 py-1 text-sm transition-colors hover:bg-white/10" onClick={() => { silent.current = 0; listen() }}>🎤 Tap to talk</button>}
      </div>

      <div className="max-h-80 min-h-32 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3" aria-live="polite">
        {entries.length === 0 && <p className="text-sm text-slate-500">The transcript appears here as you talk.</p>}
        {entries.map((e, i) => (
          <div key={i} className={`msg-in flex ${e.role === 'user' ? 'justify-end' : ''}`}>
            <p className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${e.role === 'user' ? 'rounded-br-md bg-gradient-to-br from-indigo-500/50 to-pink-500/30' : 'rounded-bl-md bg-white/8'}`}>{e.text}</p>
          </div>
        ))}
        {interim && <p className="text-right text-sm italic text-slate-500">{interim}…</p>}
        <div ref={bottom} />
      </div>

      {started && (
        <form onSubmit={submitTyped} className="flex gap-2">
          <input className="input" placeholder="Or type your reply…" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <button className="btn" disabled={!typed.trim() || status === 'thinking'}>Send</button>
        </form>
      )}
      {started && <button className="w-full rounded-lg border border-slate-600 py-2 hover:border-indigo-400 disabled:opacity-40" disabled={userTurns < 1 || status === 'thinking'} onClick={end}>
        {p.endLabel}{userTurns < 1 && ' (answer at least one question first)'}</button>}
    </div>
  )
}
