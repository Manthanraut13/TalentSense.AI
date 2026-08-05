"""Phase 19 — API versioning under /api/v1 with legacy aliases kept working.

These tests only verify routing/versioning mechanics, so no DB or external
services are touched: health checks are DB-free and the webhook route is
exercised with an unhandled event type (returns without any DB call).
"""

from fastapi.testclient import TestClient

from app.main import create_app

app = create_app()
client = TestClient(app)

V1_PATHS = [
    "/api/v1/health",
    "/api/v1/analyze",
    "/api/v1/usage",
    "/api/v1/history",
    "/api/v1/history/{analysis_id}",
    "/api/v1/history/{analysis_id}/export-pdf",
    "/api/v1/history/dashboard/stats",
    "/api/v1/billing/status",
    "/api/v1/billing/create-checkout-session",
    "/api/v1/billing/cancel",
    "/api/v1/compare",
    "/api/v1/learning-plan",
    "/api/v1/resumes",
    "/api/v1/resumes/{resume_id}",
    "/api/v1/scrape-jd",
    "/api/v1/coach/chat",
    "/api/v1/applications",
    "/api/v1/applications/{application_id}",
    "/api/v1/applications/{application_id}/status",
    "/api/v1/analyses/{analysis_id}/share",
    "/api/v1/share/{slug}",
]

LEGACY_PATHS = [
    "/analyze",
    "/usage",
    "/history",
    "/history/{analysis_id}",
    "/history/{analysis_id}/export-pdf",
    "/history/dashboard/stats",
    "/api/billing/status",
    "/api/billing/create-checkout-session",
    "/api/billing/cancel",
    "/api/compare",
    "/api/learning-plan",
    "/resumes",
    "/resumes/{resume_id}",
    "/scrape-jd",
]


def _api_paths() -> set[str]:
    return set(app.openapi()["paths"].keys())


def _ops() -> dict[str, str]:
    ops = {}
    for path, methods in app.openapi()["paths"].items():
        for method, op in methods.items():
            ops[f"{method.upper()} {path}"] = op["operationId"]
    return ops


def _handler_names() -> dict[str, str]:
    """Map 'METHOD /path' -> endpoint function name from the real route tree."""
    names = {}
    for route in app.routes:
        if not hasattr(route, "effective_route_contexts"):
            continue
        for ctx in route.effective_route_contexts():
            for method in ctx.methods or []:
                names[f"{method.upper()} {ctx.path}"] = ctx.endpoint.__name__
    return names


def test_every_route_is_available_under_v1():
    missing = [p for p in V1_PATHS if p not in _api_paths()]
    assert missing == [], f"Missing /api/v1 routes: {missing}"


def test_legacy_unversioned_paths_still_exist():
    missing = [p for p in LEGACY_PATHS if p not in _api_paths()]
    assert missing == [], f"Missing legacy routes: {missing}"


def test_no_feature_route_outside_v1_or_legacy_aliases():
    known = set(V1_PATHS) | set(LEGACY_PATHS) | {
        "/health",
        "/openapi.json",
        "/docs",
        "/docs/oauth2-redirect",
        "/redoc",
    }
    stray = [p for p in _api_paths() if p not in known]
    assert stray == [], f"Unexpected un-versioned/un-aliased routes: {stray}"


def test_v1_and_legacy_serve_the_same_handlers():
    handlers = _handler_names()
    for legacy, v1 in [
        ("GET /usage", "GET /api/v1/usage"),
        ("POST /analyze", "POST /api/v1/analyze"),
        ("GET /history", "GET /api/v1/history"),
        ("GET /history/{analysis_id}", "GET /api/v1/history/{analysis_id}"),
        ("GET /api/billing/status", "GET /api/v1/billing/status"),
        ("POST /api/compare", "POST /api/v1/compare"),
        ("POST /api/learning-plan", "POST /api/v1/learning-plan"),
        ("GET /resumes", "GET /api/v1/resumes"),
        ("POST /scrape-jd", "POST /api/v1/scrape-jd"),
    ]:
        assert v1 in handlers, f"{v1} not in route tree"
        assert legacy in handlers, f"{legacy} not in route tree"
        assert handlers[v1] == handlers[legacy], (
            f"{v1} and {legacy} resolve to different handlers "
            f"({handlers[v1]} vs {handlers[legacy]})"
        )


def test_v1_health_returns_ok():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_root_health_still_works():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_webhook_route_exists_on_both_mounts():
    for url in ["/api/v1/webhooks/clerk", "/webhooks/clerk"]:
        response = client.post(url, json={"type": "unknown.event"})
        assert response.status_code == 200, f"{url} -> {response.status_code}"
        assert response.json() == {"received": True}
