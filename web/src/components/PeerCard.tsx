import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { peerQuestions } from '../lib/ai'
import { levelFromMastery } from '../lib/scoring'
import { supabase } from '../lib/supabase'
import type { Level } from '../lib/types'
import { Card, ErrorBox } from './ui'

export interface PeerSession { id: string; interviewer_id: string; interviewee_id: string; status: 'open' | 'done'; evaluation: { score: number } | null; created_at: string }
interface Props { goalId: string; podId: string; goalTitle: string; uid: string; members: { id: string; name: string; weak: string[]; avg: number }[]; sessions: PeerSession[] }

/** Start a peer mock interview: you interview a pod-mate using AI questions aimed at THEIR weak skills. */
export default function PeerCard({ goalId, podId, goalTitle, uid, members, sessions }: Props) {
  const nav = useNavigate()
  const others = members.filter((m) => m.id !== uid)
  const [partner, setPartner] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? 'Member'
  const target = others.find((m) => m.id === (partner || others[0]?.id))

  async function start() {
    if (!target) return
    setBusy(true); setError('')
    try {
      const level: Level = levelFromMastery(target.avg)
      const { questions } = await peerQuestions({ goal_title: goalTitle, level, weak: target.weak })
      const { data, error } = await supabase.from('peer_sessions').insert({ pod_id: podId, interviewer_id: uid, interviewee_id: target.id, questions }).select('id').single()
      if (error) throw error
      nav(`/g/${goalId}/pods/${podId}/peer/${data.id}`)
    } catch (e) { setError(e instanceof Error ? e.message : (e as { message: string }).message); setBusy(false) }
  }

  return (
    <Card title="🎤 Peer mock interview">
      {others.length === 0 ? <p className="text-sm text-slate-400">Invite a friend with your join code to run a peer mock interview together.</p> : (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">You interview a pod-mate live, using AI-written questions aimed at <i>their</i> weakest skills. When you finish, AI scores their answers and your questioning.</p>
          <div className="flex flex-wrap gap-2">
            <select className="input !w-auto min-w-40" value={target?.id ?? ''} onChange={(e) => setPartner(e.target.value)}>{others.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <button className="btn" disabled={busy} onClick={start}>{busy ? 'Preparing questions…' : `Interview ${target?.name ?? ''}`}</button>
          </div>
        </div>)}
      {error && <ErrorBox message={error} />}
      {sessions.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-sm">
          {sessions.slice(0, 6).map((s) => {
            const mine = s.interviewer_id === uid || s.interviewee_id === uid
            return (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[.04] px-3 py-2">
                <span>{name(s.interviewer_id)} <span className="text-slate-500">interviewing</span> {name(s.interviewee_id)}</span>
                {mine ? <Link className="text-indigo-300 hover:underline" to={`/g/${goalId}/pods/${podId}/peer/${s.id}`}>{s.status === 'done' ? `Score ${Math.round(s.evaluation?.score ?? 0)} →` : s.interviewee_id === uid ? 'Join now →' : 'Continue →'}</Link>
                  : <span className="text-slate-500">{s.status === 'done' ? 'finished' : 'in progress'}</span>}
              </li>)
          })}
        </ul>)}
    </Card>
  )
}
