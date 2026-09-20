import { useEffect, useState } from 'react'
import { learningResources } from '../lib/ai'
import { resourceUrl, TYPE_META, type Resource } from '../lib/resources'
import type { Level } from '../lib/types'
import { Card, ErrorBox, Spinner } from './ui'

/** Study path matched to the learner's current level for one skill. Cached per skill+level so it costs one AI call. */
export default function ResourcesCard({ skillId, goalTitle, skillName, level, gap }: { skillId: string; goalTitle: string; skillName: string; level: Level; gap?: string }) {
  const key = `resources:${skillId}:${level}`
  const [items, setItems] = useState<Resource[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try { const c = localStorage.getItem(key); setItems(c ? JSON.parse(c) : null) } catch { setItems(null) }
    setError('')
  }, [key])

  async function load() {
    setBusy(true); setError('')
    try {
      const r = (await learningResources({ goal_title: goalTitle, skill_name: skillName, level, gap })).resources
      setItems(r)
      try { localStorage.setItem(key, JSON.stringify(r)) } catch { /* cache is optional */ }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load resources') }
    setBusy(false)
  }

  return (
    <Card title={`📚 Study path · ${level}`}>
      {!items ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Get a handpicked path of videos, docs and practice matched to your <b className="capitalize text-slate-200">{level}</b> level in {skillName}.</p>
          <button className="btn" disabled={busy} onClick={load}>{busy ? 'Finding resources…' : 'Show my study path'}</button>
          {busy && <Spinner label="Curating for your level…" />}
        </div>
      ) : (
        <ol className="stagger space-y-2.5">
          {items.map((r, i) => (
            <li key={i}>
              <a href={resourceUrl(r)} target="_blank" rel="noopener noreferrer" className="lift group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.08] text-lg">{TYPE_META[r.type].icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500"><span className="font-semibold text-indigo-300">Step {i + 1}</span><span>{TYPE_META[r.type].label}</span><span>· {r.provider}</span><span>· ~{r.minutes} min</span></span>
                  <span className="block font-medium leading-snug">{r.title}</span>
                  <span className="block text-sm text-slate-400">{r.why}</span>
                </span>
                <span className="mt-1 text-slate-500 transition-colors group-hover:text-white" aria-hidden>↗</span>
              </a>
            </li>
          ))}
          <li className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
            <span>AI-suggested. Links open a search so they never break.</span>
            <button className="underline hover:text-white" onClick={load} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
          </li>
        </ol>
      )}
      {error && <ErrorBox message={error} onRetry={load} />}
    </Card>
  )
}
