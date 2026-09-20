// AUTO-COPIED from web/src/lib/weak.ts by scripts/sync-shared.sh — edit the web file, not this one.
import type { Attempt, Skill } from './types'

/** Weak points the live AI persona should probe: lowest-mastery skills plus concrete confident-wrong questions. */
export function weakPoints(skills: Skill[], effective: (id: string) => number, attempts: Attempt[]): string[] {
  const byId = new Map(skills.map((s) => [s.id, s.skill_name]))
  const lowest = [...skills].sort((a, b) => effective(a.id) - effective(b.id)).slice(0, 3).map((s) => `${s.skill_name} (weak)`)
  const hcw = attempts.filter((a) => a.is_high_confidence_wrong).slice(0, 3)
    .map((a) => `${byId.get(a.skill_id)}: learner was confidently wrong about "${a.question_text.slice(0, 120)}"`)
  return [...hcw, ...lowest]
}
