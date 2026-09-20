import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { GoalDataProvider } from '../lib/goalData'
import { useTheme } from '../lib/theme'
import { useDueCards } from '../lib/useActivity'
import { supabase } from '../lib/supabase'
import type { Goal } from '../lib/types'

export const LAST_GOAL_KEY = 'learnloop:goal'
export function rememberGoal(id: string) { try { localStorage.setItem(LAST_GOAL_KEY, id) } catch { /* private mode */ } }
const COLLAPSE_KEY = 'learnloop:sidebar-collapsed'

export const Logo = ({ size = 28 }: { size?: number }) => (
  <span className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 shadow-[0_0_20px_-4px_#7c5cff]" style={{ width: size, height: size }}>
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 0 1 14-5.3L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5.3L4 15" /><path d="M4 20v-5h5" /></svg>
  </span>
)

const Icon = ({ children }: { children: ReactNode }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{children}</svg>
)
const NAV: { to: string; label: string; icon: ReactNode; only?: 'language'; badge?: 'due' }[] = [
  { to: 'dashboard', label: 'Dashboard', icon: <Icon><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Icon> },
  { to: 'review', label: 'Review queue', icon: <Icon><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 21v-5h5" /></Icon> },
  { to: 'practice', label: 'Practice', icon: <Icon><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /></Icon> },
  { to: 'flashcards', label: 'Flashcards', badge: 'due', icon: <Icon><rect x="3" y="6" width="14" height="14" rx="2" /><path d="M7 6V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" /></Icon> },
  { to: 'simulate', label: 'Simulate', icon: <Icon><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4" /></Icon> },
  { to: 'pronounce', label: 'Pronunciation', only: 'language', icon: <Icon><path d="M12 3v3M8 7a4 4 0 0 1 8 0v3a4 4 0 0 1-8 0zM5 12a7 7 0 0 0 14 0M12 19v2" /></Icon> },
  { to: 'pods', label: 'Study pods', icon: <Icon><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17.5" cy="9" r="2.5" /><path d="M17 14.2a5.5 5.5 0 0 1 4.5 5.3" /></Icon> },
  { to: 'plan', label: 'Weekly plan', icon: <Icon><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M8 14h3M8 17h6" /></Icon> },
  { to: 'resume', label: 'Resume check', icon: <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></Icon> },
  { to: 'proof', label: 'Proof of work', icon: <Icon><circle cx="12" cy="9" r="6" /><path d="m8.5 14 -1.5 8 5-3 5 3-1.5-8" /></Icon> },
]

function SidebarContent({ goalId, collapsed, onNavigate, onToggle }: { goalId: string; collapsed: boolean; onNavigate?: () => void; onToggle?: () => void }) {
  const { session } = useAuth()
  const nav = useNavigate()
  const [goals, setGoals] = useState<Goal[]>([])
  useEffect(() => {
    // RLS returns the user's own goals plus goals of pods they've joined.
    supabase.from('goals').select('*').order('created_at').then(({ data }) => setGoals((data as Goal[]) ?? []))
  }, [goalId])
  const email = session?.user.email ?? ''
  const due = useDueCards(session!.user.id, goalId)
  const { theme, toggle: toggleTheme } = useTheme()
  const active = goals.find((g) => g.id === goalId)
  const base = `/g/${goalId}`

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between px-1'}`}>
        <Link to={`${base}/dashboard`} onClick={onNavigate} className="flex items-center gap-2.5 font-display text-lg font-bold" title="LearnLoop">
          <Logo size={34} />{!collapsed && <span className="gradient-text">LearnLoop</span>}
        </Link>
      </div>

      {/* active goal */}
      {collapsed ? (
        <button className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white/[.07] font-display font-bold hover:bg-white/15" title={active?.goal_title} onClick={onToggle} aria-label="Expand sidebar">{active?.goal_title[0]?.toUpperCase() ?? '•'}</button>
      ) : (
        <div className="space-y-1.5">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Learning goal</p>
          <div className="relative">
            <select aria-label="Active goal" value={goalId} onChange={(e) => { onNavigate?.(); nav(e.target.value === 'new' ? '/onboarding' : `/g/${e.target.value}/dashboard`) }} className="input appearance-none !py-2.5 pr-9 text-sm font-medium">
              {goals.map((g) => <option key={g.id} value={g.id}>{g.goal_title}</option>)}
              <option value="new">＋ New goal…</option>
            </select>
            <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
          </div>
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
        {!collapsed && <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Menu</p>}
        {NAV.filter((n) => !n.only || active?.domain_type === n.only).map((n) => (
          <NavLink key={n.to} to={`${base}/${n.to}`} onClick={onNavigate} title={collapsed ? n.label : undefined}
            className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-gradient-to-r from-indigo-500/25 to-pink-500/10 text-white shadow-[inset_0_1px_0_rgb(255_255_255/.08)]' : 'text-slate-400 hover:bg-white/[.06] hover:text-white'}`}>
            {({ isActive }) => (<>
              <span className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-300 to-pink-400 transition-all duration-300 ${isActive ? 'opacity-100' : 'h-0 opacity-0'}`} />
              <span className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-indigo-300' : ''}`}>{n.icon}</span>
              {!collapsed && <span className="flex-1">{n.label}</span>}
              {n.badge === 'due' && due > 0 && <span className={`grid min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-slate-950 ${collapsed ? 'absolute right-1 top-1' : ''}`}>{due > 99 ? '99+' : due}</span>}
            </>)}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-2 border-t border-white/10 pt-3">
        <button onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} aria-label="Toggle theme"
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-white/[.06] hover:text-white ${collapsed ? 'justify-center' : ''}`}>
          {theme === 'dark'
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
          {!collapsed && (theme === 'dark' ? 'Light theme' : 'Dark theme')}
        </button>
        {onToggle && (
          <button onClick={onToggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-white/[.06] hover:text-white ${collapsed ? 'justify-center' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}><path d="m11 17-5-5 5-5M18 17l-5-5 5-5" /></svg>
            {!collapsed && 'Collapse'}
          </button>
        )}
        <div className={`flex items-center gap-3 rounded-xl bg-white/[.04] p-2 ${collapsed ? 'justify-center' : ''}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-sm font-bold" title={email}>{email[0]?.toUpperCase()}</span>
          {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{email.split('@')[0]}</p>
            <button className="text-xs text-slate-500 transition-colors hover:text-white" onClick={() => supabase.auth.signOut()}>Sign out</button></div>}
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const { goalId } = useParams()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false } })

  useEffect(() => { rememberGoal(goalId!) }, [goalId])
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    addEventListener('keydown', onKey)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open])
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1') } catch { /* ignore */ } return !c })

  return (
    <div className="min-h-screen">
      {/* desktop sidebar */}
      <aside className={`glass fixed inset-y-0 left-0 z-30 hidden !rounded-none !border-y-0 !border-l-0 transition-[width] duration-300 ease-out lg:block ${collapsed ? 'w-[76px]' : 'w-64'}`}>
        <SidebarContent goalId={goalId!} collapsed={collapsed} onToggle={toggle} />
      </aside>

      {/* mobile top bar + drawer */}
      <header className="glass sticky top-0 z-20 flex items-center gap-3 !rounded-none !border-x-0 !border-t-0 px-4 py-2.5 lg:hidden">
        <button className="grid h-10 w-10 place-items-center rounded-xl text-slate-200 hover:bg-white/10" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
        </button>
        <Link to={`/g/${goalId}/dashboard`} className="flex items-center gap-2 font-display text-lg font-bold"><Logo /><span className="gradient-text">LearnLoop</span></Link>
      </header>
      <div className={`fixed inset-0 z-40 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={() => setOpen(false)} />
        <aside className={`glass absolute inset-y-0 left-0 w-72 max-w-[85vw] !rounded-none !border-y-0 !border-l-0 !bg-slate-900/95 transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          {open && <SidebarContent goalId={goalId!} collapsed={false} onNavigate={() => setOpen(false)} />}
        </aside>
      </div>

      <div className={`transition-[padding] duration-300 ease-out ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
          <GoalDataProvider goalId={goalId!}>
            {/* keyed on path so every navigation replays the entrance transition without refetching goal data */}
            <div key={pathname} className="page-in"><Outlet /></div>
          </GoalDataProvider>
        </main>
      </div>
    </div>
  )
}
