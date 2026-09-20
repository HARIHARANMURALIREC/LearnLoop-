// AUTO-COPIED from web/src/lib/scoring.ts by scripts/sync-shared.sh — edit the web file, not this one.
// All deterministic learning maths (adaptive difficulty, mastery, decay, Time-to-Ready). No AI involved.
import type { Level, Skill, SkillState, Snapshot } from './types'

export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced']
const idx = (l: Level) => LEVELS.indexOf(l)
export const READY_THRESHOLD = 80

/** Difficulty for the next question. Correct+confident -> harder; wrong+unsure -> easier; otherwise hold. */
export function nextDifficulty(cur: Level, last: { correct: boolean; confidence: number }): Level {
  const i = idx(cur)
  if (last.correct && last.confidence >= 4) return LEVELS[Math.min(2, i + 1)]
  if (last.correct && last.confidence === 3) return LEVELS[Math.min(2, i + 1)]
  if (!last.correct && last.confidence <= 2) return LEVELS[Math.max(0, i - 1)]
  if (!last.correct && last.confidence === 3) return LEVELS[Math.max(0, i - 1)]
  return cur // correct-but-unsure, or confidently wrong (flagged, needs the concept not an easier question)
}

export interface DiagStep { difficulty: Level; correct: boolean; confidence: number }

/** Level has settled once we have 3+ answers and the last two were asked at the same difficulty, or at 5 answers. */
export function isSettled(steps: DiagStep[]): boolean {
  if (steps.length >= 5) return true
  const n = steps.length
  return n >= 3 && steps[n - 1].difficulty === steps[n - 2].difficulty
}

const BASE: Record<Level, number> = { beginner: 20, intermediate: 50, advanced: 78 }
export function diagnosticResult(steps: DiagStep[]): { level: Level; mastery: number } {
  const last = steps[steps.length - 1]
  const level = nextDifficulty(last.difficulty, last)
  const acc = steps.filter((s) => s.correct).length / steps.length
  return { level, mastery: clamp(BASE[level] + (acc - 0.5) * 20) }
}

export const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n))
export const levelFromMastery = (m: number): Level => (m < 35 ? 'beginner' : m < 65 ? 'intermediate' : 'advanced')

export function practiceDelta(correct: boolean, difficulty: Level): number {
  return correct ? [5, 7, 9][idx(difficulty)] : -3
}

const DAY = 86_400_000
/** Half-life of 30 days at decay_rate 1; never fades below 30% of the earned score. */
export function decayFactor(lastPracticed: string | null, decayRate: number, now = Date.now()): number {
  if (!lastPracticed) return 1
  const days = Math.max(0, (now - new Date(lastPracticed).getTime()) / DAY)
  return Math.max(0.3, 0.5 ** ((days * decayRate) / 30))
}
export const effectiveMastery = (s: SkillState | undefined, skill: Skill, now = Date.now()) =>
  s ? s.mastery_score * decayFactor(s.last_practiced_at, skill.decay_rate, now) : 0

/** Weighted readiness across all skills; untested skills count as 0. */
export function overallReadiness(skills: Skill[], states: Map<string, SkillState>, now = Date.now()): number {
  const total = skills.reduce((a, s) => a + (s.weight || 0.5), 0)
  if (!total) return 0
  return skills.reduce((a, s) => a + (s.weight || 0.5) * effectiveMastery(states.get(s.id), s, now), 0) / total
}

export type Ttr = { kind: 'ready' } | { kind: 'eta'; days: number; slope: number } | { kind: 'insufficient'; reason: string }
/** Least-squares line through readiness snapshots, projected to READY_THRESHOLD. Explainable, no AI. */
export function timeToReady(snaps: Snapshot[], current: number): Ttr {
  if (current >= READY_THRESHOLD) return { kind: 'ready' }
  if (snaps.length < 2) return { kind: 'insufficient', reason: 'Practice a few sessions to establish a trend.' }
  const t0 = new Date(snaps[0].created_at).getTime()
  const pts = snaps.map((s) => ({ x: (new Date(s.created_at).getTime() - t0) / DAY, y: s.overall }))
  const n = pts.length
  const mx = pts.reduce((a, p) => a + p.x, 0) / n
  const my = pts.reduce((a, p) => a + p.y, 0) / n
  const den = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0)
  if (den < 0.01) return { kind: 'insufficient', reason: 'Snapshots need to span more than a day for a trend.' }
  const slope = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / den
  if (slope <= 0.05) return { kind: 'insufficient', reason: 'Progress is flat right now — practice your weakest skills.' }
  return { kind: 'eta', days: Math.ceil((READY_THRESHOLD - current) / slope), slope }
}

/** Red -> green by mastery. */
export const masteryColor = (m: number) => `hsl(${Math.round((clamp(m) / 100) * 130)} 65% 38%)`
