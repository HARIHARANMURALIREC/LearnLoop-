import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useInView } from './hooks'

/** Fades/slides children in when scrolled into view. `delay` (ms) staggers siblings. */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: ElementType }) {
  const [ref, seen] = useInView<HTMLDivElement>()
  return <Tag ref={ref} className={`reveal ${seen ? 'in' : ''} ${className}`} style={{ '--d': `${delay}ms` } as CSSProperties}>{children}</Tag>
}

/** Card whose glow follows the cursor. */
export function Spot({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className={`spot glass lift h-full rounded-3xl p-5 ${className}`}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`); e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`) }}>
        {children}
      </div>
    </Reveal>
  )
}
