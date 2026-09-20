import { useEffect, useState } from 'react'
import { Card, Empty, ErrorBox, Spinner } from '../components/ui'
import { resumeAnalysis, type ResumeResult } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { useGoalData } from '../lib/goalData'
import { extractPdfText } from '../lib/pdf'
import { supabase } from '../lib/supabase'

const LV = ['beginner', 'intermediate', 'advanced']
const Chip = ({ l, tone }: { l: string | null; tone: string }) => <span className={`rounded px-1.5 py-0.5 text-xs capitalize ${tone}`}>{l ?? 'never practiced'}</span>

export default function Resume() {
  const { goal, skills, states, attempts } = useGoalData()
  const { session } = useAuth()
  const uid = session!.user.id
  const [text, setText] = useState('')
  const [result, setResult] = useState<ResumeResult | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { // show the latest saved analysis
    supabase.from('resume_analyses').select('*').eq('user_id', uid).eq('goal_id', goal.id).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { const r = data?.[0]; if (r) setResult({ verified: r.verified_claims, unclaimed_practiced: r.unclaimed_practiced, unproven: r.unproven_claims }) })
  }, [uid, goal.id])

  async function onFile(f: File | undefined) {
    if (!f) return
    setError(''); setBusy('Reading file…')
    try {
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      const extracted = isPdf ? await extractPdfText(f) : await f.text()
      if (extracted.length < 50) throw new Error('Could not read text from that file (scanned image PDFs are not supported). Paste the text instead.')
      setText(extracted)
      const path = `${uid}/${Date.now()}-${f.name.replace(/[^\w.-]/g, '_')}`
      const { error } = await supabase.storage.from('resumes').upload(path, f)
      if (error) setError(`Text extracted, but storing the file failed: ${error.message}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to read file') }
    setBusy('')
  }

  async function analyse() {
    setBusy('Comparing your resume to your tested skills…'); setError('')
    try {
      const counts = new Map<string, number>()
      attempts.forEach((a) => counts.set(a.skill_id, (counts.get(a.skill_id) ?? 0) + 1))
      const r = await resumeAnalysis({
        goal_title: goal.goal_title, resume_text: text,
        skills: skills.map((s) => ({ skill: s.skill_name, tested_level: states.get(s.id)?.current_level ?? null, mastery: Math.round(states.get(s.id)?.mastery_score ?? 0), attempts: counts.get(s.id) ?? 0 })),
      })
      setResult(r)
      await supabase.from('resume_analyses').insert({ user_id: uid, goal_id: goal.id, resume_text: text, verified_claims: r.verified, unclaimed_practiced: r.unclaimed_practiced, unproven_claims: r.unproven })
    } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed') }
    setBusy('')
  }

  return (
    <div className="stagger space-y-4">
      <h1 className="font-display text-3xl font-bold">Resume check</h1>
      <Card title="Your resume">
        <input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
        <textarea className="input mt-3 min-h-40" placeholder="…or paste your resume text here" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="mt-2 flex items-center gap-3"><button className="btn" disabled={!!busy || text.trim().length < 50} onClick={analyse}>Analyse against my skills</button>{busy && <Spinner label={busy} />}</div>
        {!states.size && <p className="mt-2 text-sm text-amber-300">You haven't taken the diagnostic yet, so everything will look unproven.</p>}
      </Card>
      {error && <ErrorBox message={error} />}
      {!result && !busy && <Empty title="No analysis yet" hint="Upload a resume to see what's verified, what you've practiced but not listed, and what's unproven." />}
      {result && (<>
        <Card title={`✅ Verified (${result.verified.length})`}>
          {result.verified.length === 0 ? <p className="text-sm text-slate-400">Nothing verified yet.</p> : <ul className="space-y-2 text-sm">{result.verified.map((v, i) => (
            <li key={i}><b>{v.skill}</b> <Chip l={v.tested_level} tone="bg-emerald-500/20 text-emerald-300" /> <span className="text-slate-400">{v.note}</span></li>))}</ul>}
        </Card>
        <Card title={`💡 Practiced but not on your resume (${result.unclaimed_practiced.length})`}>
          {result.unclaimed_practiced.length === 0 ? <p className="text-sm text-slate-400">Nothing missing.</p> : <ul className="space-y-3 text-sm">{result.unclaimed_practiced.map((u, i) => (
            <li key={i}><b>{u.skill}</b> <Chip l={u.tested_level} tone="bg-indigo-500/20 text-indigo-300" />
              <div className="mt-1 flex items-start gap-2 rounded bg-slate-800 p-2"><span className="flex-1">• {u.suggested_bullet}</span>
                <button className="text-xs text-slate-400 underline" onClick={() => navigator.clipboard?.writeText(u.suggested_bullet)}>Copy</button></div></li>))}</ul>}
        </Card>
        <Card title={`⚠️ Claimed but unproven (${result.unproven.length})`}>
          {result.unproven.length === 0 ? <p className="text-sm text-slate-400">Every claim checks out.</p> : <ul className="space-y-2 text-sm">{result.unproven.map((u, i) => (
            <li key={i} className={`rounded p-2 ${u.mismatch ? 'border border-amber-500/50 bg-amber-950/20' : ''}`}><b>{u.claim}</b>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-slate-400">Claimed:</span><Chip l={u.claimed_level ?? 'unspecified'} tone="bg-slate-700" />
                <span className="text-slate-400">Tested:</span><Chip l={u.tested_level} tone={u.mismatch ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700'} />
                {u.mismatch && u.claimed_level && u.tested_level && LV.indexOf(u.claimed_level) > LV.indexOf(u.tested_level) && <span className="text-amber-300">level mismatch</span>}</div>
              <p className="text-slate-400">{u.reason}</p></li>))}</ul>}
        </Card>
      </>)}
    </div>
  )
}
