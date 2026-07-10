# Resume & Job Match Analyzer

AI-assisted resume/job description match analyzer built from the project PRD, tech stack, app flow, and design document.

## Current Status

Phase 3 backend storage/context is scaffolded:

- `backend/` FastAPI app with health endpoint, CORS, session header validation, parser service, AI analysis route, and MongoDB-backed history routes.
- `frontend/` Vite + React + TypeScript app with dark emerald/amber UI, session ID storage, input form, loading state, result page, and history page placeholder.
- LangChain + Groq analysis service with strict JSON/Pydantic parsing and one repair attempt.
- `/analyze` now calls the AI analysis service and returns `503` if `GROQ_API_KEY` is not configured.
- MongoDB history service using Motor for save/list/detail/delete operations.
- Qdrant vector context service using `sentence-transformers/all-MiniLM-L6-v2` embeddings.
- Storage is graceful: analysis still returns if MongoDB/Qdrant are not configured or fail.
- Backend tests cover request validation, no-key failure, mocked AI success, storage save wiring, and history routes.
- `IMPLEMENTATION_PLAN.md` contains the full phased build plan.

Frontend history UI still needs Phase 6 polish, but the backend history API is now wired.

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

For backend tests:

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```

Health check:

```bash
curl http://localhost:8000/health
```

## Frontend Setup

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open:

```text
http://localhost:5173
```

## Environment Variables

Backend:

```env
APP_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_TEMPERATURE=0.3
GROQ_MAX_TOKENS=2048
QDRANT_URL=
QDRANT_API_KEY=
QDRANT_COLLECTION=resume_analyses
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384
MONGODB_URI=
MONGODB_DATABASE=resume_analyzer
MONGODB_COLLECTION=analyses
```

Frontend:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Phase 3 Testing Targets

- `GET /health` returns status `ok`.
- `POST /analyze` validates `X-Session-ID`.
- Text resume mode rejects resumes under 200 characters.
- Job description rejects text under 100 characters.
- PDF mode rejects non-PDF files and files over 5MB.
- Without `GROQ_API_KEY`, valid analysis requests return `503`.
- With `GROQ_API_KEY`, valid analysis requests should return structured match results.
- With `MONGODB_URI`, successful analyses are saved and available through `/history`.
- With `QDRANT_URL` and `QDRANT_API_KEY`, successful analyses are vectorized and future analyses retrieve top-3 session context.
- Frontend can submit valid text input and render structured analysis results.

## External Integrations

### Groq

Add:

```env
GROQ_API_KEY=gsk_...
```

### MongoDB Atlas

Create an Atlas cluster, database user, and network access rule. Add:

```env
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=resume_analyzer
MONGODB_COLLECTION=analyses
```

### Qdrant Cloud

Create a Qdrant Cloud cluster and API key. The app will create the collection if missing. Add:

```env
QDRANT_URL=https://xxx.qdrant.io
QDRANT_API_KEY=...
QDRANT_COLLECTION=resume_analyses
```

The first configured Qdrant run may download the local embedding model weights for `sentence-transformers/all-MiniLM-L6-v2`.
