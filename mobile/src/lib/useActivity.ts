// AUTO-COPIED from web/src/lib/useActivity.ts by scripts/sync-shared.sh — edit the web file, not this one.
import { useEffect, useState } from 'react'
import { computeStreak, type Streak } from './streak'
import { supabase } from './supabase'

/** Learning-streak across ALL goals: any attempt or scored simulation counts as activity. */
export function useStreak(userId: string, refreshKey: unknown = 0) {
  const [streak, setStreak] = useState<Streak | null>(null)
  useEffect(() => {
    const since = new Date(Date.now() - 120 * 86_400_000).toISOString()
    Promise.all([
      supabase.from('attempts').select('created_at').eq('user_id', userId).gte('created_at', since).limit(3000),
      supabase.from('simulations').select('created_at').eq('user_id', userId).gte('created_at', since).not('score', 'is', null).limit(500),
    ]).then(([a, s]) => setStreak(computeStreak([...(a.data ?? []), ...(s.data ?? [])].map((r) => r.created_at as string))))
  }, [userId, refreshKey])
  return streak
}

/** Number of flashcards due now (for the sidebar badge and dashboard nudge). */
export function useDueCards(userId: string, refreshKey: unknown = 0) {
  const [n, setN] = useState(0)
  useEffect(() => {
    supabase.from('flashcards').select('id', { count: 'exact', head: true }).eq('user_id', userId).lte('due_at', new Date().toISOString())
      .then(({ count }) => setN(count ?? 0))
  }, [userId, refreshKey])
  return n
}
