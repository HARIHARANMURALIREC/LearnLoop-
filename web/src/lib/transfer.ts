import { skillTransfer } from './ai'
import { supabase } from './supabase'
import type { Transfer } from './types'

/** Skills the user already has tested levels for in OTHER goals. */
export async function loadExistingSkills(userId: string, excludeGoalId?: string) {
  const { data } = await supabase.from('skill_states')
    .select('current_level, mastery_score, skills!inner(skill_name, goal_id, goals(goal_title))')
    .eq('user_id', userId)
  return ((data ?? []) as any[])
    .filter((r) => r.skills.goal_id !== excludeGoalId)
    .map((r) => ({ skill: r.skills.skill_name, goal: r.skills.goals?.goal_title, level: r.current_level, mastery: Math.round(r.mastery_score) }))
}

export async function findTransfers(userId: string, goalTitle: string, newSkills: string[], excludeGoalId?: string): Promise<Transfer[]> {
  const existing = await loadExistingSkills(userId, excludeGoalId)
  if (!existing.length) return []
  return (await skillTransfer({ goal_title: goalTitle, new_skills: newSkills, existing })).transfers
}
