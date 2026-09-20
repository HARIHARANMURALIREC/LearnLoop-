import { View } from 'react-native'
import Svg, { Circle, Defs, Line, LinearGradient, Polyline, Stop } from 'react-native-svg'
import type { Snapshot } from '@/lib/types'

const W = 320, H = 170, P = 14
/** Your readiness (gradient) vs. a simulated illustrative benchmark (dashed grey). Not real learner data. */
export function ProgressChart({ snapshots, current, ghost }: { snapshots: Snapshot[]; current: number; ghost: { day: number; score: number }[] | null }) {
  const t0 = snapshots.length ? new Date(snapshots[0].created_at).getTime() : Date.now()
  const day = (t: number | string) => (new Date(t).getTime() - t0) / 86_400_000
  const mine = [...snapshots.map((s) => ({ x: day(s.created_at), y: s.overall })), { x: day(Date.now()), y: current }]
  const xmax = Math.max(28, ...mine.map((p) => p.x), ...(ghost ?? []).map((p) => p.day))
  const sx = (x: number) => P + (x / xmax) * (W - P * 2)
  const sy = (y: number) => H - P - (y / 100) * (H - P * 2)
  const pts = (a: { x: number; y: number }[]) => a.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')
  return (
    <View style={{ aspectRatio: W / H }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Defs><LinearGradient id="ln" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#7c5cff" /><Stop offset="1" stopColor="#f472b6" /></LinearGradient></Defs>
        {[0, 50, 100].map((g) => <Line key={g} x1={P} x2={W - P} y1={sy(g)} y2={sy(g)} stroke="rgba(255,255,255,0.07)" />)}
        <Line x1={P} x2={W - P} y1={sy(80)} y2={sy(80)} stroke="#059669" strokeDasharray="4 4" />
        {ghost && <Polyline points={pts(ghost.map((p) => ({ x: p.day, y: p.score })))} fill="none" stroke="#6f6f8f" strokeWidth={2} strokeDasharray="6 5" />}
        <Polyline points={pts(mine)} fill="none" stroke="url(#ln)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
        {mine.map((p, i) => <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={4} fill="#0e0e1a" stroke="#b063ff" strokeWidth={2} />)}
      </Svg>
    </View>
  )
}
