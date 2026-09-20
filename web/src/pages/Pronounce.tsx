import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Empty, ErrorBox, Gauge, CountUp, Spinner } from '../components/ui'
import { pronPhrases } from '../lib/ai'
import { fireConfetti } from '../lib/confetti'
import { useGoalData } from '../lib/goalData'
import { levelFromMastery } from '../lib/scoring'
import { diffWords, pronScore } from '../lib/similarity'
import { createRecognizer, speak, stopSpeaking, sttSupported, type Recognizer } from '../lib/speech'

interface Phrase { text: string; meaning: string; focus: string }

/** Say it, get scored: speech-to-text output is compared to the target phrase, word by word. */
export default function Pronounce() {
  const { goal, skills, states, effective } = useGoalData()
  const [lang, setLang] = useState('en-US')
  const [phrases, setPhrases] = useState<Phrase[] | null>(null)
  const [i, setI] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  const [heard, setHeard] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [typed, setTyped] = useState('')
  const rec = useRef<Recognizer | null>(null)
  useEffect(() => () => { rec.current?.stop(); stopSpeaking() }, [])

  const avg = states.size ? [...states.values()].reduce((a, s) => a + s.mastery_score, 0) / states.size : 0
  const level = states.size ? levelFromMastery(avg) : goal.declared_level ?? 'beginner'

  async function generate() {
    setBusy(true); setError('')
    try {
      const weak = [...skills].sort((a, b) => effective(a.id) - effective(b.id)).slice(0, 3).map((s) => s.skill_name)
      const r = await pronPhrases({ goal_title: goal.goal_title, level, weak })
      setPhrases(r.phrases); setLang(r.lang); setI(0); setScores([]); setHeard(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create phrases') }
    setBusy(false)
  }

  function score(text: string) { setHeard(text); setListening(false) }
  function listen() {
    setError(''); setHeard(null); stopSpeaking()
    rec.current?.stop()
    rec.current = createRecognizer(lang, {
      onFinal: score,
      onError: (c) => { setListening(false); setError(c === 'not-allowed' ? 'Microphone permission was denied. Allow it in your browser, or type below.' : c === 'no-speech' ? "I didn't hear anything — try again." : `Speech error: ${c}`) },
      onEnd: () => setListening(false),
    })
    rec.current.start(); setListening(true)
  }
  const target = phrases?.[i]
  const s = heard !== null && target ? pronScore(target.text, heard) : null
  const finished = phrases && scores.length === phrases.length
  const mean = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

  function next() {
    if (s === null) return
    const all = [...scores, s]; setScores(all); setHeard(null); setTyped('')
    if (all.length === phrases!.length) { if (all.reduce((a, b) => a + b, 0) / all.length >= 85) fireConfetti() } else setI(i + 1)
  }

  return (
    <div className="stagger mx-auto max-w-xl space-y-4">
      <div><h1 className="font-display text-3xl font-bold">Pronunciation</h1>
        <p className="text-sm text-slate-400">Listen, say it aloud, and get scored word by word. Phrases match your {level} level{goal.domain_type !== 'language' ? ' — built for language goals, but works for any spoken practice.' : '.'}</p></div>
      {!sttSupported && <ErrorBox message="This browser has no speech recognition (use Chrome or Edge). You can still type what you'd say to test the scoring." />}
      {error && <ErrorBox message={error} />}

      {!phrases ? (
        <Empty title="Ready to practice speaking?" hint="AI writes 6 short phrases targeted at your weakest areas.">
          <button className="btn" disabled={busy} onClick={generate}>{busy ? 'Writing phrases…' : 'Generate phrases'}</button>{busy && <Spinner label="Creating your drill…" />}</Empty>
      ) : finished ? (
        <Card className="text-center">
          <Gauge value={mean} size={150}><div><p className="font-display text-5xl font-bold leading-none"><CountUp value={mean} /></p><p className="text-xs text-slate-500">avg score</p></div></Gauge>
          <p className="mt-3 font-display text-xl">{mean >= 85 ? 'Excellent pronunciation! 🎉' : mean >= 65 ? 'Good progress — keep at it' : 'Keep practicing — repetition works'}</p>
          <div className="mt-3 space-y-1 text-left text-sm">{phrases.map((p, n) => <p key={n} className="flex justify-between gap-2 rounded-lg bg-white/[.04] px-3 py-1.5"><span className="truncate">{p.text}</span><b className={scores[n] >= 80 ? 'text-emerald-300' : scores[n] >= 55 ? 'text-amber-300' : 'text-red-300'}>{scores[n]}</b></p>)}</div>
          <div className="mt-4 flex justify-center gap-2"><button className="btn" onClick={generate} disabled={busy}>New phrases</button><Link className="rounded-xl border border-white/15 px-4 py-2" to={`/g/${goal.id}/dashboard`}>Dashboard</Link></div>
        </Card>
      ) : target && (
        <div key={i} className="page-in space-y-3">
          <div className="flex justify-between text-xs text-slate-400"><span>Phrase {i + 1} of {phrases.length}</span><span>{target.focus}</span></div>
          <div className="glass border-beam rounded-3xl p-6 text-center">
            <p className="font-display text-3xl font-bold leading-snug">
              {heard !== null ? diffWords(target.text, heard).map((w, n) => <span key={n} className={w.ok ? 'text-emerald-300' : 'text-red-300 underline decoration-wavy'}>{w.word} </span>) : target.text}</p>
            <p className="mt-2 text-slate-400">{target.meaning}</p>
            {heard !== null && <div className="pop mt-4 border-t border-white/10 pt-4"><p className="text-xs uppercase tracking-widest text-slate-500">I heard</p><p className="italic">“{heard || '…'}”</p>
              <p className={`mt-2 font-display text-4xl font-bold ${s! >= 80 ? 'text-emerald-300' : s! >= 55 ? 'text-amber-300' : 'text-red-300'}`}>{s}<span className="text-base text-slate-500">/100</span></p></div>}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="rounded-xl border border-white/15 px-4 py-2.5 hover:bg-white/10" onClick={() => speak(target.text, lang, () => {})}>🔊 Listen</button>
            {sttSupported && <button className={`btn ${listening ? '!bg-red-500' : ''}`} onClick={listening ? () => rec.current?.stop() : listen}>{listening ? '● Listening… tap to stop' : heard !== null ? '🎤 Try again' : '🎤 Say it'}</button>}
            {heard !== null && <button className="btn" onClick={next}>{i + 1 === phrases.length ? 'Finish' : 'Next →'}</button>}
          </div>
          {!sttSupported && <div className="flex gap-2"><input className="input" placeholder="Type what you would say…" value={typed} onChange={(e) => setTyped(e.target.value)} /><button className="btn" disabled={!typed.trim()} onClick={() => score(typed)}>Score</button></div>}
        </div>
      )}
    </div>
  )
}
