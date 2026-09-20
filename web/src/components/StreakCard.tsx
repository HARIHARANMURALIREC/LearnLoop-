import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Streak } from '../lib/streak'
import { Card, CountUp } from './ui'

const KEY = 'learnloop:remind'
/** Browser notification opt-in. It fires when you open the app with a streak at risk or cards due (no server push). */
function useReminder(streak: Streak | null, due: number, fading: number) {
  const [on, setOn] = useState(() => { try { return localStorage.getItem(KEY) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted' } catch { return false } })
  useEffect(() => {
    if (!on || !streak || typeof Notification === 'undefined') return
    const today = new Date().toDateString()
    try { if (localStorage.getItem('learnloop:notified') === today) return } catch { /* ignore */ }
    const msg = streak.atRisk ? `Keep your ${streak.current}-day streak alive — a 5 minute session is enough.` : due > 0 ? `${due} flashcard${due > 1 ? 's are' : ' is'} due for review.` : fading > 0 ? `${fading} skill${fading > 1 ? 's are' : ' is'} fading. A quick review restores them.` : ''
    if (!msg) return
    new Notification('LearnLoop', { body: msg }); try { localStorage.setItem('learnloop:notified', today) } catch { /* ignore */ }
  }, [on, streak, due, fading])
  async function toggle() {
    if (typeof Notification === 'undefined') return alert('This browser does not support notifications.')
    if (on) { try { localStorage.setItem(KEY, '0') } catch { /* ignore */ } return setOn(false) }
    const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (p === 'granted') { try { localStorage.setItem(KEY, '1') } catch { /* ignore */ } setOn(true) }
  }
  return { on, toggle }
}

export default function StreakCard({ streak, due, fading, base }: { streak: Streak | null; due: number; fading: number; base: string }) {
  const rem = useReminder(streak, due, fading)
  if (!streak) return null
  const msg = streak.todayDone ? "Today's practice is done ✓" : streak.atRisk ? 'Practice today to keep your streak alive!' : 'Practice today to start a streak'
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card title="Learning streak">
        <div className="flex items-center gap-4">
          <span className={`text-5xl ${streak.current > 0 ? 'bob' : 'grayscale'}`} aria-hidden>🔥</span>
          <div><p className="font-display text-4xl font-bold leading-none"><CountUp value={streak.current} /><span className="ml-1 text-base font-normal text-slate-400">day{streak.current === 1 ? '' : 's'}</span></p>
            <p className={`text-sm ${streak.atRisk ? 'text-amber-300' : 'text-slate-400'}`}>{msg}</p></div>
        </div>
        <div className="mt-3 flex gap-1" aria-label="Last 14 days">{streak.last14.map((d, i) => <span key={i} className={`h-2 flex-1 rounded-full ${d ? 'bg-gradient-to-r from-indigo-400 to-pink-400' : 'bg-white/10'}`} />)}</div>
        <p className="mt-1.5 text-xs text-slate-500">Best streak: {streak.best} day{streak.best === 1 ? '' : 's'}</p>
      </Card>
      <Card title="Today">
        <div className="space-y-2 text-sm">
          <Link to={`${base}/flashcards`} className="lift flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-3 py-2.5"><span>🗂️ Flashcards due</span><b className={due ? 'text-amber-300' : 'text-slate-500'}>{due}</b></Link>
          <Link to={`${base}/review`} className="lift flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-3 py-2.5"><span>🔁 Skills fading</span><b className={fading ? 'text-amber-300' : 'text-slate-500'}>{fading}</b></Link>
        </div>
        <button onClick={rem.toggle} className="mt-3 text-xs text-slate-400 underline hover:text-white">{rem.on ? '🔔 Reminders on — turn off' : '🔕 Remind me when I open the app'}</button>
      </Card>
    </div>
  )
}
