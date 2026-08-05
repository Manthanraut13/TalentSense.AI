"""API versioning (Phase 19).

All feature routes live in ``app.api.routes`` and are aggregated here under two
mounts:

- ``v1_router``   -> mounted at ``/api/v1`` (canonical, used by all clients)
- ``legacy_router`` -> mounted at the root with the original un-versioned paths
  so previously deployed clients (browser extension, bookmarks) keep working.
"""

from datetime import datetime, timezone

from fastapi import APIRouter

from app.api.routes import (
    analysis,
    applications,
    billing,
    coach,
    compare,
    history,
    learning,
    scrape,
    resumes,
    sharing,
    webhooks,
)

v1_router = APIRouter(prefix="/v1", tags=["v1"])

v1_router.include_router(analysis.router)
v1_router.include_router(history.router)
v1_router.include_router(billing.router)
v1_router.include_router(scrape.router)
v1_router.include_router(resumes.router)
v1_router.include_router(compare.router)
v1_router.include_router(learning.router)
v1_router.include_router(coach.router)
v1_router.include_router(applications.router)
v1_router.include_router(sharing.router)
v1_router.include_router(webhooks.router)


@v1_router.get("/health", tags=["health"])
async def v1_health() -> dict[str, str]:
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


legacy_router = APIRouter()

legacy_router.include_router(analysis.router)
legacy_router.include_router(history.router)
legacy_router.include_router(billing.router, prefix="/api")
legacy_router.include_router(scrape.router)
legacy_router.include_router(resumes.router)
legacy_router.include_router(compare.router, prefix="/api")
legacy_router.include_router(learning.router, prefix="/api")
legacy_router.include_router(webhooks.router)
