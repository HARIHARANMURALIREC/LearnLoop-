// POST /functions/v1/ai  { task: string, input: object }
// JWT verification is on (config.toml), so only signed-in users can call this.
import { callGroq, parseJson } from '../_shared/groq.ts'
import * as P from '../_shared/prompts.ts'
import { withinQuota } from '../_shared/quota.ts'

const AI_CALLS_PER_HOUR = Number(Deno.env.get('AI_CALLS_PER_HOUR') ?? 400)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Small model for live turns: latency is what makes the simulation feel real-time.
const FAST_MODEL = Deno.env.get('GROQ_FAST_MODEL') ?? 'openai/gpt-oss-20b'
const clamp = (n: unknown, lo: number, hi: number, d: number) => Math.min(hi, Math.max(lo, Number(n) || d))
const ask = async <T>(system: string, user: string, o: Parameters<typeof callGroq>[2] = {}) =>
  parseJson<T>(await callGroq(system, user, { json: true, ...o }))

// The model tends to favour option A; shuffle and remap the answer key.
function shuffled(q: { question: string; options: string[]; correct_index: number }) {
  const options = q.options.slice(0, 4)
  if (options.length !== 4 || q.correct_index < 0 || q.correct_index > 3) throw new Error('Malformed question')
  const idx = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
  return { question: String(q.question), options: idx.map((i) => String(options[i])), correct_index: idx.indexOf(q.correct_index) }
}

