import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Layout'
import { supabase } from '../lib/supabase'

const FEATURES = [
  ['🎯', 'Adaptive diagnostic', 'Finds your real level per sub-skill, not one global label.'],
  ['🎙️', 'Live voice simulation', 'Mock interviews and client calls that talk back in real time.'],
  ['🏅', 'Proof of work', 'A verifiable ledger of what you can actually do.'],
]

const DEMO = { email: 'demo@learnloop.dev', password: 'Demo@12345' }

export default function Auth() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'login' | 'signup'>(params.get('mode') === 'login' ? 'login' : 'signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    const { data, error } = mode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.status === 429 ? 'Too many emails sent recently. Wait a few minutes, or log in if you already have an account.' : error.message)
    else if (mode === 'signup' && !data.session) setNotice('Check your email to confirm your account, then log in.')
    setBusy(false)
  }

  return (
    <div className="relative grid min-h-screen grid-cols-1 overflow-hidden lg:grid-cols-2">
      <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 animate-float rounded-full bg-indigo-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 animate-float rounded-full bg-pink-500/20 blur-3xl [animation-delay:-4s]" />

      <section className="stagger relative z-10 flex min-w-0 flex-col justify-center gap-6 px-6 py-12 lg:px-16">
        <Link to="/" className="flex w-fit items-center gap-2 font-display text-xl font-bold"><Logo size={34} />LearnLoop <span className="ml-2 text-sm font-normal text-slate-500 transition-colors hover:text-white">← Back to home</span></Link>
        <h1 className="font-display text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
          From “I want to become X” to <span className="gradient-text">“I’m provably ready.”</span>
        </h1>
        <p className="max-w-lg text-lg text-slate-400">An adaptive learning platform that diagnoses, teaches, simulates the real thing, and keeps the receipts.</p>
        <ul className="hidden max-w-md space-y-3 sm:block">
          {FEATURES.map(([icon, t, d]) => (
            <li key={t} className="glass lift flex items-start gap-3 rounded-2xl p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-lg">{icon}</span>
              <span><b className="block font-display">{t}</b><span className="text-sm text-slate-400">{d}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative z-10 grid place-items-center px-6 pb-12 lg:py-12">
        <form onSubmit={submit} className="glass fade-up w-full max-w-sm space-y-4 rounded-3xl p-6 sm:p-8 [animation-delay:.2s]">
          <div className="grid grid-cols-2 rounded-xl bg-white/5 p-1 text-sm font-medium">
            {(['signup', 'login'] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(''); setNotice('') }}
                className={`rounded-lg py-1.5 transition-all duration-300 ${mode === m ? 'bg-white/12 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                {m === 'signup' ? 'Sign up' : 'Log in'}</button>
            ))}
          </div>
          <div><h2 className="text-2xl font-bold">{mode === 'signup' ? 'Start your loop' : 'Welcome back'}</h2>
            <p className="text-sm text-slate-400">{mode === 'signup' ? 'Free while we’re in beta.' : 'Pick up where you left off.'}</p></div>
          <input className="input" type="email" placeholder="Email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="relative">
            <input className="input !pr-11" type={show ? 'text' : 'password'} placeholder="Password (6+ chars)" minLength={6} required autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-400 transition-colors hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {show ? <><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="m1 1 22 22" /></>
                  : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
              </svg>
            </button>
          </div>
          {error && <p className="pop rounded-lg bg-red-500/10 p-2 text-sm text-red-300">{error}</p>}
          {notice && <p className="pop rounded-lg bg-emerald-500/10 p-2 text-sm text-emerald-300">{notice}</p>}
          {mode === 'login' && (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-3 text-sm">
              <p className="mb-1 font-medium">🎮 Try the demo account</p>
              <p className="text-slate-400">Email: <span className="select-all font-mono text-slate-200">{DEMO.email}</span></p>
              <p className="text-slate-400">Password: <span className="select-all font-mono text-slate-200">{DEMO.password}</span></p>
              <button type="button" onClick={() => { setEmail(DEMO.email); setPassword(DEMO.password); setError('') }}
                className="mt-2 text-indigo-300 transition-colors hover:text-white">Fill in for me →</button>
            </div>
          )}
          <button className="btn w-full" disabled={busy}>{busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Log in'}</button>
        </form>
      </section>
    </div>
  )
}
