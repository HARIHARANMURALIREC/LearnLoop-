import { useEffect, useRef } from 'react'

const COLORS = ['#9d86ff', '#f472b6', '#22d3ee', '#c4b5ff']

/** Interactive particle field: drifting dots, proximity lines, and cursor repulsion. Pauses off-screen. */
export default function Particles({ className = '' }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = canvas.current!, ctx = cv.getContext('2d')!
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0, h = 0, raf = 0, visible = true
    const mouse = { x: -999, y: -999 }
    type P = { x: number; y: number; vx: number; vy: number; r: number; c: string }
    let ps: P[] = []

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      w = cv.clientWidth; h = cv.clientHeight
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.round(Math.min(90, (w * h) / 14000))
      ps = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: Math.random() * 1.8 + 0.6, c: COLORS[(Math.random() * COLORS.length) | 0] }))
    }
    const frame = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of ps) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy
        if (d2 < 130 * 130 && d2 > 0) { const d = Math.sqrt(d2), f = (130 - d) / 130; p.vx += (dx / d) * f * 0.25; p.vy += (dy / d) * f * 0.25 }
        p.vx *= 0.985; p.vy *= 0.985
        p.x += p.vx + (Math.random() - 0.5) * 0.04; p.y += p.vy + (Math.random() - 0.5) * 0.04
        if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fillStyle = p.c; ctx.globalAlpha = 0.85; ctx.fill()
      }
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy
        if (d2 < 120 * 120) { ctx.globalAlpha = (1 - Math.sqrt(d2) / 120) * 0.22; ctx.strokeStyle = '#9d86ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
      }
      ctx.globalAlpha = 1
      if (visible && !reduce) raf = requestAnimationFrame(frame)
    }
    const move = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top }
    const leave = () => { mouse.x = mouse.y = -999 }
    const ro = new ResizeObserver(() => { resize(); if (reduce) frame() }); ro.observe(cv)
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; cancelAnimationFrame(raf); if (visible) frame() }); io.observe(cv)
    addEventListener('pointermove', move); document.addEventListener('pointerleave', leave)
    resize(); frame()
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave) }
  }, [])
  return <canvas ref={canvas} className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden />
}
