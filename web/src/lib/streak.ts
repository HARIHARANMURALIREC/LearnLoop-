export interface Streak { current: number; best: number; todayDone: boolean; atRisk: boolean; last14: boolean[] }
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Consecutive local days with any learning activity. The streak survives until the end of today, so it's "at risk" rather than broken. */
export function computeStreak(isoDates: string[], now = new Date()): Streak {
  const days = new Set(isoDates.map((t) => key(new Date(t))))
  const back = (n: number) => { const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d }
  const todayDone = days.has(key(back(0)))
  let current = 0
  for (let i = todayDone ? 0 : 1; days.has(key(back(i))); i++) current++
  const sorted = [...days].map((k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m, d).getTime() }).sort((a, b) => a - b)
  let best = 0, run = 0
  sorted.forEach((t, i) => { run = i > 0 && Math.round((t - sorted[i - 1]) / 86_400_000) === 1 ? run + 1 : 1; best = Math.max(best, run) })
  return { current, best, todayDone, atRisk: !todayDone && current > 0, last14: Array.from({ length: 14 }, (_, i) => days.has(key(back(13 - i)))) }
}
