// Pronunciation scoring from speech-to-text output: how close is what the recognizer heard to the target phrase?
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim()

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

/** 0-100. Accent-insensitive (recognizers often drop diacritics), character-level so near misses score partial credit. */
export function pronScore(target: string, heard: string): number {
  const a = norm(target), b = norm(heard)
  if (!a) return 0
  return Math.max(0, Math.round((1 - lev(a, b) / Math.max(a.length, b.length)) * 100))
}

export interface WordDiff { word: string; ok: boolean }
/** Which target words were heard (in order). Words the learner said but weren't in the target are ignored. */
export function diffWords(target: string, heard: string): WordDiff[] {
  const t = target.split(/\s+/).filter(Boolean), h = norm(heard).split(' ').filter(Boolean)
  const tn = t.map(norm), m = tn.length, n = h.length
  const L = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  const close = (x: string, y: string) => x === y || (x.length > 3 && lev(x, y) <= 1) // one slip in a longer word still counts
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) L[i][j] = close(tn[i - 1], h[j - 1]) ? L[i - 1][j - 1] + 1 : Math.max(L[i - 1][j], L[i][j - 1])
  const ok = Array(m).fill(false)
  for (let i = m, j = n; i > 0 && j > 0;) { if (close(tn[i - 1], h[j - 1])) { ok[i - 1] = true; i--; j-- } else if (L[i - 1][j] >= L[i][j - 1]) i--; else j-- }
  return t.map((word, i) => ({ word, ok: ok[i] }))
}
