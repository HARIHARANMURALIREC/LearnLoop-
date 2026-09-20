import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { findTransfers } from '../lib/transfer'
import type { Transfer } from '../lib/types'
import { Card } from './ui'

/** "Head start" panel: cross-domain skill transfer reasoning. Renders nothing if there is no real overlap. */
export default function TransferPanel({ goalTitle, skills, goalId }: { goalTitle: string; skills: string[]; goalId?: string }) {
  const { session } = useAuth()
  const [items, setItems] = useState<Transfer[]>([])
  useEffect(() => {
    const key = goalId ? `transfer:${goalId}` : null
    try { const c = key && localStorage.getItem(key); if (c) { setItems(JSON.parse(c)); return } } catch { /* no cache */ }
    findTransfers(session!.user.id, goalTitle, skills, goalId).then((t) => {
      setItems(t)
      try { if (key) localStorage.setItem(key, JSON.stringify(t)) } catch { /* ignore */ }
    }).catch(() => { /* optional feature: fail quietly */ })
  }, [session, goalTitle, goalId, skills.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return null
  return (
    <Card title="🚀 Your head start (skills that transfer)">
      <ul className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium">{t.new_skill}</span> <span className="text-emerald-400">~{t.transfer_percent}% head start</span>
            <span className="text-slate-400"> from {t.from_skill}{t.from_goal ? ` (${t.from_goal})` : ''}</span>
            <p className="text-slate-500">{t.reasoning}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}
