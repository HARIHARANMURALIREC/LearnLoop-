import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useApp } from './auth'
import { effectiveMastery, overallReadiness } from './scoring'
import { supabase } from './supabase'
import type { Attempt, Goal, Skill, SkillState, Snapshot } from './types'

interface GoalData {
  goal: Goal; skills: Skill[]; states: Map<string, SkillState>; attempts: Attempt[]; snapshots: Snapshot[]
  effective: (skillId: string) => number
  overall: number
  offline: boolean // showing the last saved copy because the network failed
  reload: () => Promise<void>
  snapshot: () => Promise<void>
}
const Ctx = createContext<GoalData | null>(null)
export const useGoalData = () => useContext(Ctx)!
/** For screens that render before a goal exists (dashboard redirect logic). */
export const useMaybeGoalData = () => useContext(Ctx)

export function GoalDataProvider({ goalId, children, fallback }: { goalId: string; children: ReactNode; fallback: ReactNode }) {
  const { session } = useApp()
  const uid = session!.user.id
  const [raw, setRaw] = useState<{ goal: Goal; skills: Skill[]; states: SkillState[]; attempts: Attempt[]; snapshots: Snapshot[] } | null>(null)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)

  const reload = useCallback(async () => {
    const cacheKey = `goaldata:${uid}:${goalId}`
    // Offline mode: if the network fails, fall back to the last successful copy so the app stays usable.
    const useCache = async (msg: string) => {
      const c = await AsyncStorage.getItem(cacheKey).catch(() => null)
      if (c) { setRaw(JSON.parse(c)); setOffline(true); setError('') } else setError(msg)
    }
    let g, s
    try {
      ;[g, s] = await Promise.all([
        supabase.from('goals').select('*').eq('id', goalId).maybeSingle(),
        supabase.from('skills').select('*').eq('goal_id', goalId).order('weight', { ascending: false }),
      ])
    } catch { return useCache('You appear to be offline and nothing is saved yet.') }
    if (g.error || s.error || !g.data) return useCache(g.error?.message ?? s.error?.message ?? 'Goal not found')
    const ids = (s.data as Skill[]).map((x) => x.id)
    let st, at, sn
    try { ;[st, at, sn] = await Promise.all([
      supabase.from('skill_states').select('*').eq('user_id', uid).in('skill_id', ids),
      supabase.from('attempts').select('*').eq('user_id', uid).in('skill_id', ids).order('created_at', { ascending: false }).limit(300),
      supabase.from('mastery_snapshots').select('overall, created_at').eq('user_id', uid).eq('goal_id', goalId).order('created_at'),
    ]) } catch { return useCache('You appear to be offline.') }
    const err = st.error ?? at.error ?? sn.error
    if (err) return useCache(err.message)
    setError(''); setOffline(false)
    const fresh = { goal: g.data as Goal, skills: s.data as Skill[], states: st.data as SkillState[], attempts: at.data as Attempt[], snapshots: sn.data as Snapshot[] }
    setRaw(fresh)
    AsyncStorage.setItem(cacheKey, JSON.stringify({ ...fresh, attempts: fresh.attempts.slice(0, 80) })).catch(() => {})
  }, [goalId, uid])

  useEffect(() => { setRaw(null); reload() }, [reload])

  const value = useMemo<GoalData | null>(() => {
    if (!raw) return null
    const states = new Map(raw.states.map((s) => [s.skill_id, s]))
    const byId = new Map(raw.skills.map((s) => [s.id, s]))
    return {
      ...raw, states, offline,
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
  }, [raw, offline, reload, uid, goalId])

  if (error && !raw) return <>{fallback}</>
  if (!value) return <>{fallback}</>
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
