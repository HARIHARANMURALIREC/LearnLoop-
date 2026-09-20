import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Empty, ErrorBox, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'
import { fireConfetti } from '../lib/confetti'
import { useGoalData } from '../lib/goalData'
import { BOX_DAYS, isMastered, review } from '../lib/srs'
import { supabase } from '../lib/supabase'

interface Card_ { id: string; skill_id: string | null; question_text: string; correct_answer: string; wrong_answer: string | null; box: number; reps: number; lapses: number; due_at: string }

/** Leitner flashcards built from questions you missed. Known cards return after longer and longer gaps. */
export default function Flashcards() {
  const { goal, skills } = useGoalData()
  const { session } = useAuth()
  const [cards, setCards] = useState<Card_[] | null>(null)
  const [error, setError] = useState('')
  const [shown, setShown] = useState(false)
  const [tally, setTally] = useState({ got: 0, again: 0 })
  const [started, setStarted] = useState(false)
  const name = new Map(skills.map((s) => [s.id, s.skill_name]))

  const load = useCallback(async () => {
    const ids = skills.map((s) => s.id)
    const { data, error } = await supabase.from('flashcards').select('*').eq('user_id', session!.user.id).in('skill_id', ids).order('due_at')
    if (error) setError(error.message); else setCards(data as Card_[])
  }, [skills, session])
  useEffect(() => { load() }, [load])

  if (error) return <ErrorBox message={error} />
  if (!cards) return <Spinner />
  const now = Date.now()
  const due = cards.filter((c) => new Date(c.due_at).getTime() <= now)
  const mastered = cards.filter((c) => isMastered(c.box)).length
  const current = due[0]

  async function answer(gotIt: boolean) {
    const c = current!
    const next = review(c, gotIt)
    setShown(false); setTally((t) => ({ got: t.got + (gotIt ? 1 : 0), again: t.again + (gotIt ? 0 : 1) }))
    setCards((prev) => prev!.map((x) => (x.id === c.id ? { ...x, ...next } : x))) // optimistic; due card leaves the queue immediately
    await supabase.from('flashcards').update(next).eq('id', c.id)
    if (due.length === 1) fireConfetti(90)
  }

  return (
    <div className="stagger mx-auto max-w-xl space-y-4">
      <div><h1 className="font-display text-3xl font-bold">Flashcards</h1><p className="text-sm text-slate-400">Every question you miss becomes a card. Get it right and it comes back later; miss it and it returns tomorrow.</p></div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[['Due now', due.length, 'text-amber-300'], ['Total', cards.length, 'text-slate-100'], ['Mastered', mastered, 'text-emerald-300']].map(([l, n, c]) => (
          <div key={l as string} className="glass rounded-2xl p-3"><p className={`font-display text-3xl font-bold ${c}`}>{n as number}</p><p className="text-xs text-slate-400">{l}</p></div>))}
      </div>

      {cards.length === 0 ? <Empty title="No flashcards yet" hint="Answer a question wrong in the diagnostic, practice or review and it lands here automatically."><Link className="btn inline-block" to={`/g/${goal.id}/practice`}>Go practice</Link></Empty>
      : !due.length ? <Empty title="All caught up 🎉" hint={`Next card due ${new Date(cards.map((c) => c.due_at).sort()[0]).toLocaleDateString()}.${tally.got + tally.again ? ` This session: ${tally.got} known, ${tally.again} to retry.` : ''}`} />
      : !started ? (
        <Card className="text-center"><p className="font-display text-2xl font-bold">{due.length} card{due.length > 1 ? 's' : ''} ready</p><p className="mb-4 text-sm text-slate-400">About {Math.max(1, Math.round(due.length * 0.4))} min</p><button className="btn" onClick={() => setStarted(true)}>Start reviewing</button></Card>
      ) : current && (
        <div key={current.id} className="page-in space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400"><span>{name.get(current.skill_id ?? '') ?? 'Skill'}</span><span>Box {current.box}/5 · {due.length} left</span></div>
          <div className="glass border-beam rounded-3xl p-6"><p className="font-display text-xl leading-snug">{current.question_text}</p>
            {shown && <div className="pop mt-5 space-y-2 border-t border-white/10 pt-4">
              <p className="text-xs uppercase tracking-widest text-emerald-300">Answer</p><p className="text-lg">{current.correct_answer}</p>
              {current.wrong_answer && <p className="text-sm text-slate-500">You said: <span className="line-through">{current.wrong_answer}</span></p>}</div>}</div>
          {!shown ? <button className="btn w-full" onClick={() => setShown(true)}>Show answer</button> : (
            <div className="grid grid-cols-2 gap-3">
              <button className="rounded-xl border border-red-400/40 bg-red-500/10 py-3 font-medium text-red-300 transition hover:bg-red-500/20" onClick={() => answer(false)}>Again <span className="text-xs opacity-70">· tomorrow</span></button>
              <button className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 py-3 font-medium text-emerald-300 transition hover:bg-emerald-500/20" onClick={() => answer(true)}>Got it <span className="text-xs opacity-70">· in {BOX_DAYS[Math.min(4, current.box)]}d</span></button>
            </div>)}
        </div>
      )}
    </div>
  )
}
