import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '../components/Layout'
import { Card, ErrorBox, Spinner } from '../components/ui'
import { supabase } from '../lib/supabase'

interface Snap { display_name: string | null; goal_title: string | null; created_at: string; entries: { date: string; type: string; skill: string | null; evidence: string }[] }
const TONE: Record<string, string> = { 'Explain-back passed': 'text-indigo-300', 'Simulation passed': 'text-emerald-300', 'Peer taught': 'text-sky-300', Practice: 'text-slate-300' }

/** Public, read-only proof page: a snapshot the owner chose to publish. Works without signing in. */
export default function PublicProof() {
  const { slug } = useParams()
  const [snap, setSnap] = useState<Snap | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    supabase.from('shared_proofs').select('display_name, goal_title, created_at, entries').eq('slug', slug!).maybeSingle()
      .then(({ data, error }) => { if (error) setError(error.message); else if (!data) setError('This proof page does not exist or was removed.'); else setSnap(data as Snap) })
  }, [slug])
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5"><Link to="/" className="flex items-center gap-2 font-display text-lg font-bold"><Logo /><span className="gradient-text">LearnLoop</span></Link>
        <Link to="/auth?mode=signup" className="btn !py-1.5 text-sm">Build your own</Link></header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 pb-16">
        {error ? <ErrorBox message={error} /> : !snap ? <Spinner /> : (<div className="stagger space-y-4">
          <div className="glass border-beam rounded-3xl p-6 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">Verified skill provenance</p>
            <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{snap.display_name || 'A LearnLoop learner'}</h1>
            <p className="text-lg text-slate-300">{snap.goal_title}</p>
            <p className="mt-2 text-sm text-slate-500">{snap.entries.length} verified entries · published {new Date(snap.created_at).toLocaleDateString()}</p>
          </div>
          {snap.entries.map((e, i) => (
            <Card key={i} className="!p-4"><div className="flex flex-wrap items-center gap-2 text-sm"><span className={`chip ${TONE[e.type] ?? ''}`}>{e.type}</span>{e.skill && <b>{e.skill}</b>}<span className="ml-auto text-slate-500">{e.date}</span></div>
              <p className="mt-1.5 text-sm text-slate-300">{e.evidence}</p></Card>))}
          <p className="pt-2 text-center text-xs text-slate-500">Each entry was recorded by LearnLoop when the learner passed a practice check, simulation or peer session. This page is a snapshot chosen by its owner.</p>
        </div>)}
      </main>
    </div>
  )
}
