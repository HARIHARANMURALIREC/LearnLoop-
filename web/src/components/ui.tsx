import { Component, useEffect, useState, type ReactNode } from 'react'

export const Spinner = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex items-center gap-3 text-slate-400 fade-up" role="status">
    <span className="relative h-5 w-5">
      <span className="absolute inset-0 rounded-full border-2 border-white/10" />
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-indigo-400" />
    </span>
    <span className="animate-pulse">{label}</span>
  </div>
)

/** Placeholder blocks shown while page data loads. */
export const Skeleton = ({ className = 'h-24' }: { className?: string }) => <div className={`skeleton ${className}`} />

export const ErrorBox = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="pop flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
    <span>{message}</span>
    {onRetry && <button className="shrink-0 rounded-lg border border-red-400/40 px-2 py-0.5 hover:bg-red-400/10" onClick={onRetry}>Retry</button>}
  </div>
)

export const Empty = ({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) => (
  <div className="fade-up space-y-2 rounded-2xl border border-dashed border-white/15 p-8 text-center">
    <div className="mx-auto mb-1 grid h-10 w-10 place-items-center rounded-full bg-white/5 text-lg">✦</div>
    <p className="font-display text-lg font-semibold">{title}</p>
    {hint && <p className="text-sm text-slate-400">{hint}</p>}
    {children}
  </div>
)

export const Card = ({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) => (
  <section className={`glass rounded-2xl p-4 sm:p-5 ${className}`}>
    {title && <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h2>}
    {children}
  </section>
)

/** Counts up to `value` with an ease-out curve. */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); return }
    let raf = 0; const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      setN(value * (1 - (1 - k) ** 3))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{Math.round(n)}</>
}

/** Circular gauge; the ring sweeps in via a CSS transition on stroke-dashoffset. */
export function Gauge({ value, max = 100, size = 132, children }: { value: number; max?: number; size?: number; children?: ReactNode }) {
  const [v, setV] = useState(0)
  useEffect(() => { const id = requestAnimationFrame(() => setV(value)); return () => cancelAnimationFrame(id) }, [value])
  const r = size / 2 - 10, c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs><linearGradient id="gauge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7c5cff" /><stop offset="1" stopColor="#f472b6" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / .07)" strokeWidth="9" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#gauge)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, v / max))} style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.3,.7,.2,1)', filter: 'drop-shadow(0 0 8px #7c5cff88)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="glass pop max-w-sm space-y-3 rounded-2xl p-6">
          <h1 className="text-xl font-bold">Something broke</h1>
          <p className="text-sm text-slate-400">{this.state.err.message}</p>
          <button className="btn" onClick={() => location.assign('/')}>Reload</button>
        </div>
      </div>
    )
  }
}
