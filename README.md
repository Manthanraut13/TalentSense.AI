# Resume & Job Match Analyzer

AI-assisted resume/job description match analyzer with authentication, rate limiting, multi-JD comparison, learning roadmaps, ATS simulation, a LangGraph career coach, a job application tracker, shareable analysis pages, and a Chrome extension.

## Current Status

**Phases 1–14 and 18–24 complete.** Phases 15–17 (Railway migration, ARQ background jobs, Redis caching) are documented in `Phase_15_to_21.md` but were not implemented — the backend runs on Render with no separate worker or Redis layer.

| Phase | Feature |
|-------|---------|
| 1 | **Authentication (Clerk)** — email/password + Google OAuth; JWT verified on every request; history tied to user, not browser |
| 2 | **Rate Limiting** — daily limit (default 10) for analyses; MongoDB-backed with TTL + in-memory fallback; `X-RateLimit-*` headers; counted after success |
| 3 | **Input Sanitization & Security** — prompt injection detection, MIME-based PDF validation, char limits, security headers, pre-commit secret scanning |
| 4 | **Observability** — Sentry error tracking, structured logging, request IDs |
| 5 | **Email** — Resend welcome/notification emails |
| 6 | **PDF Export** — download analysis results as PDF |
| 7 | **Deployment** — Dockerfile, render.yaml, vercel.json, deployment guide |
| 8 | **Stripe Billing** — checkout/webhook scaffolded (**pro plan on hold**: no feature gating, everyone gets the free tier) |
| 9 | **Resume Library** — save/select from multiple resumes |
| 10 | **JD URL Scraping** — fetch & analyze a job description from a URL |
| 11 | **Multi-JD Compare** — compare one resume against 2–3 job descriptions |
| 12 | **Learning Roadmap** — per-skill plans with real resources (Tavily search, MongoDB cache) |
| 13 | **ATS Simulator** — rules-based + LLM-scored ATS match report |
| 14 | **Chrome Extension** — Plasmo MV3 side panel + "Analyze with AI" button on job pages |
| 18 | **MongoDB Indexing** — all collections indexed on startup for scale |
| 19 | **API Versioning** — all routes under `/api/v1` with legacy un-versioned aliases kept working |
| 20 | **Automated Test Suite** — unit + integration tests for all critical services (117 passing) |
| 21 | **LangGraph Career Coach** — multi-turn chat with user context and history |
| 22 | **Job Application Tracker** — kanban-style board grouped by status; add/edit/status-change/delete; links analyses to applications |
| 23 | **Viral Share Mechanic** — opt-in public share links (`/share/:slug`) with a blur-to-signup overlay |
| 24 | **Training Data** — anonymized training-signal collection + fine-tuning pipeline scaffold (export → pairs → finetune scripts) |

> **Pro plan note:** Billing endpoints exist but the pro tier is on hold; `is_pro` is informational only.
>
> **Rate limit note:** the daily limit applies **only to `/analyze`** (10 analyses/day). Compare and the learning roadmap are free and unlimited and do **not** consume quota.

**Backend**: FastAPI with LangChain/Groq analysis + LangGraph coach, Motor MongoDB, Qdrant vector search, Clerk JWT auth.

