// AUTO-COPIED from web/src/lib/types.ts by scripts/sync-shared.sh — edit the web file, not this one.
export type Level = 'beginner' | 'intermediate' | 'advanced'
export type DomainType = 'technical' | 'language' | 'non-technical'
export type Style = 'analogy' | 'step_by_step' | 'visual'
export type ErrorType = 'concept_gap' | 'careless' | 'misread'
export type SimType = 'conversation' | 'client_call' | 'interview_behavioral' | 'interview_coding' | 'reverse_tutor'

export interface Goal { id: string; user_id: string; goal_title: string; domain_type: DomainType | null; declared_level: Level | null }
export interface Skill { id: string; goal_id: string; skill_name: string; weight: number; decay_rate: number }
export interface SkillDraft { skill_name: string; weight: number; decay_rate: number }
export interface SkillState { id: string; user_id: string; skill_id: string; current_level: Level; mastery_score: number; last_practiced_at: string | null }
export interface Attempt {
  id: string; skill_id: string; question_text: string; answer_given: string; correct: boolean
  confidence_rating: number; error_type: ErrorType | null; is_high_confidence_wrong: boolean; created_at: string
}
export interface Snapshot { overall: number; created_at: string }
export interface Question { question: string; options: string[]; correct_index: number }
export interface TranscriptEntry { role: 'user' | 'ai'; text: string; timestamp: string }
export interface Evaluation {
  score: number; correctness: number; communication: number; summary: string
  strengths: string[]; improvements: string[]; teaching_held_up?: boolean
  high_confidence_wrong_moment: null | { quote: string; why: string }
}
export interface Transfer { new_skill: string; from_skill: string; from_goal: string; transfer_percent: number; reasoning: string }
