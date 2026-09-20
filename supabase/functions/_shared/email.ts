// Resend wrapper + minimal HTML templates. RESEND_API_KEY / EMAIL_FROM / SITE_URL are Edge Function secrets.
const SITE = () => (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

// A plain-text alternative alongside the HTML noticeably helps inbox placement.
const toText = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, '$2: $1')
  .replace(/<(br|\/p|\/h1|\/tr)\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim()

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; detail: string }> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return { ok: false, detail: 'RESEND_API_KEY not set' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM') ?? 'LearnLoop <onboarding@resend.dev>', to, subject, html, text: toText(html) }),
  })
  return { ok: res.ok, detail: (await res.text()).slice(0, 300) }
}

function shell(title: string, body: string, footer = '') {
  return `<!doctype html><html><body style="margin:0;background:#0b0a1a;font-family:Inter,Arial,sans-serif;color:#e5e7eb">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#15132b;border:1px solid #2a2750;border-radius:20px">
<tr><td style="padding:32px">
<div style="font-size:20px;font-weight:700;color:#fff">🔁 LearnLoop</div>
<h1 style="font-size:26px;line-height:1.2;color:#fff;margin:24px 0 12px">${title}</h1>
${body}
</td></tr></table>
<p style="font-size:12px;color:#6b7280;margin:16px 0 0">${footer}</p>
</td></tr></table></body></html>`
}
const btn = (label: string, href: string) =>
  `<p style="margin:24px 0 0"><a href="${href}" style="display:inline-block;background:#7c5cff;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px">${label}</a></p>`
const p = (t: string) => `<p style="font-size:15px;line-height:1.6;color:#c7c9d9;margin:0 0 12px">${t}</p>`

export function welcomeEmail(name: string, field: string | null) {
  const body = p(`Great to have you here. LearnLoop finds your real level in each sub-skill, teaches you what's weak, and lets you rehearse the real thing out loud.`) +
    (field ? p(`You picked <b style="color:#fff">${esc(field)}</b> — start by telling us the exact role or skill you're aiming for.`) : '') +
    p('<b style="color:#fff">Your first 10 minutes:</b><br>1. Set a goal &nbsp;2. Take the adaptive diagnostic &nbsp;3. Do one practice round') + btn('Start my first goal', SITE())
  return { subject: `Welcome to LearnLoop, ${name} 👋`, html: shell(`Welcome, ${esc(name)}!`, body, 'You got this because you created a LearnLoop account.') }
}

export function reminderEmail(name: string, goal: string | null, due: number, idleDays: number, unsubUrl: string) {
  const lines: string[] = []
  if (due > 0) lines.push(`🃏 <b style="color:#fff">${due} flashcard${due === 1 ? ' is' : 's are'} due</b> — reviewing now keeps them from fading.`)
  if (idleDays >= 2) lines.push(`🔥 It's been ${idleDays} days. Skills decay — a 5-minute review restores them.`)
  const body = p(`Hi ${esc(name)}, a quick nudge${goal ? ` for <b style="color:#fff">${esc(goal)}</b>` : ''}:`) + lines.map(p).join('') + btn('Do a 5-minute review', SITE())
  return {
    subject: due > 0 ? `${due} card${due === 1 ? '' : 's'} due on LearnLoop` : `Keep your LearnLoop skills sharp`,
    html: shell('Time for a quick review', body, `<a href="${unsubUrl}" style="color:#6b7280">Unsubscribe from reminders</a>`),
  }
}
