import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, Empty, ErrorBox, Spinner } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useGoalData } from '../lib/goalData'
import { supabase } from '../lib/supabase'

interface PodRow { id: string; pod_name: string; join_code: string; goal_id: string; goals: { goal_title: string } | null }

export default function Pods() {
  const { goal } = useGoalData()
  const { session } = useAuth()
  const uid = session!.user.id
  const nav = useNavigate()
  const [pods, setPods] = useState<PodRow[] | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const owned = goal.user_id === uid

  useEffect(() => {
    supabase.from('pods').select('id, pod_name, join_code, goal_id, goals(goal_title)').order('created_at', { ascending: false })
      .then(({ data, error }) => { if (error) setError(error.message); setPods((data as unknown as PodRow[]) ?? []) })
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    const { data, error } = await supabase.rpc('create_pod', { p_name: name.trim(), p_goal: goal.id })
    setBusy(false)
    if (error) return setError(error.message)
    nav(`/g/${goal.id}/pods/${(data as { id: string }).id}`)
  }

  async function join(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    const { data: podId, error } = await supabase.rpc('join_pod_by_code', { code: code.trim() })
    if (error) { setBusy(false); return setError(error.message.includes('Invalid') ? 'No pod with that code.' : error.message) }
    const { data: pod } = await supabase.from('pods').select('goal_id').eq('id', podId).single()
    // A joiner needs their own skill_states for the pod's skill map -> diagnostic first if they have none.
    const { data: skills } = await supabase.from('skills').select('id').eq('goal_id', pod!.goal_id)
    const { count } = await supabase.from('skill_states').select('id', { count: 'exact', head: true }).eq('user_id', uid).in('skill_id', (skills ?? []).map((s) => s.id))
    setBusy(false)
    nav(count ? `/g/${pod!.goal_id}/pods/${podId}` : `/g/${pod!.goal_id}/diagnostic`)
  }

  return (
    <div className="stagger space-y-4">
      <h1 className="font-display text-3xl font-bold">Study pods</h1>
      {error && <ErrorBox message={error} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title={`Create a pod for “${goal.goal_title}”`}>
          {owned ? (
            <form onSubmit={create} className="space-y-2">
              <input className="input" placeholder="Pod name" required value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn w-full" disabled={busy}>Create & get join code</button>
            </form>
          ) : <p className="text-sm text-slate-400">Only the goal's owner can create a pod for it.</p>}
        </Card>
        <Card title="Join with a code">
          <form onSubmit={join} className="space-y-2">
            <input className="input uppercase tracking-widest" placeholder="ABC123" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn w-full" disabled={busy}>Join pod</button>
          </form>
        </Card>
      </div>
      <Card title="Your pods">
        {!pods ? <Spinner /> : pods.length === 0 ? <Empty title="No pods yet" hint="Create one and share the code with friends learning the same thing." /> : (
          <ul className="space-y-2">
            {pods.map((p) => (
              <li key={p.id}><Link className="flex justify-between rounded-lg border border-white/10 bg-white/[.03] p-3 lift" to={`/g/${p.goal_id}/pods/${p.id}`}>
                <span>{p.pod_name} <span className="text-slate-500 text-sm">· {p.goals?.goal_title}</span></span>
                <span className="font-mono text-slate-400">{p.join_code}</span></Link></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
