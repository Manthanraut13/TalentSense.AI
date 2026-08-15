# TalentSense AI — Resume & Job Match Analyzer

> AI-powered SaaS that scores how well your resume matches any job description — with an ATS simulator, multi-JD comparison, learning roadmaps, a LangGraph career coach, a job application tracker, and shareable analysis pages.

<!-- TODO: point the Live Demo badge/link at your real deployment URL -->
[![Live Demo](https://img.shields.io/badge/Live%20Demo-0EA5A0?logo=vercel&logoColor=white&labelColor=0EA5A0)](https://resume-analyzer.vercel.app)

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.1-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![Tests](https://img.shields.io/badge/tests-117%20passing-success)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## Screenshots

<!-- TODO: add real UI captures to screenshots/ and keep these paths -->
| Home / Analyzer | Results & ATS |
|---|---|
| ![Home](screenshots/home.png) | ![Results](screenshots/results.png) |
| **Dashboard** | **Applications Board** |
| ![Dashboard](screenshots/dashboard.png) | ![Applications](screenshots/applications.png) |

---

## Highlights

- **Match score in seconds** — 4-dimension scoring (skills, experience, keywords, ATS) with an explanation of exactly what to fix.
- **ATS Simulator** — rules-based keyword pass/fail checks plus an LLM-scored report.
- **Compare up to 3 jobs** against one resume and see the best-fit role.
- **Learning Roadmap** — a personalized, resource-backed plan for every missing skill (Tavily search + caching).
- **AI Career Coach** — multi-turn LangGraph assistant that remembers your history.
- **Application Tracker** — kanban board across 7 pipeline stages, prefilled straight from an analysis.
- **Viral share links** — opt-in public results pages with a blur-to-signup conversion loop.
- **Chrome Extension** — analyze any job page from your browser (Plasmo MV3).
- **Production-grade basics** — Clerk auth, MongoDB-backed rate limiting, prompt-injection defense, Sentry, and 117 passing tests.

## Tech Stack

| Layer | Tech |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Query, Recharts, Clerk |
| **Backend** | Python 3.11, FastAPI, LangChain + Groq (analysis), LangGraph (coach), Motor/MongoDB |
| **AI / Search** | Groq LLM, Qdrant vector search, Tavily web search, sentence-transformers |
| **Data** | MongoDB (usage, history, resumes, applications, caches), Qdrant (vectors) |
| **Payments** | Stripe checkout + webhooks (pro tier scaffolded) |
| **Infra** | Docker, Render (backend), Vercel (frontend), GitHub Actions (CI) |

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  Frontend (Vercel)                                             │
│  React + Clerk Auth → React Query → /api/v1/*                  │
│  Home · Results · Compare · Dashboard · Coach · Applications    │
│  Share pages (/share/:slug) · Chrome Extension (same API)       │
└───────────────────────────────┬───────────────────────────────┘
                                │ HTTPS + Authorization: Bearer <jwt>
┌───────────────────────────────▼───────────────────────────────┐
│  Backend (Render) — FastAPI                                    │
│  Clerk JWT → rate limit → sanitizer → analysis pipeline        │
│  ├─ /analyze        LangChain/Groq + ATS + Qdrant + signals    │
│  ├─ /compare        Multi-JD comparison                        │
│  ├─ /learning-plan  Roadmaps via Tavily                        │
│  ├─ /coach/chat     LangGraph career coach                     │
│  ├─ /applications   Tracker CRUD · /share public pages         │
│  └─ /history, /resumes, /billing, /webhooks/clerk              │
│  MongoDB · Qdrant · training-signal collection                 │
└────────────────────────────────────────────────────────────────┘
```

## Getting Started

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows (POSIX: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env            # add your keys (Clerk, Groq, MongoDB, Qdrant…)
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
copy .env.example .env            # VITE_API_BASE_URL, VITE_CLERK_PUBLISHABLE_KEY
npm run dev
```

Open `http://localhost:5173`.

### 3. Chrome Extension (optional)

```bash
cd extension
npm install
npm run build
```

Load `extension/build/chrome-mv3-prod` as an unpacked extension at `chrome://extensions`.

## Environment Variables

Full reference is in each folder's `.env.example`:

- `backend/.env.example` — Clerk, Groq, MongoDB, Qdrant, Tavily, Resend, Sentry, rate-limit window.
- `frontend/.env.example` — `VITE_API_BASE_URL`, `VITE_CLERK_PUBLISHABLE_KEY`.
- `extension/.env.example` — API base URL for the extension.

## Testing

```bash
# Backend — 117 unit + integration tests
cd backend
.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider

# Frontend — typecheck, lint, and production build
cd frontend
npx tsc -b
npm run lint
npm run build
```

CI runs backend tests on every push/PR (`.github/workflows/test.yml`).

## Deployment

Render backend + Vercel frontend + extension build. See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full production guide and checklist. For the Chrome extension only (build, package, and free distribution via Edge Add-ons / Chrome Web Store / load-unpacked), see **[EXTENSION_DEPLOYMENT.md](EXTENSION_DEPLOYMENT.md)**.

## Project Structure

```
resume-job-analyzer/
├── backend/            # FastAPI app (routes, services, models, tests, scripts)
│   ├── app/
│   │   ├── api/        # /api/v1 routes + legacy aliases, auth deps
│   │   ├── services/   # chain, coach_agent, sanitizer, ats, qdrant, rate_limit…
│   │   ├── core/       # config, logging, monitoring
│   │   └── main.py
│   ├── scripts/        # fine-tuning pipeline (export → pairs → finetune)
│   └── tests/          # 117 passing tests
├── frontend/           # React + Vite + TypeScript SPA
│   └── src/
│       ├── components/ # ResultView, ATSScoreCard, LearningRoadmap, HistorySidebar…
│       ├── hooks/      # useUsage, useDashboard, useApplications, useCoach…
│       ├── lib/        # api.ts, validators.ts, format.ts
│       └── pages/      # Home, Results, Compare, Dashboard, Coach, Applications…
├── extension/          # Plasmo MV3 Chrome extension
├── screenshots/        # UI captures for this README
├── DEPLOYMENT.md       # production deployment guide
└── LICENSE             # MIT
```

## License

[MIT](LICENSE)
