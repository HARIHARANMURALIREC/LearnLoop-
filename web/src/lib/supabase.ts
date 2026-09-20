import { createClient } from '@supabase/supabase-js'

// Only the public anon key ships to the browser; Groq's key stays in the Edge Function.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
