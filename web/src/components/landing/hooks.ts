import { useEffect, useRef, useState } from 'react'

/** True (once) after the element first scrolls into view. */
export function useInView<T extends Element>(threshold = 0.15) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold, rootMargin: '0px 0px -8% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, seen] as const
}

/** Page scroll progress 0..1 for the top progress bar. */
export function useScrollProgress() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const on = () => { const h = document.documentElement; setP(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) }
    on(); addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [])
  return p
}
