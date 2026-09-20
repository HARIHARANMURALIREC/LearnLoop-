// The single Groq wrapper. Only Edge Functions import this, so GROQ_API_KEY never reaches the browser.
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
export const DEFAULT_MODEL = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-20b'
// Tried in order when the primary model returns nothing usable or is rate-limited (each model has its own quota).
// Must be models this Groq key can access (check GET /openai/v1/models).
const FALLBACK_MODELS = (Deno.env.get('GROQ_FALLBACK_MODELS') ?? 'openai/gpt-oss-120b,qwen/qwen3.8-27b').split(',').map((m) => m.trim()).filter(Boolean)

export interface GroqOpts {
  model?: string
  temperature?: number
  maxTokens?: number
  json?: boolean // request JSON-object mode
  history?: { role: 'user' | 'assistant'; content: string }[] // prior turns (live simulation)
}

// One or more Groq keys, comma-separated in GROQ_API_KEYS (falls back to the single GROQ_API_KEY).
// Quotas are per Groq account, so keys from DIFFERENT accounts add up; keys from one account share a quota.
const KEYS = (Deno.env.get('GROQ_API_KEYS') ?? Deno.env.get('GROQ_API_KEY') ?? '').split(',').map((k) => k.trim()).filter(Boolean)

interface Attempt { model: string; json: boolean; tokenBoost: number }
type Result = { ok: true; content: string } | { ok: false; status: number; body: string; retryAfterMs: number }

async function request(key: string, a: Attempt, sys: string, user: string, o: GroqOpts): Promise<Result> {
  // gpt-oss models spend max_tokens on hidden reasoning first: keep it minimal and leave headroom so the answer isn't truncated to empty.
  const reasoning = a.model.startsWith('openai/gpt-oss')
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: a.model,
      temperature: o.temperature ?? 0.4,
      max_tokens: (o.maxTokens ?? 1024) + (reasoning ? a.tokenBoost : 0),
      ...(reasoning ? { reasoning_effort: 'low' } : {}),
      ...(a.json ? { response_format: { type: 'json_object' } } : {}),
      messages: [{ role: 'system', content: sys }, ...(o.history ?? []), { role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const wait = Number(res.headers.get('retry-after')) * 1000
    return { ok: false, status: res.status, body: await res.text(), retryAfterMs: Number.isFinite(wait) ? wait : 0 }
  }
  const content = (await res.json()).choices?.[0]?.message?.content ?? ''
  // An empty completion is a failure too: it later surfaces as "Failed to validate JSON" or an unparseable reply.
  return content.trim() ? { ok: true, content } : { ok: false, status: 200, body: 'empty completion', retryAfterMs: 0 }
}

let cursor = Math.floor(Math.random() * 1000) // round-robin start so load spreads evenly across keys

/** Runs one attempt across the keys: a rate-limited (429) or rejected (401/403) key just moves us to the next key. */
async function withKeys(a: Attempt, sys: string, user: string, o: GroqOpts): Promise<Result> {
  if (!KEYS.length) throw new Error('GROQ_API_KEYS is not set')
  const start = cursor++ % KEYS.length
  let last: Result = { ok: false, status: 0, body: 'no key tried', retryAfterMs: 0 }
  for (let k = 0; k < KEYS.length; k++) {
    last = await request(KEYS[(start + k) % KEYS.length], a, sys, user, o)
    if (last.ok || ![401, 403, 429].includes(last.status)) return last
  }
  return last // every key was limited/rejected
}

/**
 * Calls Groq, recovering from the failures seen in practice:
 *  - json_validate_failed / empty output (reasoning model ate its token budget) -> retry without strict JSON mode and more headroom
 *  - 429 rate limit -> next API key first, then the fallback models
 * Callers still run parseJson(), which tolerates fences and stray prose.
 */
export async function callGroq(systemPrompt: string, userPrompt: string, opts: GroqOpts = {}): Promise<string> {
  const primary = opts.model ?? DEFAULT_MODEL
  const attempts: Attempt[] = [
    // Headroom is deliberately small: Groq bills max_tokens against the per-minute token limit (8k TPM on free tier).
    { model: primary, json: !!opts.json, tokenBoost: 384 },
    { model: primary, json: false, tokenBoost: 1024 },
    ...FALLBACK_MODELS.filter((m) => m !== primary).map((model) => ({ model, json: !!opts.json, tokenBoost: 384 })),
  ]
  let last = ''
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i]
    const r = await withKeys(a, systemPrompt, userPrompt, opts)
    if (r.ok) return r.content
    last = `Groq ${r.status}: ${r.body}`
    const retryable = r.status === 200 || r.status === 400 || r.status === 429 || r.status >= 500
    if (!retryable) break
    if (r.status === 429) {
      // Rate limits are per model: skip straight to a different model rather than waiting.
      const alt = attempts.findIndex((x, j) => j > i && x.model !== a.model)
      if (alt === -1) { await new Promise((res) => setTimeout(res, Math.min(r.retryAfterMs || 500, 2000))); continue }
      i = alt - 1
    }
  }
  throw new Error(last)
}

// Models sometimes wrap JSON in fences or prose despite instructions; extract defensively.
export function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```(?:json)?/g, '').trim()
  try { return JSON.parse(cleaned) } catch { /* fall through */ }
  const m = cleaned.match(/[\[{][\s\S]*[\]}]/)
  if (!m) throw new Error('Model returned no JSON')
  return JSON.parse(m[0])
}
