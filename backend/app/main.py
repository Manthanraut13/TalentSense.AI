from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analysis, history
from app.core.config import settings


def create_app() -> FastAPI:
    app = FastAPI(
        title="Resume & Job Match Analyzer API",
        version="0.1.0",
        description="FastAPI backend for resume/job description match analysis.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Session-ID", "Authorization"],
    )

    app.include_router(analysis.router)
    app.include_router(history.router)

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    return app


app = create_app()
