import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import legacy_router, v1_router
from app.core.config import settings
from app.core.logger import setup_logging, set_request_id
from app.core.monitoring import init_sentry

logger = logging.getLogger(__name__)

setup_logging()
init_sentry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Phase 18: ensure MongoDB indexes exist before serving traffic
    from app.services.mongo_service import mongo_service

    try:
        await mongo_service.create_indexes()
    except Exception as exc:  # never block startup on index creation
        logger.error("MongoDB index creation failed on startup: %s", exc)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Resume & Job Match Analyzer API",
        version="0.1.0",
        description="FastAPI backend for resume/job description match analysis.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_origin_regex=r"https://.*\.vercel\.app|chrome-extension://.*",
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Session-ID", "Authorization"],
    )

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        rid = set_request_id(request.headers.get("X-Request-ID", uuid.uuid4().hex[:12]))
        request.state.request_id = rid
        logger.info("%s %s", request.method, request.url.path)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["X-Request-ID"] = rid
        logger.info("%s %s -> %s", request.method, request.url.path, response.status_code)
        return response

    app.include_router(v1_router, prefix="/api")
    app.include_router(legacy_router)

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    return app


app = create_app()
