<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,14,20&height=200&section=header&text=LearnLoop&fontSize=64&fontAlignY=38&animation=fadeIn&desc=Learn%20%E2%86%92%20Practice%20%E2%86%92%20Feedback%20%E2%86%92%20Improve&descAlignY=60" alt="LearnLoop banner"/>

<a href="https://github.com/HARIHARANMURALIREC/LearnLoop-">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&color=6366F1&center=true&vCenter=true&width=620&lines=AI-powered+learning+loop;React+%2B+Vite+%2B+TypeScript+%2B+Tailwind;Supabase+backend+with+Edge+Functions;Groq+LLM+%E2%80%A2+Voice+input+%E2%80%A2+Web+%26+Mobile" alt="Typing animation"/>
</a>

<br/>

<img src="assets/loop.svg" alt="Animated LearnLoop cycle" width="780"/>

<br/><br/>

[![Live Demo](https://img.shields.io/badge/Live-Demo-6366f1?style=for-the-badge&logo=vercel&logoColor=white)](https://learnloop-orpin.vercel.app)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

</div>

---

## 📚 Table of Contents
- [Overview](#-overview)
- [How It Works](#-how-it-works)
- [Architecture](#-architecture)
- [Request Sequence](#-ai-request-sequence)
- [Project Structure](#-project-structure)
- [Setup](#-setup)
- [Setup Flow](#-setup-flow)
- [Deployment](#-deployment)

---

## ✨ Overview

**LearnLoop** is a learning app built around a continuous loop: learn something, practice it, get AI feedback, and improve. It ships as a web app and a mobile app, backed by Supabase and an AI Edge Function powered by Groq.

| Part | What it is |
|------|-----------|
| 🌐 `web/` | Vite + React + TypeScript + Tailwind app |
| 📱 `mobile/` | Mobile client (built/deployed with EAS) |
| 🗄️ `supabase/` | SQL migrations (schema + RLS) and the `ai` Edge Function |
| ⚙️ `.github/workflows` | CI/CD automation |

> 🔐 The Groq API key lives **only** inside the Supabase Edge Function — it is never exposed to the browser.

---

## 🔁 How It Works

```mermaid
flowchart LR
    A([👤 User opens LearnLoop]) --> B[📖 Learn a topic]
    B --> C[✍️ Practice<br/>type or speak 🎙️]
    C --> D{{🤖 AI Feedback<br/>Groq via Edge Function}}
    D --> E[📊 Review results]
    E --> F{Mastered?}
    F -- No --> B
    F -- Yes --> G([🏆 Move to next topic])
    G --> B

    style A fill:#6366f1,color:#fff,stroke:none
    style D fill:#f59e0b,color:#000,stroke:none
    style G fill:#10b981,color:#fff,stroke:none
```

---

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph Clients["🖥️ Clients"]
        W["🌐 Web<br/>Vite · React · TS · Tailwind"]
        M["📱 Mobile<br/>EAS build"]
    end

    subgraph SB["☁️ Supabase"]
        AUTH["🔑 Auth"]
        DB[("🗄️ Postgres<br/>schema + RLS")]
        EF["⚡ Edge Function: ai"]
    end

    GROQ["🧠 Groq API<br/>openai/gpt-oss-20b"]

    W -->|anon key| AUTH
    M -->|anon key| AUTH
    W <-->|queries| DB
    M <-->|queries| DB
    W -->|prompt| EF
    M -->|prompt| EF
    EF -->|GROQ_API_KEY secret| GROQ
    GROQ -->|response| EF
    EF -->|feedback| W
    EF -->|feedback| M

    style EF fill:#f59e0b,color:#000
    style GROQ fill:#8b5cf6,color:#fff
    style DB fill:#3ecf8e,color:#000
```

---

## 🔄 AI Request Sequence

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant App as Web / Mobile App
    participant EF as Supabase Edge Function (ai)
    participant G as Groq API
    participant DB as Postgres (RLS)

    U->>App: Answer (text or 🎙️ voice)
    App->>EF: POST /ai (JWT + prompt)
    EF->>G: Chat completion (secret key)
    G-->>EF: AI response
    EF-->>App: Structured feedback
    App->>DB: Save progress
    DB-->>App: ✅ Saved
    App-->>U: Show feedback & next step
```

---

## 📂 Project Structure

```text
LearnLoop-/
├── .github/workflows/   # CI/CD
├── mobile/              # Mobile app
├── supabase/
│   ├── migrations/
│   │   ├── 0001_schema.sql
│   │   └── 0002_phases.sql
│   └── functions/ai/    # Edge Function (holds Groq key)
├── web/                 # Vite + React + TS + Tailwind
├── DEPLOY.md            # Free deployment guide
└── README.md
```

---

## 🚀 Setup

1. **Create a Supabase project**, then link and push the schema:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
2. **Set the AI secrets**:
   ```bash
   supabase secrets set GROQ_API_KEY=... [GROQ_MODEL=openai/gpt-oss-20b] [GROQ_FAST_MODEL=openai/gpt-oss-20b]
   ```
3. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy ai
   ```
4. **Configure the web app**:
   ```bash
   cp web/.env.example web/.env.local   # add project URL + anon key
   ```
5. **Run it**:
   ```bash
   cd web && npm run dev
   ```

> 🎙️ **Voice input** needs Chrome or Edge (Web Speech API) and HTTPS or `localhost`.
> 🧱 `supabase db push` applies both migrations: `0001_schema.sql` and `0002_phases.sql`.

### 🧭 Setup Flow

```mermaid
flowchart TD
    S([Start]) --> A[Create Supabase project]
    A --> B[supabase link --project-ref]
    B --> C[supabase db push<br/>0001_schema + 0002_phases]
    C --> D[supabase secrets set GROQ_API_KEY]
    D --> E[supabase functions deploy ai]
    E --> F[cp web/.env.example web/.env.local]
    F --> G[Add project URL + anon key]
    G --> H[cd web && npm run dev]
    H --> I([🎉 Running on localhost])

    style S fill:#6366f1,color:#fff,stroke:none
    style I fill:#10b981,color:#fff,stroke:none
```

---

## ☁️ Deployment

```mermaid
flowchart LR
    GH[(GitHub repo)] --> CI[⚙️ GitHub Actions]
    CI --> WEB["🌐 Web host<br/>Vercel · Netlify · Cloudflare Pages"]
    CI --> SBD["☁️ Supabase<br/>DB + Edge Function"]
    GH --> EAS["📱 EAS<br/>mobile builds"]
```

See **[DEPLOY.md](DEPLOY.md)** for the step-by-step free deployment guide (Cloudflare Pages / Netlify / Vercel, Supabase, EAS).

🔗 **Live:** https://learnloop-orpin.vercel.app

---

<div align="center">

Made with ❤️ by [HARIHARANMURALIREC](https://github.com/HARIHARANMURALIREC)

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,14,20&height=120&section=footer" alt="footer"/>

</div>

