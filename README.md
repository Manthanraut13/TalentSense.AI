# Resume & Job Match Analyzer

AI-assisted resume/job description match analyzer with authentication, rate limiting, multi-JD comparison, learning roadmaps, ATS simulation, and a Chrome extension.

## Current Status

**Phases 1–14 complete.** All planned features shipped. No ship-blockers remaining.

| Phase | Feature |
|-------|---------|
| 1 | **Authentication (Clerk)** — email/password + Google OAuth; JWT verified on every request; history tied to user, not browser |
| 2 | **Rate Limiting** — real daily limit (default 10 actions per rolling hour), MongoDB-backed with TTL + in-memory fallback; `X-RateLimit-*` headers; usage counted after success |
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

> **Pro plan note:** Billing endpoints exist but the pro tier is on hold. Compare and the learning roadmap are open to all users and count against the shared daily limit. `is_pro` is informational only.

**Backend**: FastAPI with LangChain/Groq analysis, Motor MongoDB, Qdrant vector search, Clerk JWT auth.

**Frontend**: Vite + React + TypeScript, Clerk auth, React Query, dark emerald/amber UI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Vercel)                        │
│  React + Clerk Auth → React Query → /analyze, /compare, ...     │
│  Home · Results · History · Compare · Dashboard · Pricing       │
│  Chrome Extension (Plasmo) → same API                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS + Authorization: Bearer <jwt>
┌──────────────────────────▼──────────────────────────────────────┐
│                        Backend (Render)                         │
│  FastAPI + Clerk JWT → Rate Limit → Sanitizer                   │
│  ├─ /analyze         LangChain/Groq + ATS simulator + Qdrant    │
│  ├─ /api/compare     Multi-JD comparison                        │
│  ├─ /api/learning-plan  Roadmaps + Tavily resources             │
│  ├─ /scrape-jd       URL fetch + sanitize                       │
│  └─ /history, /resumes, /api/billing, /webhooks/clerk           │
│  MongoDB (usage, history, resumes, caches) + Qdrant (vectors)   │
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

# Rate Limiting
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
| **Rate Limiting** | 10 actions/day (configurable) for all users; `X-RateLimit-*` headers; counted after success |
| **ATS Simulator** | Rules-based keyword check + LLM score blended into a match report |
| **Multi-JD Compare** | One resume vs 2–3 JDs with a recommended best-fit job |
| **Learning Roadmap** | Per-skill plans with curated resources via Tavily + MongoDB cache |
| **JD URL Scraping** | Fetch a job description from a URL, then analyze |
| **Resume Library** | Save resumes, pick which one to analyze |
| **PDF Export** | Download any analysis as a PDF report |
| **Prompt Injection Defense** | Regex patterns block common LLM attacks |
| **PDF Validation** | MIME type check via libmagic, 5MB limit, PDF header check |
| **Input Limits** | Resume 8K chars, Job Description 4K chars |
| **Security Headers** | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, etc. |
| **Vector Context** | Qdrant stores past analyses for RAG on future queries |
| **History** | Full CRUD per user, MongoDB persistence |
| **Observability** | Sentry + structured logging + per-request IDs |
| **Chrome Extension** | Plasmo MV3 side panel + in-page analyze button |
| **Pre-commit** | Whitespace, EOF, merge-conflict, YAML checks, secret scanning |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/analyze` | Bearer | Run analysis (rate limited, sanitized) |
| POST | `/scrape-jd` | Bearer | Fetch job description text from a URL |
| POST | `/api/compare` | Bearer | Compare resume vs 2–3 JDs |
| POST | `/api/learning-plan` | Bearer | Generate learning roadmap for skills |
| GET | `/usage` | Bearer | Current daily usage stats |
| GET | `/history` | Bearer | List past analyses |
| GET | `/history/{id}` | Bearer | Get single analysis |
| DELETE | `/history/{id}` | Bearer | Delete analysis |
| GET | `/history/dashboard/stats` | Bearer | Dashboard aggregate stats |
| GET | `/history/{id}/export-pdf` | Bearer | Download analysis as PDF |
| GET/POST | `/resumes` | Bearer | List / save resumes |
| GET/DELETE | `/resumes/{id}` | Bearer | Get / delete a resume |
| GET | `/api/billing/status` | Bearer | Plan status (informational) |
| POST | `/api/billing/create-checkout-session` | Bearer | Stripe checkout (pro on hold) |
| POST | `/api/billing/webhook` | — | Stripe webhook |
| POST | `/api/billing/cancel` | Bearer | Cancel subscription |
| POST | `/webhooks/clerk` | — | Clerk user provisioning |
| GET | `/health` | — | Health check |

---

## Testing

```bash
# Backend (from backend/)
.venv\Scripts\python.exe -m pytest tests -q

# Frontend typecheck (from frontend/)
npx tsc -b
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
- [ ] Rename .jpg to .pdf → 400 "Invalid file type"
- [ ] 6MB PDF → 400 "File too large"
- [ ] URL fetch shows success banner before analysis is allowed
- [ ] 10 actions → 11th returns 429 with `X-RateLimit-Remaining: 0`
- [ ] Navbar shows remaining actions today
- [ ] Compare page compares 1 resume vs 2–3 JDs
- [ ] Learning roadmap returns resources for missing skills
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
│   │   │   ├── deps.py              # Clerk JWT + enforce_rate_limit
│   │   │   └── routes/
│   │   │       ├── analysis.py      # /analyze, /usage
│   │   │       ├── compare.py       # /api/compare
│   │   │       ├── learning.py      # /api/learning-plan
│   │   │       ├── scrape.py        # /scrape-jd
│   │   │       ├── resumes.py       # resume library CRUD
│   │   │       ├── history.py       # history CRUD + PDF export
│   │   │       ├── billing.py       # Stripe (pro on hold)
│   │   │       └── webhooks.py      # Clerk webhook
│   │   ├── core/                    # config, logging, monitoring
│   │   ├── main.py                  # FastAPI + security headers + CORS
│   │   ├── models/                  # Pydantic models
│   │   └── services/
│   │       ├── chain.py             # LangChain + Groq; compare/recommend chains (lazy-cached)
│   │       ├── mongo_service.py     # Motor MongoDB
│   │       ├── qdrant_service.py    # Vector search
│   │       ├── rate_limit_service.py# Daily limit + MongoDB TTL
│   │       ├── sanitizer.py         # Injection detection + sanitization
│   │       ├── parser.py            # PDF + text validation
│   │       ├── scraper.py           # URL fetch + content extraction
│   │       ├── ats_simulator.py     # Rules + LLM ATS score
│   │       ├── learning_service.py  # Roadmap generation (Tavily + cache)
│   │       ├── resume_service.py    # Resume library storage
│   │       ├── user_service.py      # User/plan state
│   │       ├── email_service.py     # Resend
│   │       └── pdf_export.py        # fpdf2 export
│   ├── tests/                       # pytest (analysis + phases 11–14)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── components/              # UsageBadge, ATSScoreCard, LearningRoadmap, ...
│       ├── hooks/                   # useUsage, ...
│       ├── lib/                     # api.ts (axios + Clerk token), validators.ts
│       └── pages/                   # Home, Results, History, Compare, Dashboard, Pricing
├── extension/                       # Plasmo MV3 Chrome extension
├── .pre-commit-config.yaml
├── .secrets.baseline
├── README.md
└── DEPLOYMENT.md
```

---

## License

MIT
