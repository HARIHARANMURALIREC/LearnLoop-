import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PeerCard, { type PeerSession } from '../components/PeerCard'
import { Card, Empty, ErrorBox, Spinner } from '../components/ui'
import { nextQuestion } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { useGoalData } from '../lib/goalData'
import { effectiveMastery, levelFromMastery, masteryColor } from '../lib/scoring'
import { supabase } from '../lib/supabase'
import type { Question, SkillState } from '../lib/types'

interface Member { user_id: string; profiles: { display_name: string } | null }
interface Challenge { id: string; skill_id: string; question_text: string; created_at: string }
interface Answer { challenge_id: string; user_id: string; correct: boolean; answered_at: string }
interface Shared { id: string; skill_id: string; style: string; explanation_text: string; user_id: string }

export default function PodDetail() {
  const { podId } = useParams()
  const { goal, skills } = useGoalData() // route goalId === pod's goal, so skills are the pod's shared skill map
  const { session } = useAuth()
  const uid = session!.user.id

  const [pod, setPod] = useState<{ pod_name: string; join_code: string } | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [podStates, setPodStates] = useState<SkillState[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [shared, setShared] = useState<Shared[]>([])
  const [online, setOnline] = useState<string[]>([])
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [peer, setPeer] = useState<PeerSession[]>([])
  const skillIds = useMemo(() => skills.map((s) => s.id), [skills])

  const load = useCallback(async () => {
    const [p, m, st, ch, ex, ps] = await Promise.all([
      supabase.from('pods').select('pod_name, join_code').eq('id', podId!).maybeSingle(),
      supabase.from('pod_members').select('user_id, profiles(display_name)').eq('pod_id', podId!),
      supabase.from('skill_states').select('*').in('skill_id', skillIds),
      supabase.from('group_challenges').select('*').eq('pod_id', podId!).order('created_at', { ascending: false }),
      supabase.from('explanations').select('id, skill_id, style, explanation_text, user_id').eq('passed_feynman_check', true).neq('user_id', uid).in('skill_id', skillIds),
      supabase.from('peer_sessions').select('id, interviewer_id, interviewee_id, status, evaluation, created_at').eq('pod_id', podId!).order('created_at', { ascending: false }),
    ])
    const err = p.error ?? m.error ?? st.error ?? ch.error ?? ex.error
    if (err) return setError(err.message)
    if (!p.data) return setError('Pod not found or you are not a member.')
    setPeer((ps.data as PeerSession[]) ?? [])
    setPod(p.data); setMembers(m.data as unknown as Member[]); setPodStates(st.data as SkillState[])
    const chs = ch.data as Challenge[]; setChallenges(chs); setShared(ex.data as Shared[])
    if (chs.length) {
      const { data } = await supabase.from('group_challenge_answers').select('*').in('challenge_id', chs.map((c) => c.id))
      setAnswers((data as Answer[]) ?? [])
    } else setAnswers([])
    setLoaded(true)
  }, [podId, skillIds, uid])

  useEffect(() => { load() }, [load])

  // Realtime: new challenges/answers refresh the view; presence shows who's online.
  useEffect(() => {
    const ch = supabase.channel(`pod:${podId}`, { config: { presence: { key: uid } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_challenges', filter: `pod_id=eq.${podId}` }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_challenge_answers' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'peer_sessions', filter: `pod_id=eq.${podId}` }, () => load())
      .on('presence', { event: 'sync' }, () => setOnline(Object.keys(ch.presenceState())))
      .subscribe((s) => { if (s === 'SUBSCRIBED') ch.track({ at: Date.now() }) })
    return () => { supabase.removeChannel(ch) }
  }, [podId, uid, load])

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.profiles?.display_name ?? 'Member'
  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills])
  const eff = useCallback((userId: string, skillId: string) =>
    effectiveMastery(podStates.find((s) => s.user_id === userId && s.skill_id === skillId), skillById.get(skillId)!), [podStates, skillById])

  const gap = useMemo(() => skills.map((s) => {
    const per = members.map((m) => ({ id: m.user_id, v: eff(m.user_id, s.id) }))
    return { skill: s, per, avg: per.reduce((a, p) => a + p.v, 0) / Math.max(1, per.length) }
  }).sort((a, b) => a.avg - b.avg), [skills, members, eff])

  // Deterministic peer matching: per skill, strongest member teaches weakest when the gap is meaningful.
  const pairs = useMemo(() => gap.flatMap(({ skill, per }) => {
    if (per.length < 2) return []
    const sorted = [...per].sort((a, b) => b.v - a.v)
    const hi = sorted[0], lo = sorted[sorted.length - 1]
    return hi.v - lo.v >= 20 ? [{ skill: skill.skill_name, teacher: hi, learner: lo, diff: hi.v - lo.v }] : []
  }).sort((a, b) => b.diff - a.diff).slice(0, 5), [gap])

  const current = challenges[0]
  const q: (Question & { skillName: string }) | null = useMemo(() => {
    if (!current) return null
    try { return { ...JSON.parse(current.question_text), skillName: skillById.get(current.skill_id)?.skill_name ?? '' } } catch { return null }
  }, [current, skillById])
  const myAnswer = answers.find((a) => a.challenge_id === current?.id && a.user_id === uid)

  async function startChallenge() {
    setStarting(true); setError('')
    try {
      const target = gap[0] // collective weakest skill
      const avgAll = gap.reduce((a, g) => a + g.avg, 0) / Math.max(1, gap.length)
      const question = await nextQuestion({
        goal_title: goal.goal_title, skill_name: target.skill.skill_name, difficulty: levelFromMastery(target.avg || avgAll),
        history: [], asked: challenges.map((c) => { try { return JSON.parse(c.question_text).question } catch { return '' } }),
      })
      const { error } = await supabase.from('group_challenges').insert({ pod_id: podId, skill_id: target.skill.id, question_text: JSON.stringify(question) })
      if (error) throw error
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : (e as { message: string }).message) }
    setStarting(false)
  }

  async function answer(i: number) {
    if (!q || !current) return
    const { error } = await supabase.from('group_challenge_answers').insert({ challenge_id: current.id, user_id: uid, correct: i === q.correct_index })
    if (error) setError(error.message); else load()
  }

  const board = useMemo(() => members.map((m) => {
    const mine = answers.filter((a) => a.user_id === m.user_id)
    return { id: m.user_id, name: nameOf(m.user_id), correct: mine.filter((a) => a.correct).length, total: mine.length }
  }).sort((a, b) => b.correct - a.correct || a.total - b.total), [members, answers]) // eslint-disable-line react-hooks/exhaustive-deps

  const myWeak = new Set(skills.filter((s) => eff(uid, s.id) < 50).map((s) => s.id))
  const pool = shared.filter((s) => myWeak.has(s.skill_id))

  if (error && !loaded) return <ErrorBox message={error} />
  if (!loaded) return <Spinner />

  return (
    <div className="stagger space-y-4">
      <div><Link to={`/g/${goal.id}/pods`} className="text-sm text-slate-400 hover:text-white">← Pods</Link>
        <h1 className="font-display text-3xl font-bold">{pod!.pod_name}</h1>
        <p className="text-sm text-slate-400">Join code <span className="font-mono text-slate-100 text-base tracking-widest">{pod!.join_code}</span> · {members.length} member{members.length === 1 ? '' : 's'} · {online.length} online now</p></div>
      {error && <ErrorBox message={error} />}

      <Card title="Pod gap map (weakest first)">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-left text-slate-500"><th className="pb-2">Skill</th><th>Avg</th>{members.map((m) => <th key={m.user_id} className="px-1 font-normal">{nameOf(m.user_id).slice(0, 8)}{online.includes(m.user_id) && ' 🟢'}</th>)}</tr></thead>
          <tbody>{gap.map((g) => (
            <tr key={g.skill.id} className="border-t border-slate-800"><td className="py-1.5 pr-2">{g.skill.skill_name}</td>
              <td className="font-semibold">{Math.round(g.avg)}</td>
              {g.per.map((p) => <td key={p.id} className="px-1"><span className="inline-block w-10 rounded px-1 text-center" style={{ background: masteryColor(p.v) }}>{Math.round(p.v)}</span></td>)}</tr>
          ))}</tbody></table></div>
      </Card>

      <Card title="Suggested peer pairs">
        {pairs.length === 0 ? <p className="text-sm text-slate-400">No complementary strong/weak pairs yet — needs 2+ members with a 20+ point gap on a skill.</p> : (
          <ul className="space-y-1 text-sm">{pairs.map((p, i) => (
            <li key={i}><b>{nameOf(p.teacher.id)}</b> ({Math.round(p.teacher.v)}) can teach <b>{nameOf(p.learner.id)}</b> ({Math.round(p.learner.v)}) — <span className="text-indigo-300">{p.skill}</span></li>
          ))}</ul>
        )}
      </Card>

      <Card title="Group challenge">
        {!q ? <Empty title="No challenge yet" hint={`Targets your pod's weakest shared skill (${gap[0]?.skill.skill_name}), matched to the pod's level.`} /> : (
          <div className="space-y-3">
            <p className="text-xs text-indigo-300">Skill: {q.skillName}</p>
            <p className="text-lg">{q.question}</p>
            <div className="space-y-2">{q.options.map((o, i) => (
              <button key={i} disabled={!!myAnswer} onClick={() => answer(i)}
                className={`w-full rounded-lg border px-3 py-2 text-left ${myAnswer ? (i === q.correct_index ? 'border-emerald-400 bg-emerald-500/20' : 'border-slate-800 opacity-60') : 'border-slate-700 hover:border-indigo-400'}`}>{o}</button>
            ))}</div>
            {myAnswer && <p className={myAnswer.correct ? 'text-emerald-400' : 'text-red-400'}>{myAnswer.correct ? 'Correct!' : 'Not this time.'}</p>}
          </div>
        )}
        <button className="btn mt-3" disabled={starting} onClick={startChallenge}>{starting ? 'Generating…' : q ? 'Start a new challenge' : 'Start group challenge'}</button>
      </Card>

      {current && (
        <Card title="Leaderboard">
          {!myAnswer ? <p className="text-sm text-slate-400">Answer the challenge to reveal the leaderboard. {answers.filter((a) => a.challenge_id === current.id).length}/{members.length} have answered.</p> : (
            <ol className="space-y-1">{board.map((b, i) => (
              <li key={b.id} className="flex justify-between text-sm"><span>{i + 1}. {b.name}{b.id === uid && ' (you)'}</span><span className="text-slate-400">{b.correct}/{b.total} correct</span></li>
            ))}</ol>
          )}
        </Card>
      )}

      <PeerCard goalId={goal.id} podId={podId!} goalTitle={goal.goal_title} uid={uid} sessions={peer}
        members={members.map((m) => {
          const mine = skills.map((s) => ({ n: s.skill_name, v: eff(m.user_id, s.id) })).sort((a, b) => a.v - b.v)
          return { id: m.user_id, name: nameOf(m.user_id), weak: mine.slice(0, 3).map((x) => x.n), avg: mine.reduce((a, x) => a + x.v, 0) / Math.max(1, mine.length) }
        })} />

      <Card title="Shared resource pool">
        {pool.length === 0 ? <p className="text-sm text-slate-400">When a pod-mate passes an explain-back on a skill you're weak in, their explanation appears here.</p> : (
          <ul className="space-y-2">{pool.map((r) => (
            <li key={r.id}><details className="rounded-lg border border-slate-800 p-2"><summary className="cursor-pointer text-sm">{skillById.get(r.skill_id)?.skill_name} · {r.style.replace('_', ' ')} · by {nameOf(r.user_id)}</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{r.explanation_text}</p></details></li>
          ))}</ul>
        )}
      </Card>
    </div>
  )
}
