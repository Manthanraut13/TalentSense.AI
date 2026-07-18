# Resume & Job Match Analyzer

AI-assisted resume/job description match analyzer with authentication, rate limiting, and security hardening.

## Current Status

**Phase 3 (Security Hardening) complete** — all ship-blocker phases done:

- **Phase 1 — Authentication (Clerk)**: Anonymous UUID sessions replaced with real user accounts (email/password + Google OAuth). History tied to user, not browser. JWT verified on every request.
- **Phase 2 — Rate Limiting**: Free users limited to 5 analyses/day (resets midnight UTC). Usage tracked in MongoDB with TTL cleanup. Frontend shows remaining analyses in navbar.
- **Phase 3 — Input Sanitization & Security**: Prompt injection detection, PDF validation via MIME type (not extension), character limits, security headers, pre-commit secret scanning.

**Backend**: FastAPI with LangChain/Groq analysis, Motor MongoDB, Qdrant vector search, Clerk JWT auth, SlowAPI rate limiting.

**Frontend**: Vite + React + TypeScript, Clerk auth, React Query, dark emerald/amber UI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Vercel)                        │
│  React + Clerk Auth → React Query → /analyze, /history, /usage  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS + Authorization: Bearer <jwt>
┌──────────────────────────▼──────────────────────────────────────┐
│                        Backend (Render)                         │
│  FastAPI + Clerk JWT verification → Rate Limit → Sanitizer     │
│  → LangChain/Groq Analysis → MongoDB + Qdrant                  │
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

# Document DB (MongoDB)
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=resume_analyzer
MONGODB_COLLECTION=analyses

# Embeddings
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384

# Rate Limiting
RATE_LIMIT_REQUESTS=5
RATE_LIMIT_WINDOW_SECONDS=86400
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
| **Rate Limiting** | 5 analyses/day for free users; headers show remaining |
| **Prompt Injection Defense** | 16 regex patterns block common LLM attacks |
| **PDF Validation** | MIME type check via libmagic, 5MB limit, PDF header check |
| **Input Limits** | Resume 8K chars, Job Description 4K chars |
| **Security Headers** | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, etc. |
| **Vector Context** | Qdrant stores past analyses for RAG on future queries |
| **History** | Full CRUD per user, MongoDB persistence |
| **Pre-commit** | Whitespace, EOF, merge-conflict, YAML checks |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/analyze` | Bearer | Run analysis (rate limited, sanitized) |
| GET | `/usage` | Bearer | Current daily usage stats |
| GET | `/history` | Bearer | List past analyses |
| GET | `/history/{id}` | Bearer | Get single analysis |
| DELETE | `/history/{id}` | Bearer | Delete analysis |
| GET | `/health` | — | Health check |

---

## Production Deployment

### Backend (Render)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

**Render Settings:**
- Build: `pip install -r requirements.txt`
- Start: `gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
- Health: `/health`
- Env: Add all backend env vars + `libmagic1` via build command:
  ```
  apt-get update && apt-get install -y libmagic1 && pip install -r requirements.txt
  ```

### Frontend (Vercel)

```bash
cd frontend
VITE_API_BASE_URL=https://your-backend.onrender.com npm run build
```

**vercel.json** (included):
```json
{
  "version": 2,
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "routes": [{ "src": "/(.*)", "dest": "index.html" }]
}
```

Set `VITE_API_BASE_URL` in Vercel project settings.

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
- [ ] 5 analyses → 6th returns 429 with `X-RateLimit-Remaining: 0`
- [ ] Navbar shows "X of 5 analyses left today"
- [ ] History page lists user's analyses only
- [ ] Pre-commit hooks run on commit

---

## Project Structure

```
resume-job-analyzer/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py          # Clerk JWT verification
│   │   │   └── routes/
│   │   │       ├── analysis.py  # /analyze, /usage
│   │   │       └── history.py   # CRUD
│   │   ├── core/config.py       # Pydantic Settings
│   │   ├── main.py              # FastAPI + security headers
│   │   ├── models/              # Pydantic models
│   │   └── services/
│   │       ├── chain.py         # LangChain + Groq
│   │       ├── mongo_service.py # Motor MongoDB
│   │       ├── qdrant_service.py# Vector search
│   │       ├── parser.py        # PDF + text validation
│   │       ├── sanitizer.py     # Input sanitization + injection detection
│   │       └── rate_limit_service.py # Daily limit + MongoDB TTL
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HistorySidebar.tsx
│   │   │   ├── HistoryItem.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── UsageBadge.tsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useUsage.ts
│   │   ├── lib/
│   │   │   ├── api.ts           # Axios + Clerk token interceptor
│   │   │   ├── validators.ts    # Client-side validation
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── SignInPage.tsx
│   │   │   ├── SignUpPage.tsx
│   │   │   ├── HistoryPage.tsx
│   │   │   └── ResultsPage.tsx
│   │   ├── App.tsx              # Routes + ClerkProvider
│   │   └── main.tsx
│   ├── vite.config.js
│   └── package.json
├── .pre-commit-config.yaml
├── .secrets.baseline
└── README.md
```

---

## License

MIT
