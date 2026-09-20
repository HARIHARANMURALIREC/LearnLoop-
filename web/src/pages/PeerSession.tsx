import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import MicButton from '../components/MicButton'
import { Card, ErrorBox, Spinner } from '../components/ui'
import { peerEval } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { fireConfetti } from '../lib/confetti'
import { useGoalData } from '../lib/goalData'
import { supabase } from '../lib/supabase'

interface Msg { id: string; sender_id: string; role: 'interviewer' | 'interviewee'; text: string; created_at: string }
interface Evaluation { score: number; summary: string; strengths: string[]; improvements: string[]; interviewer_feedback: string }
interface Session { id: string; pod_id: string; interviewer_id: string; interviewee_id: string; status: 'open' | 'done'; questions: { q: string; listen_for: string; skill: string }[]; evaluation: Evaluation | null }

/** Live two-person interview room over Supabase Realtime. Interviewer gets AI questions + "listen for" hints. */
export default function PeerSession() {
  const { podId, sessionId } = useParams()
  const { goal } = useGoalData()
  const { session: auth } = useAuth()
  const uid = auth!.user.id
  const [s, setS] = useState<Session | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [ending, setEnding] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  const role = s ? (s.interviewer_id === uid ? 'interviewer' : s.interviewee_id === uid ? 'interviewee' : null) : null

  const load = useCallback(async () => {
    const [ss, mm, pm] = await Promise.all([
      supabase.from('peer_sessions').select('*').eq('id', sessionId!).maybeSingle(),
      supabase.from('peer_messages').select('*').eq('session_id', sessionId!).order('created_at'),
      supabase.from('pod_members').select('user_id, profiles(display_name)').eq('pod_id', podId!),
    ])
    if (ss.error || !ss.data) return setError(ss.error?.message ?? 'Session not found')
    setS(ss.data as Session); setMsgs((mm.data as Msg[]) ?? [])
    setNames(Object.fromEntries((pm.data as unknown as { user_id: string; profiles: { display_name: string } | null }[] ?? []).map((m) => [m.user_id, m.profiles?.display_name ?? 'Member'])))
  }, [sessionId, podId])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase.channel(`peer:${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'peer_messages', filter: `session_id=eq.${sessionId}` },
        (p) => setMsgs((prev) => (prev.some((m) => m.id === (p.new as Msg).id) ? prev : [...prev, p.new as Msg])))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'peer_sessions', filter: `id=eq.${sessionId}` }, (p) => setS((prev) => (prev ? { ...prev, ...(p.new as Session) } : prev)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [sessionId])
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  // The interviewee records their own proof (RLS only lets you write your own ledger rows); idempotent per session.
  useEffect(() => {
    if (!s?.evaluation || s.status !== 'done' || role !== 'interviewee' || s.evaluation.score < 70) return
    supabase.from('proof_ledger').select('id').eq('user_id', uid).ilike('evidence_summary', `%${s.id}%`).limit(1).then(async ({ data }) => {
      if (data?.length) return
      await supabase.from('proof_ledger').insert({ user_id: uid, proof_type: 'simulation_passed', evidence_summary: `Peer mock interview for ${goal.goal_title}: scored ${Math.round(s.evaluation!.score)}/100 (session ${s.id}).` })
      fireConfetti()
    })
  }, [s, role, uid, goal.goal_title])

  async function send(t: string) {
    if (!t.trim() || !role) return
    const { data, error } = await supabase.from('peer_messages').insert({ session_id: sessionId, sender_id: uid, role, text: t.trim() }).select().single()
    if (error) return setError(error.message)
    setMsgs((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Msg]))
  }
  function submit(e: FormEvent) { e.preventDefault(); send(text); setText('') }

  async function end() {
    setEnding(true); setError('')
    try {
      const ev = await peerEval({ goal_title: goal.goal_title, messages: msgs.map((m) => ({ role: m.role, text: m.text })) })
      const { error } = await supabase.from('peer_sessions').update({ status: 'done', evaluation: ev }).eq('id', sessionId!)
      if (error) throw error
      setS((prev) => (prev ? { ...prev, status: 'done', evaluation: ev } : prev))
    } catch (e) { setError(e instanceof Error ? e.message : (e as { message: string }).message) }
    setEnding(false)
  }

  const asked = useMemo(() => new Set(msgs.filter((m) => m.role === 'interviewer').map((m) => m.text)), [msgs])
  if (error && !s) return <ErrorBox message={error} />
  if (!s) return <Spinner />
  if (!role) return <ErrorBox message="Only the two participants can open this interview." />
  const answers = msgs.filter((m) => m.role === 'interviewee').length

  return (
    <div className="stagger mx-auto max-w-2xl space-y-4">
      <div><Link to={`/g/${goal.id}/pods/${podId}`} className="text-sm text-slate-400 hover:text-white">← Pod</Link>
        <h1 className="font-display text-3xl font-bold">Peer mock interview</h1>
        <p className="text-sm text-slate-400">{names[s.interviewer_id]} <span className="text-slate-600">interviews</span> {names[s.interviewee_id]} · you are the <b className="text-indigo-300">{role}</b></p></div>
      {error && <ErrorBox message={error} />}

      {s.status === 'done' && s.evaluation ? (
        <Card title="Result" className="!border-emerald-400/30">
          <p className="font-display text-5xl font-bold">{Math.round(s.evaluation.score)}<span className="text-lg text-slate-500">/100</span></p>
          <p className="mt-2 text-sm">{s.evaluation.summary}</p>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><p className="font-medium text-emerald-300">Strengths</p><ul className="list-disc pl-4 text-slate-300">{s.evaluation.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
            <div><p className="font-medium text-amber-300">To improve</p><ul className="list-disc pl-4 text-slate-300">{s.evaluation.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul></div></div>
          <p className="mt-3 rounded-xl bg-white/[.05] p-3 text-sm"><b>Interviewer feedback:</b> {s.evaluation.interviewer_feedback}</p>
          {role === 'interviewee' && s.evaluation.score >= 70 && <p className="mt-2 text-sm text-emerald-300">✓ Passed — logged to your Proof of Work.</p>}
        </Card>
      ) : role === 'interviewer' && (
        <Card title="Your question bank (AI, aimed at their weak skills)">
          <ul className="space-y-2">{s.questions.map((q, i) => (
            <li key={i} className={`rounded-xl border p-3 text-sm ${asked.has(q.q) ? 'border-white/5 opacity-50' : 'border-white/10 bg-white/[.03]'}`}>
              <p>{q.q}</p><p className="mt-1 text-xs text-slate-500">👂 Listen for: {q.listen_for}</p>
              <button className="mt-2 rounded-lg border border-indigo-400/40 px-3 py-1 text-xs text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-40" disabled={asked.has(q.q)} onClick={() => send(q.q)}>{asked.has(q.q) ? 'Asked ✓' : 'Ask this'}</button></li>))}</ul>
        </Card>)}

      <Card title="Conversation">
        <div className="max-h-96 min-h-40 space-y-2 overflow-y-auto pr-1" aria-live="polite">
          {msgs.length === 0 && <p className="text-sm text-slate-500">{role === 'interviewer' ? 'Ask your first question to begin.' : 'Waiting for the interviewer to ask the first question…'}</p>}
          {msgs.map((m) => <div key={m.id} className={`msg-in flex ${m.sender_id === uid ? 'justify-end' : ''}`}><p className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.sender_id === uid ? 'bg-gradient-to-br from-indigo-500/50 to-pink-500/30' : 'bg-white/[.08]'}`}><span className="block text-[10px] uppercase tracking-wider opacity-60">{m.role}</span>{m.text}</p></div>)}
          <div ref={bottom} />
        </div>
        {s.status === 'open' && (
          <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
            <input className="input min-w-0 flex-1" placeholder={role === 'interviewer' ? 'Ask a follow-up…' : 'Type or speak your answer…'} value={text} onChange={(e) => setText(e.target.value)} />
            {role === 'interviewee' && <MicButton onText={(t) => setText((p) => (p ? p + ' ' : '') + t)} onError={setError} />}
            <button className="btn" disabled={!text.trim()}>Send</button>
          </form>)}
        {s.status === 'open' && role === 'interviewer' && (
          <button className="mt-3 w-full rounded-xl border border-white/15 py-2 text-sm hover:bg-white/10 disabled:opacity-40" disabled={ending || answers < 2} onClick={end}>{ending ? 'Scoring the interview…' : answers < 2 ? 'End interview (need 2+ answers)' : 'End interview & get AI score'}</button>)}
      </Card>
    </div>
  )
}
