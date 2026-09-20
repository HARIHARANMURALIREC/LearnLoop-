import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true })
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Welcome mail: the function sends it at most once per user (server-side flag), so calling on every fresh session is safe.
  const welcomed = useRef<string | null>(null)
  useEffect(() => {
    const id = session?.user.id
    if (!id || welcomed.current === id) return
    welcomed.current = id
    supabase.functions.invoke('email', { body: { type: 'welcome' } }).catch(() => {})
  }, [session])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthCtx.Provider value={{ session, loading }}>{children}</AuthCtx.Provider>
}
