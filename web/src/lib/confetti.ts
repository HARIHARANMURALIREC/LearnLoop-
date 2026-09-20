/** Fire-and-forget confetti burst on a temporary full-screen canvas. No-op when the user prefers reduced motion. */
export function fireConfetti(count = 120) {
  if (typeof document === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const cv = document.createElement('canvas')
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '100' })
  cv.width = innerWidth; cv.height = innerHeight
  document.body.appendChild(cv)
  const ctx = cv.getContext('2d')!
  const colors = ['#7c5cff', '#b063ff', '#f472b6', '#22d3ee', '#fbbf24', '#34d399']
  const ps = Array.from({ length: count }, () => ({
    x: cv.width / 2 + (Math.random() - 0.5) * 200, y: cv.height * 0.55, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 16 - 6,
    w: 6 + Math.random() * 6, h: 4 + Math.random() * 5, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0],
  }))
  const t0 = performance.now()
  const tick = (t: number) => {
    const age = t - t0
    ctx.clearRect(0, 0, cv.width, cv.height)
    for (const p of ps) {
      p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 2600); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore()
    }
    if (age < 2600) requestAnimationFrame(tick); else cv.remove()
  }
  requestAnimationFrame(tick)
}
