// Deterministic weekly planner: minutes go where the need is greatest. The AI only writes tips afterwards.
export type Activity = 'practice' | 'review' | 'flashcards' | 'simulate' | 'teach'
export interface PlanSession { skill: string; activity: Activity; minutes: number; note?: string }
export interface PlanDay { day: string; sessions: PlanSession[] }
export interface PlanSkill { name: string; eff: number; mastery: number; weight: number; flagged: boolean }
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const STUDY_DAYS = DAYS.slice(0, 6) // Sunday is rest
const r5 = (n: number) => Math.round(n / 5) * 5

export function buildPlan(skills: PlanSkill[], hoursPerWeek: number): PlanDay[] {
  const days: PlanDay[] = DAYS.map((day) => ({ day, sessions: [] }))
  const maxPerDay = hoursPerWeek > 8 ? 4 : 3
  if (!skills.length || hoursPerWeek <= 0) return days
  let total = r5(hoursPerWeek * 60)
  const byWeak = [...skills].sort((a, b) => a.eff - b.eff)
  const strongest = [...skills].sort((a, b) => b.eff - a.eff)[0]

  // Fixed anchors first: a live simulation on Saturday and a teach-back midweek, if there's enough time.
  if (total >= 180) { days[5].sessions.push({ skill: byWeak[0].name, activity: 'simulate', minutes: 30 }); total -= 30 }
  if (total >= 120 && strongest.eff >= 65) { days[2].sessions.push({ skill: strongest.name, activity: 'teach', minutes: 20 }); total -= 20 }

  const need = (s: PlanSkill) => s.weight * Math.max(5, 85 - s.eff) * (s.flagged ? 1.3 : 1)
  const sum = skills.reduce((a, s) => a + need(s), 0)
  const queue: (PlanSession & { n: number })[] = []
  for (const s of byWeak) {
    const mins = (total * need(s)) / sum
    if (mins < 10) continue
    const k = Math.max(1, Math.round(mins / 30))
    const per = Math.min(60, Math.max(10, r5(mins / k)))
    for (let j = 0; j < k; j++) {
      const decayed = s.mastery - s.eff >= 5
      const activity: Activity = j === 0 ? 'practice' : decayed ? 'review' : s.flagged ? 'flashcards' : 'practice'
      queue.push({ skill: s.name, activity, minutes: per, n: need(s) })
    }
  }
  queue.sort((a, b) => b.n - a.n)
  // Spread across study days: fewest sessions first, never the same skill twice in one day, capped per day.
  for (const q of queue) {
    const open = STUDY_DAYS.map((_, i) => days[i]).filter((d) => d.sessions.length < maxPerDay && !d.sessions.some((x) => x.skill === q.skill))
    const day = open.sort((a, b) => a.sessions.length - b.sessions.length)[0]
    if (day) day.sessions.push({ skill: q.skill, activity: q.activity, minutes: q.minutes })
  }
  return days
}

export const totalMinutes = (days: PlanDay[]) => days.reduce((a, d) => a + d.sessions.reduce((b, s) => b + s.minutes, 0), 0)

/** RFC 5545 calendar file so the plan shows up in Google/Apple/Outlook. Times are floating (local). */
export function planToIcs(days: PlanDay[], goalTitle: string, startHour: number): string {
  const monday = new Date(); monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7) % 7) // next Monday (today if Monday would be in the past)
  const p2 = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`
  const esc = (t: string) => t.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LearnLoop//Study Plan//EN', 'CALSCALE:GREGORIAN']
  days.forEach((d, di) => {
    let cursor = new Date(monday); cursor.setDate(monday.getDate() + di); cursor.setHours(startHour, 0, 0, 0)
    d.sessions.forEach((s, si) => {
      const end = new Date(cursor.getTime() + s.minutes * 60_000)
      lines.push('BEGIN:VEVENT', `UID:learnloop-${fmt(cursor)}-${si}@learnloop`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(cursor)}`, `DTEND:${fmt(end)}`,
        `SUMMARY:${esc(`LearnLoop: ${s.skill} (${s.activity})`)}`, `DESCRIPTION:${esc(`${goalTitle} - ${s.note ?? ''}`)}`,
        'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Study session starting', 'END:VALARM', 'END:VEVENT')
      cursor = new Date(end.getTime() + 10 * 60_000)
    })
  })
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