**Frontend**: Vite + React + TypeScript, Clerk auth, React Query, dark emerald/amber UI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Vercel)                        │
│  React + Clerk Auth → React Query → /api/v1/*                   │
│  Home · Results · History · Compare · Dashboard · Coach         │
│  Applications (tracker) · Pricing · /share/:slug                │
│  Chrome Extension (Plasmo) → same API                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS + Authorization: Bearer <jwt>
┌──────────────────────────▼──────────────────────────────────────┐
│                        Backend (Render)                         │
│  FastAPI + Clerk JWT → Rate Limit (analyze) → Sanitizer         │
│  ├─ /api/v1/analyze       LangChain/Groq + ATS + Qdrant + signal│
│  ├─ /api/v1/compare       Multi-JD comparison (unlimited)       │
│  ├─ /api/v1/learning-plan Roadmaps + Tavily (unlimited)         │
│  ├─ /api/v1/coach/chat    LangGraph career coach                │
│  ├─ /api/v1/scrape-jd     URL fetch + sanitize                  │
│  ├─ /api/v1/applications  Job application tracker               │
│  ├─ /api/v1/share         Public analysis pages                 │
│  └─ /api/v1/history, /resumes, /billing, /webhooks/clerk        │
│  MongoDB (usage, history, resumes, applications, caches)        │
│  + Qdrant (vectors) + training-signal collection (Phase 24)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Edit .env with your keys
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
# Edit .env with VITE_CLERK_PUBLISHABLE_KEY and VITE_API_BASE_URL
npm run dev
```

Open `http://localhost:5173`

### Chrome Extension

```bash
cd extension
npm install
cp .env.example .env   # set the API base URL
npm run dev            # development, or `npm run build` for a production build
```

Load `extension/build/chrome-mv3-prod` as an unpacked extension in `chrome://extensions`.

---

## Environment Variables

### Backend (`.env`)

```env
# App
APP_ENV=development
ALLOWED_ORIGINS=http://localhost:5173

# Auth (Clerk)
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# AI
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_TEMPERATURE=0.3
GROQ_MAX_TOKENS=2048

# Vector DB (Qdrant)
QDRANT_URL=https://xxx.qdrant.io
QDRANT_API_KEY=...
QDRANT_COLLECTION=resume_analyses
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384

# Document DB (MongoDB)
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=resume_analyzer
MONGODB_COLLECTION=analyses
STORE_RESUME_SNIPPET=false

# Rate Limiting (daily, applies to /analyze only)
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW_SECONDS=3600

# Learning roadmap resource search
TAVILY_API_KEY=tvly_...

# Email (Resend)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@resumeanalyzer.app
APP_URL=http://localhost:5173/

# Observability
SENTRY_DSN=https://...
ENVIRONMENT=development

# Fine-tuning (Phase 24) — private embedding model access
HF_TOKEN=hf_...

# Test mode (bypasses auth for local testing)
TEST_MODE=false
```

### Frontend (`.env`)

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Authentication** | Clerk email/password + Google OAuth; JWT on every request |
| **Rate Limiting** | 10 analyses/day (configurable); applies to `/analyze` only; `X-RateLimit-*` headers; counted after success |
| **ATS Simulator** | Rules-based keyword check + LLM score blended into a match report |
| **Multi-JD Compare** | One resume vs 2–3 JDs with a recommended best-fit job (unlimited) |
| **Learning Roadmap** | Per-skill plans with curated resources via Tavily + MongoDB cache (unlimited) |
| **Career Coach** | Multi-turn LangGraph assistant with conversation memory |
| **Application Tracker** | Kanban board across 7 pipeline stages; add/edit/status-change/delete; prefilled from an analysis ("Track this job") |
| **Share & Viral Loop** | Opt-in public analysis pages with blur-to-signup |
| **JD URL Scraping** | Fetch a job description from a URL, then analyze |
| **Resume Library** | Save resumes, pick which one to analyze |
| **PDF Export** | Download any analysis as a PDF report |
| **Prompt Injection Defense** | Regex patterns block common LLM attacks (tuned to avoid false positives on real JDs) |
| **PDF Validation** | MIME type check via libmagic, 5MB limit, PDF header check |
| **Input Limits** | Resume 8K chars, Job Description 4K chars |
| **Security Headers** | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, etc. |
| **Vector Context** | Qdrant stores past analyses for RAG on future queries |
| **History** | Full CRUD per user, MongoDB persistence |
| **Observability** | Sentry + structured logging + per-request IDs |
| **Training Data (backend)** | Anonymized (sha256-hashed) training-signal collection for future embedding fine-tuning |
| **Chrome Extension** | Plasmo MV3 side panel + in-page analyze button |
| **Pre-commit** | Whitespace, EOF, merge-conflict, YAML checks, secret scanning |

---

## API Endpoints

All endpoints are mounted under `/api/v1` (canonical) with legacy un-versioned aliases.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/analyze` | Bearer | Run analysis (rate limited — 10/day, sanitized) |
| GET | `/usage` | Bearer | Current daily analysis usage |
| POST | `/scrape-jd` | Bearer | Fetch job description text from a URL |
| POST | `/compare` | Bearer | Compare resume vs 2–3 JDs (not rate limited) |
| POST | `/learning-plan` | Bearer | Generate learning roadmap for skills (not rate limited) |
| POST | `/coach/chat` | Bearer | Multi-turn chat with the career coach |
| GET | `/history` | Bearer | List past analyses |
| GET | `/history/{id}` | Bearer | Get single analysis |
| DELETE | `/history/{id}` | Bearer | Delete analysis |
| GET | `/history/dashboard/stats` | Bearer | Dashboard aggregate stats |
| GET | `/history/{id}/export-pdf` | Bearer | Download analysis as PDF |
| GET/POST | `/resumes` | Bearer | List / save resumes |
| GET/DELETE | `/resumes/{id}` | Bearer | Get / delete a resume |
| GET/POST | `/applications` | Bearer | List / create job applications |
| PATCH | `/applications/{id}/status` | Bearer | Move an application between pipeline stages |
| PATCH/DELETE | `/applications/{id}` | Bearer | Edit / delete an application |
| POST | `/analyses/{id}/share` | Bearer | Generate a public share link for an analysis |
| DELETE | `/analyses/{id}/share` | Bearer | Stop sharing an analysis |
| GET | `/share/{slug}` | Public | Fetch the non-PII subset of a shared analysis |
| GET | `/api/v1/billing/status` | Bearer | Plan status (informational) |
| POST | `/api/v1/billing/create-checkout-session` | Bearer | Stripe checkout (pro on hold) |
| POST | `/api/v1/billing/webhook` | — | Stripe webhook |
| POST | `/api/v1/billing/cancel` | Bearer | Cancel subscription |
| POST | `/api/v1/webhooks/clerk` | — | Clerk user provisioning |
| GET | `/api/v1/health` | — | Health check |

---

## Testing

```bash
# Backend (from backend/; 117 tests)
.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider

# Frontend typecheck + production build (from frontend/)
npx tsc -b
npm run build
```

---

## Production Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full guide (Render backend, Vercel frontend, extension build, and production checklist).

---

## Clerk Setup

1. Create app at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Enable **Email + Password** and **Google OAuth**
3. Redirect URLs:
   - Sign-in: `http://localhost:5173/sign-in` / `https://your-app.vercel.app/sign-in`
   - After sign-in: `http://localhost:5173/` / `https://your-app.vercel.app/`
4. Copy **Publishable Key** → `VITE_CLERK_PUBLISHABLE_KEY`
5. Copy **Secret Key** → `CLERK_SECRET_KEY`

---

## Testing Checklist

- [ ] `GET /health` → `{"status":"ok"}`
- [ ] Sign up → redirected to home, history empty
- [ ] Text analysis (< 200 chars) → 422 error
- [ ] Job description (< 100 chars) → 422 error
- [ ] "Ignore all previous instructions" in resume → 400 error
- [ ] Legitimate JD phrases like "act as a subject matter expert" → analysis succeeds (no false-positive 400)
- [ ] Rename .jpg to .pdf → 400 "Invalid file type"
- [ ] 6MB PDF → 400 "File too large"
- [ ] URL fetch shows success banner + JD preview, and does **not** auto-trigger analysis
- [ ] 10 analyses → 11th returns 429 with `X-RateLimit-Remaining: 0`
- [ ] Compare and learning-plan still work when the analyze quota is exhausted (not rate limited)
- [ ] Navbar shows remaining analyses today
- [ ] Compare page compares 1 resume vs 2–3 JDs
- [ ] Learning roadmap returns resources for missing skills
- [ ] Career coach holds a multi-turn conversation
- [ ] Applications page: add a job → status change → delete; "Track this job" on a results page prefills role + score
- [ ] Share results → public link opens `/share/:slug` with blur-to-signup; stop sharing → 404 on the link
- [ ] History page lists user's analyses only; PDF export downloads
- [ ] Chrome extension side panel runs a full analysis
- [ ] Pre-commit hooks run on commit

---

## Project Structure

```
resume-job-analyzer/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # Clerk JWT + enforce_rate_limit (analyze only)
│   │   │   ├── v1/                  # /api/v1 aggregation + legacy aliases
│   │   │   └── routes/
│   │   │       ├── analysis.py      # /analyze, /usage
│   │   │       ├── compare.py       # /compare
│   │   │       ├── learning.py      # /learning-plan
│   │   │       ├── coach.py         # /coach/chat
│   │   │       ├── applications.py  # application tracker CRUD
│   │   │       ├── sharing.py       # share links + public view
│   │   │       ├── scrape.py        # /scrape-jd
│   │   │       ├── resumes.py       # resume library CRUD
│   │   │       ├── history.py       # history CRUD + PDF export + dashboard stats
│   │   │       ├── billing.py       # Stripe (pro on hold)
│   │   │       └── webhooks.py      # Clerk webhook
│   │   ├── core/                    # config, logging, monitoring
│   │   ├── main.py                  # FastAPI + security headers + CORS + index init
│   │   ├── models/                  # Pydantic models
│   │   └── services/
│   │       ├── chain.py             # LangChain + Groq; analyze/compare/recommend chains
│   │       ├── coach_agent.py       # LangGraph career coach (lazy LLM)
│   │       ├── application_service.py# Tracker storage + status history
│   │       ├── training_data_service.py# sha256-hashed training-signal collection
│   │       ├── mongo_service.py     # Motor MongoDB + create_indexes
│   │       ├── qdrant_service.py    # Vector search
│   │       ├── rate_limit_service.py# Daily analyze limit + MongoDB TTL
│   │       ├── sanitizer.py         # Injection detection + sanitization
│   │       ├── parser.py            # PDF + text validation
│   │       ├── scraper.py           # URL fetch + content extraction
│   │       ├── ats_simulator.py     # Rules + LLM ATS score
│   │       ├── learning_service.py  # Roadmap generation (Tavily + cache)
│   │       ├── resume_service.py    # Resume library storage
│   │       ├── user_service.py      # User/plan state
│   │       ├── email_service.py     # Resend
│   │       └── pdf_export.py        # fpdf2 export
│   ├── scripts/                     # Phase 24 fine-tuning pipeline
│   │   ├── export_training_data.py  # → training_data.jsonl
│   │   ├── prepare_training_pairs.py# → labeled sentence pairs
│   │   └── finetune_embeddings.py   # sentence-transformers fine-tune
│   ├── tests/                       # pytest (117 tests, phases 11–24)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── components/              # UsageBadge, ATSScoreCard, LearningRoadmap, HistorySidebar, ...
│       ├── hooks/                   # useUsage, useApplications, useSharing, useCoach, useDashboard, ...
│       ├── lib/                     # api.ts (axios + Clerk token), validators.ts, format.ts
│       └── pages/                   # Home, Results, History, Compare, Dashboard, Coach,
│                                    # Applications (tracker), ShareView, Pricing, SignIn/Up
├── extension/                       # Plasmo MV3 Chrome extension
├── Phase_15_to_21.md                # Planned phases 15–21 (Railway/ARQ/Redis + specs)
├── Phase_22_to_24_and_MasterIndex.md# Phases 22–24 specs + master index
├── .pre-commit-config.yaml
├── .secrets.baseline
├── README.md
└── DEPLOYMENT.md
```

---

## License

MIT
