# LearnLoop

- `web/` – Vite + React + TS + Tailwind app
- `supabase/` – migrations (schema + RLS) and the `ai` Edge Function (the only place the Groq key lives)

## Setup
1. Create a Supabase project. Run `supabase link --project-ref <ref>` then `supabase db push`.
2. `supabase secrets set GROQ_API_KEY=... [GROQ_MODEL=openai/gpt-oss-20b] [GROQ_FAST_MODEL=openai/gpt-oss-20b]`
3. `supabase functions deploy ai`
4. `cp web/.env.example web/.env.local` and fill in the project URL + anon key.
5. `cd web && npm run dev`

`supabase db push` applies both migrations (`0001_schema.sql`, `0002_phases.sql`). Voice needs Chrome or Edge (Web Speech API) and HTTPS or localhost.

## Deploy
See **[DEPLOY.md](DEPLOY.md)** for the step-by-step free deployment guide (Cloudflare Pages / Netlify / Vercel, Supabase, EAS).
