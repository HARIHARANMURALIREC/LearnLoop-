import type { Snapshot } from '../lib/types'

const W = 600, H = 220, P = 32
/** Your readiness (solid) vs. a simulated illustrative benchmark (dashed). Not real learner data. */
export default function ProgressChart({ snapshots, current, ghost }: {
  snapshots: Snapshot[]; current: number; ghost: { day: number; score: number }[] | null
}) {
  const t0 = snapshots.length ? new Date(snapshots[0].created_at).getTime() : Date.now()
  const day = (iso: string | number) => (new Date(iso).getTime() - t0) / 86_400_000
  const mine = [...snapshots.map((s) => ({ x: day(s.created_at), y: s.overall })), { x: day(Date.now()), y: current }]
  const xmax = Math.max(28, ...mine.map((p) => p.x), ...(ghost ?? []).map((p) => p.day))
  const sx = (x: number) => P + (x / xmax) * (W - P * 2)
  const sy = (y: number) => H - P - (y / 100) * (H - P * 2)
  const line = (pts: { x: number; y: number }[]) => pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Progress chart: your readiness versus simulated benchmark">
      {[0, 25, 50, 80, 100].map((g) => (
        <g key={g}><line x1={P} x2={W - P} y1={sy(g)} y2={sy(g)} stroke={g === 80 ? '#059669' : 'var(--color-slate-800)'} strokeDasharray={g === 80 ? '4 4' : ''} />
          <text x={4} y={sy(g) + 4} fontSize="10" fill="var(--color-slate-500)">{g}</text></g>
      ))}
      {ghost && <polyline fill="none" stroke="var(--color-slate-500)" strokeWidth="2" strokeDasharray="6 5" points={line(ghost.map((p) => ({ x: p.day, y: p.score })))} />}
      <defs><linearGradient id="ln" x1="0" x2="1"><stop offset="0" stopColor="#7c5cff" /><stop offset="1" stopColor="#f472b6" /></linearGradient></defs>
      <polyline className="draw" pathLength={1} fill="none" stroke="url(#ln)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px #7c5cff99)' }} points={line(mine)} />
      {mine.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4" fill="var(--color-slate-900)" stroke="#b063ff" strokeWidth="2" className="pop" style={{ animationDelay: `${0.4 + i * 0.1}s`, transformOrigin: 'center', transformBox: 'fill-box' }} />)}
      <text x={W - P} y={H - 8} fontSize="10" fill="var(--color-slate-500)" textAnchor="end">days →</text>
    </svg>
  )
}