const tasks: Record<string, (i: any) => Promise<unknown>> = {
  skill_map: async (i) => {
    const out = await ask<any>(P.skillMapPrompt.system, P.skillMapPrompt.user(i), { temperature: 0.3 })
    if (!Array.isArray(out.skills) || out.skills.length === 0) throw new Error('Empty skill map')
    return {
      domain_type: ['technical', 'language', 'non-technical'].includes(out.domain_type) ? out.domain_type : 'non-technical',
      skills: out.skills.slice(0, 8).map((s: any) => ({
        skill_name: String(s.skill_name), weight: clamp(s.weight, 0, 1, 0.5), decay_rate: clamp(s.decay_rate, 0.3, 3, 1),
      })),
    }
  },
  next_question: async (i) => shuffled(await ask(P.questionPrompt.system, P.questionPrompt.user(i), { temperature: 0.8 })),
  classify_error: async (i) => {
    const out = await ask<{ error_type: string }>(P.classifyPrompt.system, P.classifyPrompt.user(i), { temperature: 0, maxTokens: 60 })
    return { error_type: ['concept_gap', 'careless', 'misread'].includes(out.error_type) ? out.error_type : 'concept_gap' }
  },
  explain: async (i) => ({
    explanation: await callGroq(P.explainPrompt.system(i.level, i.style), P.explainPrompt.user(i), { temperature: 0.6, maxTokens: 600 }),
  }),
  feynman: async (i) => {
    const out = await ask<any>(P.feynmanPrompt.system, P.feynmanPrompt.user(i), { temperature: 0.2, maxTokens: 300 })
    return { passed: !!out.passed, feedback: String(out.feedback ?? '') }
  },
  // Centerpiece: history is forwarded as real chat turns so the persona stays coherent.
  sim_turn: async (i) => {
    const t: { role: string; text: string }[] = i.transcript ?? []
    const last = t[t.length - 1]
    const learnerTurnPending = last?.role === 'user'
    const prior = learnerTurnPending ? t.slice(0, -1) : t
    const out = await ask<any>(
      P.personaPrompt(i),
      learnerTurnPending ? last.text : '[Your turn. Begin or continue the session.]',
      {
        model: FAST_MODEL, temperature: 0.8, maxTokens: 160,
        history: prior.map((x) => ({ role: x.role === 'user' ? 'user' : 'assistant', content: x.text }) as const),
      },
    )
    return { reply: String(out.reply ?? '').trim(), lang: String(out.lang ?? 'en-US') }
  },
  sim_eval: async (i) => {
    const o = await ask<any>(P.simEvalPrompt.system, P.simEvalPrompt.user(i), { temperature: 0.2, maxTokens: 900 })
    return { ...o, score: clamp(o.score, 0, 100, 0), correctness: clamp(o.correctness, 0, 100, 0), communication: clamp(o.communication, 0, 100, 0) }
  },
  code_problem: async (i) => {
    const o = await ask<any>(P.codeProblemPrompt.system, P.codeProblemPrompt.user(i), { temperature: 0.7, maxTokens: 900 })
    // Models occasionally emit garbled test cases; a bad test would fail correct code, so drop them.
    const tests = (Array.isArray(o.tests) ? o.tests : []).filter((t: any) => t && Array.isArray(t.args) && 'expected' in t)
    if (!/^[A-Za-z_$][\w$]*$/.test(o.function_name) || tests.length < 3) throw new Error('Malformed problem, please retry')
    return { ...o, tests }
  },
  code_review: async (i) => ask(P.codeReviewPrompt.system, P.codeReviewPrompt.user(i), { temperature: 0.3, maxTokens: 500 }),
  resume_analysis: async (i) => {
    const o = await ask<any>(P.resumePrompt.system, P.resumePrompt.user(i), { temperature: 0.2, maxTokens: 1800 })
    return { verified: o.verified ?? [], unclaimed_practiced: o.unclaimed_practiced ?? [], unproven: o.unproven ?? [] }
  },
  transfer: async (i) => {
    const o = await ask<any>(P.transferPrompt.system, P.transferPrompt.user(i), { temperature: 0.3, maxTokens: 800 })
    return { transfers: (o.transfers ?? []).map((t: any) => ({ ...t, transfer_percent: clamp(t.transfer_percent, 0, 100, 10) })) }
  },
  resources: async (i) => {
    const o = await ask<any>(P.resourcesPrompt.system, P.resourcesPrompt.user(i), { temperature: 0.4, maxTokens: 1200 })
    const TYPES = ['video', 'article', 'docs', 'course', 'practice', 'book']
    const clean = (s: unknown, n: number) => String(s ?? '').replace(/https?:\/\/\S+/g, '').slice(0, n).trim() // never pass model-invented URLs through
    const resources = (Array.isArray(o.resources) ? o.resources : []).slice(0, 6).map((r: any) => ({
      title: clean(r.title, 120), type: TYPES.includes(r.type) ? r.type : 'article', provider: clean(r.provider, 60),
      why: clean(r.why, 200), minutes: clamp(r.minutes, 5, 240, 30), search_query: clean(r.search_query, 120),
    })).filter((r: any) => r.title && r.search_query)
    if (resources.length < 3) throw new Error('Could not build a resource list, please retry')
    return { resources }
  },
  coach: async (i) => {
    const o = await ask<any>(P.coachPrompt.system, P.coachPrompt.user(i), { temperature: 0.3, maxTokens: 900 })
    const n = (i.transcript ?? []).length
    const KINDS = ['strong', 'improve', 'flag']
    return { moments: (Array.isArray(o.moments) ? o.moments : [])
      .filter((m: any) => Number.isInteger(m.turn_index) && m.turn_index >= 0 && m.turn_index < n && i.transcript[m.turn_index].role === 'user' && m.tip)
      .map((m: any) => ({ turn_index: m.turn_index, kind: KINDS.includes(m.kind) ? m.kind : 'improve', tip: String(m.tip).slice(0, 240) })).slice(0, 8) }
  },
  weekly_plan: async (i) => {
    // The schedule is built deterministically client-side; the model only adds a summary and per-session tips.
    const n = (i.sessions ?? []).length
    if (!n) throw new Error('No sessions to annotate')
    const o = await ask<any>(P.planPrompt.system, P.planPrompt.user(i), { temperature: 0.5, maxTokens: 1000 })
    const notes = Array.isArray(o.notes) ? o.notes : []
    return { summary: String(o.summary ?? '').slice(0, 300), notes: Array.from({ length: n }, (_, k) => String(notes[k] ?? '').slice(0, 160)) }
  },
  pron_phrases: async (i) => {
    const o = await ask<any>(P.pronPrompt.system, P.pronPrompt.user(i), { temperature: 0.7, maxTokens: 900 })
    const phrases = (Array.isArray(o.phrases) ? o.phrases : []).filter((p: any) => p.text && p.meaning).slice(0, 8)
      .map((p: any) => ({ text: String(p.text).slice(0, 200), meaning: String(p.meaning).slice(0, 200), focus: String(p.focus ?? '').slice(0, 60) }))
    if (phrases.length < 3) throw new Error('Could not build phrases, please retry')
    return { lang: String(o.lang || 'en-US'), phrases }
  },
  peer_questions: async (i) => {
    const o = await ask<any>(P.peerQuestionsPrompt.system, P.peerQuestionsPrompt.user(i), { temperature: 0.7, maxTokens: 1200 })
    const questions = (Array.isArray(o.questions) ? o.questions : []).filter((q: any) => q.q).slice(0, 8)
      .map((q: any) => ({ q: String(q.q).slice(0, 300), listen_for: String(q.listen_for ?? '').slice(0, 300), skill: String(q.skill ?? '').slice(0, 80) }))
    if (questions.length < 3) throw new Error('Could not build questions, please retry')
    return { questions }
  },
  peer_eval: async (i) => {
    const o = await ask<any>(P.peerEvalPrompt.system, P.peerEvalPrompt.user(i), { temperature: 0.2, maxTokens: 900 })
    return { score: clamp(o.score, 0, 100, 0), summary: String(o.summary ?? ''), strengths: Array.isArray(o.strengths) ? o.strengths.slice(0, 5) : [],
      improvements: Array.isArray(o.improvements) ? o.improvements.slice(0, 5) : [], interviewer_feedback: String(o.interviewer_feedback ?? '') }
  },
  ghost: async (i) => {
    const o = await ask<any>(P.ghostPrompt.system, P.ghostPrompt.user(i), { temperature: 0.4, maxTokens: 500 })
    return { points: (o.points ?? []).map((p: any) => ({ day: Number(p.day), score: clamp(p.score, 0, 100, 0) })) }
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // The platform verifies the JWT signature, but the public anon key is also a valid JWT. Require a real signed-in user.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const role = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role
    if (role !== 'authenticated') return json({ error: 'Sign in to use the AI' }, 401)
    const { task, input } = await req.json()
    const handler = tasks[task]
    if (!handler) return json({ error: `Unknown task: ${task}` }, 400)
    const [allowed, result] = await Promise.all([withinQuota(req.headers.get('Authorization')!, 'ai', AI_CALLS_PER_HOUR), handler(input ?? {})])
    if (!allowed) return json({ error: `Hourly AI limit reached (${AI_CALLS_PER_HOUR} requests). Please try again in a while.` }, 429)
    return json(result)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
