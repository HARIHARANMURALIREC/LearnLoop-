import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TransferPanel from '../components/TransferPanel'
import { generateSkillMap } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { FIELDS } from '../lib/fields'
import { supabase } from '../lib/supabase'
import type { DomainType, Level, SkillDraft } from '../lib/types'

const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced']

export default function Onboarding() {
  const { session } = useAuth()
  const nav = useNavigate()
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState<Level>('beginner')
  const [map, setMap] = useState<{ domain_type: DomainType; skills: SkillDraft[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [field, setField] = useState('')
  const ideas = FIELDS.find((x) => x.name === field)?.ideas ?? []

  useEffect(() => {
    if (!session) return
    supabase.from('profiles').select('field').eq('id', session.user.id).single().then(({ data }) => { if (data?.field) setField(data.field) })
  }, [session])

  function pickField(f: string) {
    setField(f)
    if (session) supabase.from('profiles').update({ field: f }).eq('id', session.user.id).then(() => {})
  }

  async function generate() {
    setBusy(true); setError('')
    try { setMap(await generateSkillMap(title.trim(), level)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to generate skill map') }
    setBusy(false)
  }

  async function start() {
    if (!map || !session) return
    setBusy(true); setError('')
    const { data: goal, error: gErr } = await supabase.from('goals')
      .insert({ user_id: session.user.id, goal_title: title.trim(), domain_type: map.domain_type, declared_level: level })
      .select().single()
    if (gErr) { setError(gErr.message); setBusy(false); return }
    const { error: sErr } = await supabase.from('skills')
      .insert(map.skills.map((s) => ({ ...s, goal_id: goal.id })))
    if (sErr) {
      await supabase.from('goals').delete().eq('id', goal.id) // don't leave a goal with no skills
      setError(sErr.message); setBusy(false); return
    }
    nav(`/g/${goal.id}/diagnostic`)
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden p-4">
      <div className="pointer-events-none absolute left-1/4 top-10 h-72 w-72 animate-float rounded-full bg-indigo-500/20 blur-3xl" />
      <div key={map ? 'preview' : 'form'} className="glass page-in relative w-full max-w-xl space-y-6 rounded-3xl p-6 sm:p-8">
        {!map ? (
          <>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">What are you learning to <span className="gradient-text">become</span>?</h1>
            <div className="relative">
              <select className="input appearance-none !pr-10" value={field} onChange={(e) => pickField(e.target.value)} aria-label="Your field">
                <option value="" disabled>Choose your field…</option>
                {FIELDS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </div>
            <input className="input" placeholder="e.g. Frontend Developer, Conversational Spanish, Digital Marketing"
              value={title} onChange={(e) => setTitle(e.target.value)} />
            {ideas.length > 0 && (
              <div className="-mt-3 flex flex-wrap gap-2">
                {ideas.map((i) => <button key={i} onClick={() => setTitle(i)} className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300 transition-colors hover:border-indigo-400 hover:text-white">{i}</button>)}
              </div>
            )}
            <div>
              <p className="mb-2 text-slate-400">Where are you starting from?</p>
              <div className="flex gap-2">
                {LEVELS.map((l) => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={`flex-1 rounded-xl border px-3 py-2 capitalize transition-all duration-300 ${level === l ? 'border-indigo-400 bg-indigo-500/25 shadow-[0_0_24px_-6px_#7c5cff] scale-[1.03]' : 'border-white/10 hover:border-white/30'}`}>{l}</button>
                ))}
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button className="btn w-full" disabled={busy || title.trim().length < 3} onClick={generate}>
              {busy ? 'Building your skill map…' : 'Generate skill map'}
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-bold">Your skill map for <span className="gradient-text">{title}</span></h1>
            <p className="text-slate-400 text-sm capitalize">{map.domain_type} goal · starting {level}</p>
            <ul className="stagger space-y-2">
              {map.skills.map((s) => (
                <li key={s.skill_name} className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                  <div className="flex justify-between"><span>{s.skill_name}</span><span className="text-slate-400 text-sm">weight {Math.round(s.weight * 100)}%</span></div>
                  <div className="mt-2 h-1.5 rounded bg-white/10"><div className="bar h-full rounded bg-gradient-to-r from-indigo-500 to-pink-400" style={{ width: `${s.weight * 100}%` }} /></div>
                </li>
              ))}
            </ul>
            <TransferPanel goalTitle={title} skills={map.skills.map((s) => s.skill_name)} />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-2">
              <button className="rounded-xl border border-white/15 px-4 transition-colors hover:bg-white/5" onClick={() => setMap(null)}>Back</button>
              <button className="btn flex-1" disabled={busy} onClick={start}>{busy ? 'Saving…' : 'Start diagnostic'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
