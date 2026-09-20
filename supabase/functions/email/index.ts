// POST { type: 'welcome' }            (user JWT)      -> sends the welcome mail once per user
// POST { type: 'reminders' }          (x-cron-secret) -> daily nudge for users with due cards / idle 2+ days
// GET  ?unsub=<uid>&sig=<hmac>                        -> one-click reminder unsubscribe
import { reminderEmail, sendEmail, welcomeEmail } from '../_shared/email.ts'

const URL_ = Deno.env.get('SUPABASE_URL')!
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const MAX_PER_RUN = 80 // Resend free tier: 100 mails/day
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const svc = { apikey: SRK, Authorization: `Bearer ${SRK}` }
const rest = (path: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...svc, 'Content-Type': 'application/json', ...init.headers } })

async function sign(uid: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(CRON_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(uid))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

async function userEmail(id: string): Promise<string | null> {
  const r = await fetch(`${URL_}/auth/v1/admin/users/${id}`, { headers: svc })
  return r.ok ? (await r.json()).email ?? null : null
}

async function welcome(req: Request) {
  const r = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: SRK, Authorization: req.headers.get('Authorization') ?? '' } })
  if (!r.ok) return json({ error: 'Sign in first' }, 401)
  const user = await r.json()
  if (!user.email) return json({ sent: false })
  // claim atomically so a double call (two tabs) can't send twice
  const claim = await rest(`profiles?id=eq.${user.id}&welcomed_at=is.null`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ welcomed_at: new Date().toISOString() }),
  })
  const rows = await claim.json()
  if (!Array.isArray(rows) || !rows.length) return json({ sent: false, reason: 'already welcomed' })
  const { subject, html } = welcomeEmail(rows[0].display_name ?? 'there', rows[0].field)
  const res = await sendEmail(user.email, subject, html)
  if (!res.ok) { // let the next login retry
    await rest(`profiles?id=eq.${user.id}`, { method: 'PATCH', body: JSON.stringify({ welcomed_at: null }) })
    return json({ sent: false, error: res.detail }, 502)
  }
  return json({ sent: true })
}

async function reminders() {
  const now = Date.now()
  const stale = new Date(now - 20 * 3600e3).toISOString()
  const res = await rest(`profiles?select=id,display_name,created_at&email_reminders=eq.true&or=(last_reminded_at.is.null,last_reminded_at.lt.${stale})&limit=300`)
  const profiles = await res.json() as { id: string; display_name: string; created_at: string }[]
  let sent = 0, skipped = 0, failed = 0
  for (const pr of profiles) {
    if (sent >= MAX_PER_RUN) break
    if (now - Date.parse(pr.created_at) < 20 * 3600e3) { skipped++; continue } // brand new: they just got the welcome mail
    const [cards, last, goal] = await Promise.all([
      rest(`flashcards?select=id&user_id=eq.${pr.id}&due_at=lte.${new Date().toISOString()}`, { headers: { Prefer: 'count=exact', Range: '0-0' } }),
      rest(`attempts?select=created_at&user_id=eq.${pr.id}&order=created_at.desc&limit=1`).then((r) => r.json()),
      rest(`goals?select=goal_title&user_id=eq.${pr.id}&order=created_at.desc&limit=1`).then((r) => r.json()),
    ])
    const due = Number(cards.headers.get('content-range')?.split('/')[1] ?? 0)
    const lastAt = last[0]?.created_at ? Date.parse(last[0].created_at) : Date.parse(pr.created_at)
    const idle = Math.floor((now - lastAt) / 86400e3)
    if (due === 0 && idle < 2) { skipped++; continue }
    const to = await userEmail(pr.id)
    if (!to) { skipped++; continue }
    const unsub = `${URL_}/functions/v1/email?unsub=${pr.id}&sig=${await sign(pr.id)}`
    const { subject, html } = reminderEmail(pr.display_name ?? 'there', goal[0]?.goal_title ?? null, due, idle, unsub)
    const out = await sendEmail(to, subject, html)
    if (out.ok) {
      sent++
      await rest(`profiles?id=eq.${pr.id}`, { method: 'PATCH', body: JSON.stringify({ last_reminded_at: new Date().toISOString() }) })
    } else failed++
  }
  return json({ sent, skipped, failed })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const u = new URL(req.url)
    if (req.method === 'GET' && u.searchParams.has('unsub')) {
      const uid = u.searchParams.get('unsub')!
      if (!CRON_SECRET || u.searchParams.get('sig') !== await sign(uid)) return new Response('Invalid link', { status: 400 })
      await rest(`profiles?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ email_reminders: false }) })
      // Supabase serves function responses as text/plain, so keep this a plain message
      return new Response('You are unsubscribed from LearnLoop reminders. You can close this tab.', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
    const { type } = await req.json().catch(() => ({}))
    if (type === 'welcome') return await welcome(req)
    if (type === 'reminders') {
      if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'Forbidden' }, 403)
      return await reminders()
    }
    return json({ error: 'Unknown type' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Email failed' }, 500)
  }
})
