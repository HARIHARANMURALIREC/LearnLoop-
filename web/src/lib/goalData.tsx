import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { effectiveMastery, overallReadiness } from './scoring'
import { supabase } from './supabase'
import type { Attempt, Goal, Skill, SkillState, Snapshot } from './types'

interface GoalData {
  goal: Goal; skills: Skill[]; states: Map<string, SkillState>; attempts: Attempt[]; snapshots: Snapshot[]
  effective: (skillId: string) => number
  overall: number
  reload: () => Promise<void>
  /** Record a readiness snapshot from current state (call after states change and reload). */
  snapshot: () => Promise<void>
}
const Ctx = createContext<GoalData | null>(null)
export const useGoalData = () => useContext(Ctx)!

export function GoalDataProvider({ goalId, children }: { goalId: string; children: ReactNode }) {
  const { session } = useAuth()
  const uid = session!.user.id
  const [raw, setRaw] = useState<{ goal: Goal; skills: Skill[]; states: SkillState[]; attempts: Attempt[]; snapshots: Snapshot[] } | null>(null)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    const [g, s] = await Promise.all([
      supabase.from('goals').select('*').eq('id', goalId).maybeSingle(),
      supabase.from('skills').select('*').eq('goal_id', goalId).order('weight', { ascending: false }),
    ])
    if (g.error || s.error || !g.data) { setError(g.error?.message ?? s.error?.message ?? 'Goal not found'); return }
    const ids = (s.data as Skill[]).map((x) => x.id)
    const [st, at, sn] = await Promise.all([
      supabase.from('skill_states').select('*').eq('user_id', uid).in('skill_id', ids),
      supabase.from('attempts').select('*').eq('user_id', uid).in('skill_id', ids).order('created_at', { ascending: false }).limit(300),
      supabase.from('mastery_snapshots').select('overall, created_at').eq('user_id', uid).eq('goal_id', goalId).order('created_at'),
    ])
    const err = st.error ?? at.error ?? sn.error
    if (err) { setError(err.message); return }
    setRaw({ goal: g.data as Goal, skills: s.data as Skill[], states: st.data as SkillState[], attempts: at.data as Attempt[], snapshots: sn.data as Snapshot[] })
  }, [goalId, uid])

  useEffect(() => { setRaw(null); setError(''); reload() }, [reload])

  const value = useMemo<GoalData | null>(() => {
    if (!raw) return null
    const states = new Map(raw.states.map((s) => [s.skill_id, s]))
    const byId = new Map(raw.skills.map((s) => [s.id, s]))
    return {
      ...raw, states,
      effective: (id) => effectiveMastery(states.get(id), byId.get(id)!),
      overall: overallReadiness(raw.skills, states),
      reload,
      // Reads fresh states so it is correct right after a write, before reload() has landed.
      snapshot: async () => {
        const { data } = await supabase.from('skill_states').select('*').eq('user_id', uid).in('skill_id', raw.skills.map((x) => x.id))
        const fresh = new Map((data as SkillState[]).map((x) => [x.skill_id, x]))
        await supabase.from('mastery_snapshots').insert({ user_id: uid, goal_id: goalId, overall: overallReadiness(raw.skills, fresh) })
      },
    }
  }, [raw, reload, uid, goalId])

  if (error) return <div className="p-8 text-red-400">Couldn't load goal: {error}</div>
  if (!value) return <div className="p-8 text-slate-400 animate-pulse">Loading…</div>
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
