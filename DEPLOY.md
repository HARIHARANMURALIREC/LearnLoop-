# Deploying LearnLoop for free

Everything below runs on free tiers. Total cost: **$0** (the only optional spend is a custom domain, and the Apple developer fee if you want iOS App Store distribution).

| Piece | Where | Free tier (check current pricing pages) |
|---|---|---|
| Web app | **Cloudflare Pages** (recommended), Netlify or Vercel | Unlimited/generous bandwidth, HTTPS, previews |
| Database, auth, realtime, edge functions | **Supabase** | 500 MB DB, 50k monthly users, 500k function calls/mo, pauses after ~7 idle days |
| AI | **Groq** | ~1,000 requests/day and 8k tokens/min per model, per account |
| Voice | **ElevenLabs** | ~10k characters/month, then the app falls back to the browser voice automatically |
| Android app | **Expo EAS Build** | limited free builds/month (APK you can share) |
| iOS | **PWA** ("Add to Home Screen") | free; App Store needs a $99/yr Apple developer account |

> Vercel's free "Hobby" plan is for non-commercial use. If you might charge for LearnLoop, use Cloudflare Pages or Netlify.

---

## 1. Backend (Supabase) — already done for your project
If you ever set up a new project:
```bash
supabase login
supabase link --project-ref <ref>
supabase db query --linked -f supabase/all_migrations.sql      # or paste it in the SQL editor
supabase secrets set --env-file supabase/functions/.env         # GROQ_API_KEYS, ELEVENLABS_*, etc.
supabase functions deploy ai && supabase functions deploy tts
```
`supabase/functions/.env` holds every secret and is git-ignored. Never commit it, and never put the `service_role` key in the web or mobile app.

### Auth settings (important before sharing the link)
Supabase dashboard → **Authentication → URL Configuration**
- **Site URL**: your deployed address, e.g. `https://learnloop.pages.dev`
- **Redirect URLs**: add the same address (and `http://localhost:5173` for development)

**Email delivery:** Supabase's built-in email sender only allows a few messages per hour. For real users, add free SMTP (Resend, Brevo or Gmail app-password) under **Authentication → SMTP Settings**, and keep **Confirm email** switched on. While testing alone you can switch confirmation off.

### Usage limits (already built in)
Each signed-in user is limited to **400 AI requests/hour** and **300 voice requests/hour**, enforced in the database. Change them without redeploying:
```bash
supabase secrets set AI_CALLS_PER_HOUR=200 TTS_CALLS_PER_HOUR=150
```
Your Groq keys are listed in `GROQ_API_KEYS` (comma-separated). Keys from *different* Groq accounts add up; keys from one account share a quota.

---

## 2. Web app

Put the project on GitHub (Cloudflare/Vercel/Netlify deploy from a repo):
```bash
cd LearnLoop
git init && git add . && git commit -m "LearnLoop"
git branch -M main
git remote add origin https://github.com/<you>/learnloop.git && git push -u origin main
```
`.gitignore` already excludes all `.env` files.

### Option A — Cloudflare Pages (recommended)
1. dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
2. **Root directory:** `web` · **Build command:** `npm run build` · **Output directory:** `dist`
3. **Environment variables** (Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public keys, same as `web/.env.local`).
4. Deploy. You get `https://<name>.pages.dev`. Deep links work thanks to `web/public/_redirects`.

### Option B — Netlify
Add new site → Import from Git → base directory `web`. Build settings are read from `web/netlify.toml`. Add the two `VITE_` variables under Site settings → Environment.

### Option C — Vercel
Import the repo, set **Root Directory** to `web`, add the two `VITE_` variables. `web/vercel.json` handles routing.

Every push to `main` redeploys automatically. `.github/workflows/ci.yml` typechecks and builds each push.

### Install as an app (works on iPhone and Android)
Open the deployed site on the phone → Share/⋮ menu → **Add to Home Screen**. It runs full-screen with its own icon and keeps the app shell available offline.

---

## 3. Keep the free Supabase project awake
Supabase pauses free projects after about a week of no traffic. In your GitHub repo add secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY`; `.github/workflows/keepalive.yml` then pings it twice a week. (If it does pause, press **Restore** in the dashboard; no data is lost.)

---

## 4. Mobile app

**Fastest (free, no accounts):** install **Expo Go** on your phone, then `cd mobile && npx expo start` and scan the QR code. Sign Expo Go and the CLI into the *same* Expo account. Voice *input* needs a dev build (below); typing and the AI voice output work in Expo Go.

**Android APK to share (free):**
```bash
cd mobile
npm i -g eas-cli && eas login
eas init                                   # links the project to your Expo account
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key> --environment preview --visibility plaintext
eas build -p android --profile preview     # returns a download link for an installable .apk
```
Send that link to testers; they enable "install unknown apps" once. For a dev build that includes voice input: `eas build -p android --profile development`.

**iOS:** distributing a native iOS app requires the paid Apple Developer program ($99/year) for TestFlight or the App Store. There is no free route. Until then, use the installable web app above; it works on iPhone.

**Play Store (optional):** one-time $25 Google fee, then `eas build -p android --profile production` and `eas submit -p android`.

**Updates without rebuilding:** `eas update` pushes JavaScript changes over the air (free tier included).

After editing shared logic in `web/src/lib`, run `npm run sync` inside `mobile/`.

---

## 5. Before you share the link publicly
- [ ] **Rotate every key that was pasted into chat** (Groq, ElevenLabs) and update `supabase/functions/.env`, then `supabase secrets set --env-file supabase/functions/.env`.
- [ ] Confirm **Site URL / Redirect URLs** and SMTP are set (section 1).
- [ ] Check usage occasionally: Groq console, ElevenLabs dashboard, Supabase → Reports.
- [ ] Row-level security is on for every table. Re-run the checks after any schema change.
- [ ] Optional: a custom domain (~$10/yr) in Cloudflare Pages → Custom domains. The free `*.pages.dev` address is fine to start.

## What to expect at scale
The free AI quota (about 2,000 requests/day across your two Groq accounts) supports roughly 20–50 active learners per day. Past that, add Groq keys from more accounts, or move Groq to its paid tier (pay-as-you-go, cheap for these small models).

## Welcome & reminder emails (Resend, free: 100 mails/day)
- Secrets (set with `supabase secrets set --env-file supabase/functions/.env`): `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL` (your deployed URL), `CRON_SECRET`.
- **Sender:** without a verified domain, Resend only delivers `onboarding@resend.dev` mail to *your own Resend account email*. To mail real users, verify a domain at resend.com/domains and set `EMAIL_FROM="LearnLoop <hello@yourdomain.com>"`.
- Welcome mail: sent once per user on first sign-in (`profiles.welcomed_at`). Reminders: a `pg_cron` job (`learnloop-reminders`, daily 15:00 UTC) calls the `email` function; users with due flashcards or 2+ idle days get one mail, with an unsubscribe link.
- The cron job lives in the database (`supabase/migrations/0006_reminder_cron.sql` — replace `<CRON_SECRET>` with your secret before applying; the file is git-ignored).
