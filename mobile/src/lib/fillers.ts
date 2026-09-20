// AUTO-COPIED from web/src/lib/fillers.ts by scripts/sync-shared.sh — edit the web file, not this one.
const FILLERS = ['um', 'uh', 'er', 'erm', 'like', 'you know', 'basically', 'actually', 'sort of', 'kind of', 'i mean', 'literally']
const RE = new RegExp(`\\b(${FILLERS.join('|')})\\b`, 'gi')

export interface SpeechStats { turns: number; words: number; avgWords: number; fillers: number; per100: number; top: [string, number][] }
/** Deterministic delivery stats over the learner's turns. */
export function speechStats(transcript: { role: string; text: string }[]): SpeechStats {
  const mine = transcript.filter((t) => t.role === 'user')
  const words = mine.reduce((a, t) => a + t.text.split(/\s+/).filter(Boolean).length, 0)
  const counts = new Map<string, number>()
  for (const t of mine) for (const m of t.text.matchAll(RE)) counts.set(m[1].toLowerCase(), (counts.get(m[1].toLowerCase()) ?? 0) + 1)
  const fillers = [...counts.values()].reduce((a, b) => a + b, 0)
  return { turns: mine.length, words, avgWords: mine.length ? Math.round(words / mine.length) : 0, fillers, per100: words ? Math.round((fillers / words) * 1000) / 10 : 0, top: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4) }
}
