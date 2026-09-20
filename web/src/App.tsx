import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout, { LAST_GOAL_KEY } from './components/Layout'
import Landing from './pages/Landing'
import { ErrorBoundary, Spinner } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Diagnostic from './pages/Diagnostic'
import Flashcards from './pages/Flashcards'
import Onboarding from './pages/Onboarding'
import PeerSession from './pages/PeerSession'
import Plan from './pages/Plan'
import Pronounce from './pages/Pronounce'
import PublicProof from './pages/PublicProof'
import Review from './pages/Review'
import PodDetail from './pages/PodDetail'
import Pods from './pages/Pods'
import Practice from './pages/Practice'
import Proof from './pages/Proof'
import Resume from './pages/Resume'
import Session from './pages/Session'
import SimResult from './pages/SimResult'
import Simulate from './pages/Simulate'

function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-8"><Spinner /></div>
  return session ? <>{children}</> : <Navigate to="/auth" replace />
}

/** Send a signed-in user to their last (or latest) goal, or to onboarding if they have none. */
function Home() {
  const [to, setTo] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('goals').select('id').order('created_at', { ascending: false }).then(({ data }) => {
      let last: string | null = null
      try { last = localStorage.getItem(LAST_GOAL_KEY) } catch { /* ignore */ }
      const id = data?.find((g) => g.id === last)?.id ?? data?.[0]?.id
      setTo(id ? `/g/${id}/dashboard` : '/onboarding')
    })
  }, [])
  return to ? <Navigate to={to} replace /> : <div className="p-8"><Spinner /></div>
}

function AppRoutes() {
  const { session, loading } = useAuth()
  return (
    <Routes>
      <Route path="/" element={loading ? <div className="p-8"><Spinner /></div> : session ? <Home /> : <Landing />} />
      <Route path="/p/:slug" element={<PublicProof />} />
      <Route path="/auth" element={session ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
      <Route path="/g/:goalId" element={<Protected><Layout /></Protected>}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="diagnostic" element={<Diagnostic />} />
        <Route path="review" element={<Review />} />
        <Route path="flashcards" element={<Flashcards />} />
        <Route path="plan" element={<Plan />} />
        <Route path="pronounce" element={<Pronounce />} />
        <Route path="pods/:podId/peer/:sessionId" element={<PeerSession />} />
        <Route path="practice" element={<Practice />} />
        <Route path="practice/:skillId" element={<Practice />} />
        <Route path="pods" element={<Pods />} />
        <Route path="pods/:podId" element={<PodDetail />} />
        <Route path="simulate" element={<Simulate />} />
        <Route path="simulate/:type" element={<Session />} />
        <Route path="simulation/:id" element={<SimResult />} />
        <Route path="resume" element={<Resume />} />
        <Route path="proof" element={<Proof />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return <ErrorBoundary><BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter></ErrorBoundary>
}
