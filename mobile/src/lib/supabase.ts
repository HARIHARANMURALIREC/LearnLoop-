import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'
import { AppState } from 'react-native'

// Same Supabase project as web. Only the public anon key ships in the app; Groq/ElevenLabs keys stay in Edge Functions.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
})

// Tokens only refresh while the app is foregrounded.
AppState.addEventListener('change', (s) => { if (s === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh() })
