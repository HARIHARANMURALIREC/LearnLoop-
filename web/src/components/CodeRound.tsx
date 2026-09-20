import Editor from '@monaco-editor/react'
import { useEffect, useRef, useState } from 'react'
import { codeProblem, codeReview, type CodeProblem } from '../lib/ai'
import { runCode } from '../lib/runCode'
import { supabase } from '../lib/supabase'
import type { Level } from '../lib/types'
import { Card, ErrorBox, Spinner } from './ui'

export interface CodeSubmission { problem: string; code: string; output: string; passed: boolean; notes: string }

/** Coding round: AI writes the problem, the user's code runs in a sandboxed worker, AI reviews code + real output. */
export default function CodeRound({ simId, goalTitle, skillName, level, onDone }: {
  simId: string; goalTitle: string; skillName: string; level: Level
  onDone: (s: CodeSubmission | null, wantFollowup: boolean) => void
}) {
  const [problem, setProblem] = useState<CodeProblem | null>(null)
  const [code, setCode] = useState('')
  const [output, setOutput] = useState<{ output: string; passed: boolean } | null>(null)
  const [sub, setSub] = useState<CodeSubmission | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const started = useRef(false)

  async function load() {
    setError('')
    try { const p = await codeProblem({ goal_title: goalTitle, skill_name: skillName, level }); setProblem(p); setCode(p.starter_code) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not generate a problem') }
  }
  useEffect(() => { if (!started.current) { started.current = true; load() } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    setBusy('Running…')
    const r = await runCode(code, problem!); setOutput(r); setBusy(''); return r
  }

  async function submit() {
    const r = output ?? await run()
    setBusy('AI is reviewing your code…'); setError('')
    try {
      const rev = await codeReview({ problem: `${problem!.title}\n${problem!.statement}`, code, output: r.output, passed: r.passed })
      const s: CodeSubmission = { problem: `${problem!.title}\n${problem!.statement}`, code, output: r.output, passed: r.passed, notes: rev.notes }
      const { error } = await supabase.from('coding_round_submissions').insert({
        simulation_id: simId, problem_statement: s.problem, code_submitted: code, language: 'javascript',
        execution_output: r.output, execution_passed: r.passed, ai_review_notes: rev.notes,
      })
      if (error) throw error
      setSub(s)
    } catch (e) { setError(e instanceof Error ? e.message : (e as { message: string }).message) }
    setBusy('')
  }

  if (!problem) return error ? <ErrorBox message={error} onRetry={load} /> : <Spinner label="Preparing your coding problem…" />
  return (
    <div className="space-y-3">
      <Card title={`Coding round · ${problem.title}`}><p className="whitespace-pre-wrap text-sm">{problem.statement}</p>
        <p className="mt-2 text-xs text-slate-500">JavaScript · define <code>{problem.function_name}</code> · runs in a sandboxed worker</p></Card>
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <Editor height="320px" language="javascript" theme="vs-dark" value={code} onChange={(v) => { setCode(v ?? ''); setOutput(null) }}
          options={{ minimap: { enabled: false }, fontSize: 14, readOnly: !!sub, scrollBeyondLastLine: false }} loading={<div className="p-4"><Spinner label="Loading editor…" /></div>} />
      </div>
      {error && <ErrorBox message={error} />}
      {!sub && (
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border border-slate-600 px-4 py-2" disabled={!!busy} onClick={run}>▶ Run code</button>
          <button className="btn" disabled={!!busy} onClick={submit}>Submit for review</button>
          <button className="ml-auto text-sm text-slate-400 underline" disabled={!!busy} onClick={() => onDone(null, false)}>Skip coding round</button>
          {busy && <Spinner label={busy} />}
        </div>
      )}
      {output && <pre className={`overflow-x-auto rounded-lg border p-3 text-xs ${output.passed ? 'border-emerald-500/50' : 'border-red-500/50'}`}>{output.output}</pre>}
      {sub && (
        <Card title="AI code review">
          <p className="whitespace-pre-wrap text-sm">{sub.notes}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn" onClick={() => onDone(sub, true)}>🎙️ Voice follow-up about my code</button>
            <button className="rounded-lg border border-slate-600 px-4 py-2" onClick={() => onDone(sub, false)}>Finish & evaluate</button>
          </div>
        </Card>
      )}
    </div>
  )
}
