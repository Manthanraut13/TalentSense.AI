# Resume & Job Match Analyzer Deployment Guide

Production guide for the full app (Phases 1–14): FastAPI backend, React/Vite frontend, and Chrome extension.

> **Pro plan note:** Stripe billing is scaffolded but the pro tier is **on hold**. There is no feature gating — all users share the same daily rate limit (default 10 actions / hour, configurable). Do not add Stripe keys unless billing is re-enabled.

## Backend Deployment

### Prerequisites

1. Install Python dependencies
2. Configure environment variables

```bash
# Backend setup
mkdir -p backend/.venv
python -m venv backend/.venv
backend/.venv/scripts/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
uvicorn backend/app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Required for AI analysis
GROQ_API_KEY=gsk_...  # Groq API Key

# Required for auth
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# Optional: Vector search
QDRANT_URL=https://xxx.qdrant.io
QDRANT_API_KEY=...  # For Qdrant Cloud
QDRANT_COLLECTION=resume_analyses
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384

# Optional: History / usage storage
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=resume_analyzer
MONGODB_COLLECTION=analyses

# Optional: Learning roadmap resource search
TAVILY_API_KEY=tvly_...

# Optional: Email (Resend)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@resumeanalyzer.app
APP_URL=https://your-app.vercel.app/

# Optional: Observability (Sentry)
SENTRY_DSN=https://...
ENVIRONMENT=production

# Rate limiting (defaults shown)
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW_SECONDS=3600

# CORS - Comma-separated list for production
ALLOWED_ORIGINS=https://your-frontend-domain.com

# Environment mode (development/production)
APP_ENV=production
TEST_MODE=false
```

### Render Configuration

1. **Dockerfile** (backend/Dockerfile):

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN apt-get update && apt-get install -y libmagic1 libgomp1 && pip install --no-cache-dir -r requirements.txt
COPY app ./app
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
```

> `libmagic1` is required for `python-magic` (MIME-based PDF validation); `libgomp1` for ONNX Runtime (fastembed).
>
> **Important:** Render injects a `PORT` env var — bind to `${PORT:-8000}`, not a hardcoded port. Use `--workers 1` on the free tier (512MB RAM); more workers cause `Out of memory` crashes.

2. **render.yaml** (backend/render.yaml):

```yaml
services:
  - type: web
    name: resume-analyzer-backend
    env: python
    plan: free
    buildCommand: apt-get update && apt-get install -y libmagic1 libgomp1 && pip install --no-cache-dir -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
    envVars:
      - key: APP_ENV
        value: production
      - key: ALLOWED_ORIGINS
        value: https://your-frontend-domain.com
      - key: GROQ_API_KEY
        sync: false
      - key: CLERK_SECRET_KEY
        sync: false
      - key: CLERK_PUBLISHABLE_KEY
        sync: false
      - key: QDRANT_URL
        sync: false
      - key: MONGODB_URI
        sync: false
      - key: TAVILY_API_KEY
        sync: false
```

3. **CORS** — `app/main.py` already allows your configured origins plus `chrome-extension://*`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Session-ID", "Authorization"],
)
```

## Frontend Deployment

### Prerequisites

```bash
# Frontend setup
cd frontend
npm install
cp .env.example .env
VITE_API_BASE_URL=https://your-backend-domain.com
npm run build
```

### Vercel Configuration

1. **vercel.json** (frontend/vercel.json):

```json
{
  "version": 2,
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

> **Use `rewrites`, not `routes`, for the SPA fallback.** A `routes` catch-all (`{ "src": "/(.*)", "dest": "index.html" }`) is evaluated *before* the filesystem, so it also serves `index.html` for `/assets/*.js` requests. Browsers then reject it with `Failed to load module script ... MIME type of "text/html"` and the app renders a white screen. `rewrites` only apply when no real file matches, so assets load normally and unknown paths fall back to `index.html` for client-side routing.
> Also, do **not** put `VITE_*` env vars in `vercel.json` — they belong in the Vercel project settings dashboard.

2. **Environment** (frontend/.env):

```env
VITE_API_BASE_URL=https://your-backend-domain.com
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Set both in Vercel project settings (variables prefixed with `VITE_` are inlined at build time).

## Chrome Extension

The extension is a Plasmo MV3 build in `extension/`.

```bash
cd extension
npm install
cp .env.example .env
npm run build
```

1. Load `extension/build/chrome-mv3-prod` via **Load unpacked** in `chrome://extensions` (Developer mode on).
2. The extension calls the same API, so the backend's `ALLOWED_ORIGINS`/CORS must accept `chrome-extension://*` (already handled in `main.py`).
3. For local testing, run `npm run dev` and load the dev build.

## Health Check

```bash
# Backend health check
curl -f http://localhost:8000/health

# Frontend health check (Vercel)
curl -f https://your-frontend-domain.com
```

## Production Checklist

### Backend

- [ ] `requirements.txt` contains all production dependencies
- [ ] `libmagic1` installed at build time (MIME validation)
- [ ] `uvicorn` configured with workers for production
- [ ] `.env` or Render env vars configured (see above)
- [ ] CORS `ALLOWED_ORIGINS` set to production origins
- [ ] `TEST_MODE=false` and `APP_ENV=production`
- [ ] `MONGODB_URI`, `QDRANT_URL` reachable from the host
- [ ] `TAVILY_API_KEY` set if the learning roadmap should return live resources

### Frontend

- [ ] `npm run build` passes locally (`tsc -b && vite build`)
- [ ] `VITE_API_BASE_URL` set to production backend URL
- [ ] `VITE_CLERK_PUBLISHABLE_KEY` set
- [ ] `vercel.json` configured for static deployment

### Extension

- [ ] `npm run build` succeeds
- [ ] Loaded unpacked from `build/chrome-mv3-prod`
- [ ] API base URL in `extension/.env` points at the backend

### Documentation

- [ ] README updated with deployment instructions
- [ ] `.env.example` includes all required variables
- [ ] README includes environment configuration notes

## Troubleshooting

### Backend

- **CORS errors**: Check `ALLOWED_ORIGINS` in `.env` (must include your Vercel domain).
- **`Invalid file type` on valid PDFs**: `libmagic1` not installed — add to the build command.
- **429 on every request**: Rate limit exceeded or Mongo/fallback clock skew — check `RATE_LIMIT_REQUESTS`/`RATE_LIMIT_WINDOW_SECONDS`.
- **Service unavailable**: Verify `GROQ_API_KEY` and other required env vars.
- **Port conflicts**: Ensure port 8000 is available or adjust in uvicorn command.

### Frontend

- **Build errors**: Check TypeScript compilation and dependencies.
- **API connection**: Verify `VITE_API_BASE_URL` in `.env` matches backend.
- **Auth loops**: Confirm the Clerk redirect URLs match your Vercel domain.

### Extension

- **CORS blocked**: Backend must allow `chrome-extension://*` (already in `main.py`).
- **Stale build**: Re-run `npm run build` and reload the unpacked extension.

## Status

All phases 1–14 complete and deployed. Pro (Stripe) tier intentionally on hold — all features are open to every user under the shared daily rate limit.
