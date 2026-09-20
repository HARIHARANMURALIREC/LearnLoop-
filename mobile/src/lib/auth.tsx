import type { Session } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Goal } from './types'

interface AppCtx {
  session: Session | null; loading: boolean
  goals: Goal[]; goalsLoaded: boolean; goalId: string | null
  setGoalId: (id: string) => void; reloadGoals: () => Promise<void>
}
const Ctx = createContext<AppCtx>(null!)
export const useApp = () => useContext(Ctx)
const KEY = 'learnloop:goal'

/** Auth session + the list of goals + which goal is active (persisted). */
export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalsLoaded, setGoalsLoaded] = useState(false)
  const [stored, setStored] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (!s) { setGoals([]); setGoalsLoaded(false) } })
    AsyncStorage.getItem(KEY).then(setStored).catch(() => {})
    return () => data.subscription.unsubscribe()
  }, [])

  const reloadGoals = useCallback(async () => {
    // RLS returns own goals plus goals of joined pods.
    const { data } = await supabase.from('goals').select('*').order('created_at', { ascending: false })
    setGoals((data as Goal[]) ?? []); setGoalsLoaded(true)
  }, [])
  useEffect(() => { if (session) reloadGoals() }, [session, reloadGoals])

  const goalId = useMemo(() => goals.find((g) => g.id === stored)?.id ?? goals[0]?.id ?? null, [goals, stored])
  const setGoalId = useCallback((id: string) => { setStored(id); AsyncStorage.setItem(KEY, id).catch(() => {}) }, [])

  return <Ctx.Provider value={{ session, loading, goals, goalsLoaded, goalId, setGoalId, reloadGoals }}>{children}</Ctx.Provider>
}
