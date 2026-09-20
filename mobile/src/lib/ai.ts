// AUTO-COPIED from web/src/lib/ai.ts by scripts/sync-shared.sh — edit the web file, not this one.
import type { Resource } from './resources'
import { supabase } from './supabase'
import type { DomainType, Evaluation, Level, Question, SkillDraft, Style, Transfer, ErrorType, TranscriptEntry } from './types'

// Single entry point to the `ai` Edge Function. The frontend never talks to Groq directly.
async function callAi<T>(task: string, input: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai', { body: { task, input } })
  if (error) {
    // FunctionsHttpError hides the server message in the response body
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(body?.error ?? error.message)
  }
  return data as T
}

export const generateSkillMap = (goal_title: string, declared_level: Level) =>
  callAi<{ domain_type: DomainType; skills: SkillDraft[] }>('skill_map', { goal_title, declared_level })

export const nextQuestion = (i: {
  goal_title: string; skill_name: string; difficulty: Level; focus?: string
  history: { correct: boolean; confidence: number }[]; asked: string[]
}) => callAi<Question>('next_question', i)

export const classifyError = (i: { question: string; answer_given: string; correct_answer: string; reason: string }) =>
  callAi<{ error_type: ErrorType }>('classify_error', i)

export const explain = (i: { goal_title: string; skill_name: string; gap: string; style: Style; level: Level }) =>
  callAi<{ explanation: string }>('explain', i)

export const feynman = (i: { skill_name: string; explanation: string; user_text: string }) =>
  callAi<{ passed: boolean; feedback: string }>('feynman', i)

export interface SimContext {
  question_no?: number; max_questions?: number
  type: string; goal_title: string; level: Level; skill_name?: string
  weak: string[]; code_context?: string; transcript: Pick<TranscriptEntry, 'role' | 'text'>[]
}
export const simTurn = (i: SimContext) => callAi<{ reply: string; lang: string }>('sim_turn', i)

export const simEval = (i: {
  type: string; goal_title: string; level: Level; transcript: TranscriptEntry[]; code?: object
}) => callAi<Evaluation>('sim_eval', i)

export interface CodeProblem {
  title: string; statement: string; function_name: string; starter_code: string
  tests: { args: unknown[]; expected: unknown }[]
}
export const codeProblem = (i: { goal_title: string; skill_name: string; level: Level }) => callAi<CodeProblem>('code_problem', i)
export const codeReview = (i: { problem: string; code: string; output: string; passed: boolean }) =>
  callAi<{ notes: string; correctness: number }>('code_review', i)

export interface ResumeResult {
  verified: { skill: string; claimed_level: string | null; tested_level: string; note: string }[]
  unclaimed_practiced: { skill: string; tested_level: string; suggested_bullet: string }[]
  unproven: { claim: string; claimed_level: string | null; tested_level: string | null; mismatch: boolean; reason: string }[]
}
export const resumeAnalysis = (i: { goal_title: string; resume_text: string; skills: object[] }) =>
  callAi<ResumeResult>('resume_analysis', i)

export const skillTransfer = (i: { goal_title: string; new_skills: string[]; existing: object[] }) =>
  callAi<{ transfers: Transfer[] }>('transfer', i)

// Simulated, illustrative benchmark - not real learner data.
export const ghostBenchmark = (i: { goal_title: string; level: Level }) =>
  callAi<{ points: { day: number; score: number }[] }>('ghost', i)

export const learningResources = (i: { goal_title: string; skill_name: string; level: Level; gap?: string }) =>
  callAi<{ resources: Resource[] }>('resources', i)

export const weeklyPlanNotes = (i: { goal_title: string; current: number; target: number; sessions: { day: string; skill: string; activity: string; minutes: number }[] }) =>
  callAi<{ summary: string; notes: string[] }>('weekly_plan', i)
export const coachSession = (i: { type: string; goal_title: string; transcript: { role: string; text: string }[] }) =>
  callAi<{ moments: { turn_index: number; kind: 'strong' | 'improve' | 'flag'; tip: string }[] }>('coach', i)
export const pronPhrases = (i: { goal_title: string; level: Level; weak: string[] }) =>
  callAi<{ lang: string; phrases: { text: string; meaning: string; focus: string }[] }>('pron_phrases', i)
export const peerQuestions = (i: { goal_title: string; level: Level; weak: string[] }) =>
  callAi<{ questions: { q: string; listen_for: string; skill: string }[] }>('peer_questions', i)
export const peerEval = (i: { goal_title: string; messages: { role: string; text: string }[] }) =>
  callAi<{ score: number; summary: string; strengths: string[]; improvements: string[]; interviewer_feedback: string }>('peer_eval', i)
