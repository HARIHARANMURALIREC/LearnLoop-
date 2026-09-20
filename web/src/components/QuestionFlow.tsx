import { useState } from 'react'
import { classifyError } from '../lib/ai'
import type { ErrorType, Question } from '../lib/types'
import { ErrorBox } from './ui'

export interface QuestionResult { selected: number; correct: boolean; confidence: number; errorType: ErrorType | null }

const REASONS = [
  { key: 'guessed', label: 'I guessed' },
  { key: 'misread', label: 'I misread it' },
  { key: "didn't know", label: "I didn't know" },
] as const
// Used only if the classifier call fails, so a network blip never blocks the learner.
const FALLBACK: Record<string, ErrorType> = { guessed: 'concept_gap', misread: 'misread', "didn't know": 'concept_gap' }

/** One question: confidence is captured BEFORE correctness is revealed; wrong answers get a 1-tap reason + AI error classification. */
export default function QuestionFlow({ q, onDone }: { q: Question; onDone: (r: QuestionResult) => void }) {
  const [sel, setSel] = useState<number | null>(null)
  const [conf, setConf] = useState(3)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState('')
  const correct = sel === q.correct_index

  async function pickReason(reason: string) {
    setBusy(true); setWarn('')
    let errorType: ErrorType
    try {
      errorType = (await classifyError({ question: q.question, answer_given: q.options[sel!], correct_answer: q.options[q.correct_index], reason })).error_type
    } catch { errorType = FALLBACK[reason]; setWarn('Classifier unavailable — used a default.') }
    onDone({ selected: sel!, correct: false, confidence: conf, errorType })
  }

  return (
    <div className="stagger space-y-4">
      <p className="fade-up font-display text-xl leading-snug">{q.question}</p>
      <div className="space-y-2" role="radiogroup">
        {q.options.map((o, i) => {
          const state = !revealed ? (sel === i ? 'border-indigo-400 bg-indigo-500/25 shadow-[0_0_24px_-8px_#7c5cff] scale-[1.01]' : 'border-white/10 bg-white/[.03] hover:border-white/30 hover:bg-white/[.06]')
            : i === q.correct_index ? 'pop border-emerald-400 bg-emerald-500/20'
            : i === sel ? 'pop border-red-400 bg-red-500/20' : 'border-white/5 opacity-50'
          return (
            <button key={i} role="radio" aria-checked={sel === i} disabled={revealed} onClick={() => setSel(i)}
              className={`msg-in w-full rounded-xl border px-4 py-2.5 text-left transition-all duration-300 ${state}`} style={{ animationDelay: `${i * 70}ms` }}>{o}</button>
          )
        })}
      </div>

      {!revealed ? (
        <>
          <label className="block text-sm text-slate-400">
            How sure are you? <span className="text-slate-100 font-medium">{conf}/5</span>
            <input type="range" min={1} max={5} value={conf} onChange={(e) => setConf(+e.target.value)} className="w-full accent-indigo-400" />
            <span className="flex justify-between text-xs"><span>Guessing</span><span>Certain</span></span>
          </label>
          <button className="btn w-full" disabled={sel === null} onClick={() => setRevealed(true)}>Lock in answer</button>
        </>
      ) : correct ? (
        <div className="space-y-3">
          <p className="text-emerald-400 font-medium">Correct!</p>
          <button className="btn w-full" onClick={() => onDone({ selected: sel!, correct: true, confidence: conf, errorType: null })}>Continue</button>
        </div>
      ) : (
        <div className="space-y-3">
          {conf >= 4 && (
            <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-2 text-sm text-amber-300">
              ⚠ You were confident and wrong — that's the most valuable thing to fix. It's been flagged.
            </p>
          )}
          <p className="text-red-400 font-medium">Not quite. What happened?</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r.key} disabled={busy} onClick={() => pickReason(r.key)}
                className="rounded-lg border border-slate-600 px-3 py-1.5 hover:border-indigo-400 disabled:opacity-50">{r.label}</button>
            ))}
          </div>
          {busy && <p className="text-sm text-slate-400 animate-pulse">Analysing…</p>}
          {warn && <ErrorBox message={warn} />}
        </div>
      )}
    </div>
  )
}
