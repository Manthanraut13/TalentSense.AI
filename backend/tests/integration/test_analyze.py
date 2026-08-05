"""Integration tests for the /api/v1/analyze endpoint.

External services (Groq LLM, Qdrant, MongoDB, rate limiting) are patched so the
test exercises the real HTTP routing, form parsing, sanitization, and response
shaping logic end to end.
"""

from unittest.mock import AsyncMock

import pytest

from app.api import deps
from app.api.deps import get_current_user
from app.api.routes import analysis as analysis_route
from app.models.response import AIAnalysisPayload, Scores

FAKE_USER_ID = "user_test_123"


@pytest.fixture(autouse=True)
def mock_auth():
    async def fake_current_user() -> str:
        return FAKE_USER_ID

    from app.main import app

    app.dependency_overrides[get_current_user] = fake_current_user
    yield
    app.dependency_overrides.clear()


def _mock_ai_payload() -> AIAnalysisPayload:
    return AIAnalysisPayload(
        job_title="Senior Python Developer",
        scores=Scores(
            overall=75,
            skills_match=80,
            experience_relevance=70,
            keyword_coverage=75,
        ),
        missing_skills=["Kubernetes"],
        ats_keywords=["microservices", "CI/CD"],
        strengths=["Strong Python experience"],
        improvement_tips=["Add Kubernetes to skills"],
        context_note="",
    )


@pytest.fixture(autouse=True)
def mock_services(monkeypatch):
    """Bypass rate limits and stub Qdrant/Mongo persistence."""

    async def allow_rate_limit(user_id, is_pro=False):
        return {"allowed": True, "used": 0, "limit": 5, "remaining": 5}

    class FakeQdrantService:
        async def retrieve_context(self, *, user_id, job_description):
            return "No past analysis context is available yet."

        async def upsert_analysis(self, *, user_id, result, parsed_resume):
            return result.analysis_id

    class FakeMongoService:
        async def save_analysis(self, *, user_id, result, resume_text, qdrant_vector_id=None):
            return True

    monkeypatch.setattr(deps, "check_rate_limit", allow_rate_limit)
    monkeypatch.setattr(analysis_route, "qdrant_service", FakeQdrantService())
    monkeypatch.setattr(analysis_route, "mongo_service", FakeMongoService())
    monkeypatch.setattr(analysis_route, "increment_usage", AsyncMock())
    monkeypatch.setattr(analysis_route, "analyze_fn", AsyncMock(return_value=_mock_ai_payload()))


async def _post_analyze(async_client, *, resume_text, jd_text):
    return await async_client.post(
        "/api/v1/analyze",
        data={
            "job_description": jd_text,
            "input_mode": "text",
            "resume_text": resume_text,
        },
        headers={"Authorization": "Bearer fake_token"},
    )


async def test_analyze_text_endpoint_success(async_client, sample_resume_text, sample_jd_text):
    response = await _post_analyze(async_client, resume_text=sample_resume_text, jd_text=sample_jd_text)

    assert response.status_code == 200
    data = response.json()
    assert data["job_title"] == "Senior Python Developer"
    assert data["scores"]["overall"] == 75
    assert "Kubernetes" in data["missing_skills"]
    assert data["ats_score"] is not None
    assert response.headers["X-RateLimit-Limit"] == "5"


async def test_analyze_rejects_short_resume(async_client, sample_jd_text):
    response = await _post_analyze(
        async_client,
        resume_text="Too short",
        jd_text=sample_jd_text,
    )

    assert response.status_code == 422


async def test_analyze_rejects_missing_resume_text(async_client, sample_jd_text):
    response = await async_client.post(
        "/api/v1/analyze",
        data={
            "job_description": sample_jd_text,
            "input_mode": "text",
        },
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 422


async def test_analyze_rejects_invalid_input_mode(async_client, sample_resume_text, sample_jd_text):
    response = await async_client.post(
        "/api/v1/analyze",
        data={
            "job_description": sample_jd_text,
            "input_mode": "scan",
            "resume_text": sample_resume_text,
        },
        headers={"Authorization": "Bearer fake_token"},
    )

    assert response.status_code == 422


async def test_rate_limit_returns_429(monkeypatch, async_client, sample_resume_text, sample_jd_text):
    async def denied(user_id, is_pro=False):
        return {"allowed": False, "used": 5, "limit": 5, "remaining": 0}

    monkeypatch.setattr(deps, "check_rate_limit", denied)

    response = await _post_analyze(async_client, resume_text=sample_resume_text, jd_text=sample_jd_text)

    assert response.status_code == 429


async def test_health_endpoint(async_client):
    response = await async_client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
