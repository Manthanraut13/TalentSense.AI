"""Phase 23 — Share & Viral Loop.

Tests the sharing routes with a fake Mongo collection so no external
services are contacted. Verifies the privacy model: analyses are private by
default, enabling sharing returns a slug, and the public endpoint only
exposes a safe subset of the analysis.
"""

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.main import app
from app.models.response import AnalysisResult, Scores
from app.services.mongo_service import mongo_service

client = TestClient(app)
TEST_USER_ID = "user_test123"


def setup_function() -> None:
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID


def teardown_function() -> None:
    app.dependency_overrides.clear()


class FakeCollection:
    """In-memory analyses collection with a Motor-like API."""

    def __init__(self, docs=None):
        self.docs = docs or {}

    async def insert_one(self, doc):
        self.docs[doc["analysis_id"]] = dict(doc)

    async def find_one(self, query, projection=None):
        for doc in self.docs.values():
            if all(doc.get(k) == v for k, v in query.items()):
                if projection:
                    return {k: doc[k] for k in projection if k in doc}
                return dict(doc)
        return None

    async def update_one(self, query, update):
        for doc in self.docs.values():
            if all(doc.get(k) == v for k, v in query.items()):
                for key, value in update.get("$set", {}).items():
                    doc[key] = value
                return type("R", (), {"modified_count": 1})()
        return type("R", (), {"modified_count": 0})()


@pytest.fixture
def fake_collection(monkeypatch):
    collection = FakeCollection()
    monkeypatch.setattr(mongo_service, "_get_collection", lambda: collection)
    return collection


def _stored_analysis(analysis_id="a1", *, is_public=False, share_slug=None):
    return {
        "user_id": TEST_USER_ID,
        "analysis_id": analysis_id,
        "job_title": "Backend Engineer at Stripe",
        "timestamp": "2026-07-01T10:00:00Z",
        "scores": {
            "overall": 82,
            "skills_match": 85,
            "experience_relevance": 70,
            "keyword_coverage": 90,
        },
        "missing_skills": ["Kubernetes", "Redis"],
        "ats_keywords": ["FastAPI", "Docker"],
        "strengths": ["Strong Python foundation"],
        "improvement_tips": ["Add Kubernetes"],
        "is_public": is_public,
        "share_slug": share_slug or ("slug_public" if is_public else None),
        "resume_snippet": "SENSITIVE RESUME DATA",
    }


def test_save_analysis_adds_share_slug_and_private_by_default(monkeypatch, fake_collection):
    async def noop():
        return None

    monkeypatch.setattr(mongo_service, "_ensure_indexes", noop)
    result = AnalysisResult(
        analysis_id="a1",
        job_title="Backend Engineer at Stripe",
        timestamp="2026-07-01T10:00:00Z",
        scores=Scores(overall=82, skills_match=85, experience_relevance=70, keyword_coverage=90),
        missing_skills=["Kubernetes"],
        ats_keywords=["FastAPI"],
        strengths=["Strong Python"],
        improvement_tips=["Add Kubernetes"],
    )

    import asyncio

    saved = asyncio.run(
        mongo_service.save_analysis(
            user_id=TEST_USER_ID,
            result=result,
            resume_text="my resume",
            qdrant_vector_id="v1",
        )
    )
    assert saved is True
    stored = fake_collection.docs["a1"]
    assert stored["share_slug"]
    assert stored["is_public"] is False


def test_enable_sharing_returns_slug_and_url(fake_collection):
    fake_collection.docs["a1"] = _stored_analysis()
    response = client.post(
        "/api/v1/analyses/a1/share",
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["share_slug"]
    assert body["share_url"].endswith(f"/share/{body['share_slug']}")
    assert fake_collection.docs["a1"]["is_public"] is True


def test_enable_sharing_not_found_returns_404(fake_collection):
    response = client.post(
        "/api/v1/analyses/nope/share",
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 404


def test_enable_sharing_requires_auth(fake_collection, monkeypatch):
    from app.api import deps

    monkeypatch.setattr(deps.settings, "test_mode", False)
    app.dependency_overrides.clear()
    response = client.post(
        "/api/v1/analyses/a1/share",
        headers={"Authorization": "Bearer not-a-jwt"},
    )
    assert response.status_code == 401


def test_disable_sharing(fake_collection):
    fake_collection.docs["a1"] = _stored_analysis(is_public=True, share_slug="slug_public")
    response = client.delete(
        "/api/v1/analyses/a1/share",
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    assert response.json() == {"sharing_disabled": True}
    assert fake_collection.docs["a1"]["is_public"] is False


def test_public_share_returns_safe_subset(fake_collection):
    fake_collection.docs["a1"] = _stored_analysis(is_public=True, share_slug="slug_public")
    response = client.get("/api/v1/share/slug_public")
    assert response.status_code == 200
    body = response.json()
    assert body["job_title"] == "Backend Engineer at Stripe"
    assert body["scores"]["overall"] == 82
    assert body["missing_skills_count"] == 2
    assert body["ats_keywords_count"] == 2
    assert body["strengths_count"] == 1
    assert body["improvement_tips_count"] == 1
    assert body["strength_preview"] == "Strong Python foundation"
    # Private/PII fields must never leak
    for private_field in [
        "missing_skills",
        "ats_keywords",
        "strengths",
        "improvement_tips",
        "user_id",
        "resume_snippet",
        "is_public",
        "share_slug",
        "_id",
    ]:
        assert private_field not in body, f"Private field leaked: {private_field}"


def test_public_share_404_when_not_public(fake_collection):
    fake_collection.docs["a1"] = _stored_analysis(is_public=False, share_slug="slug_private")
    response = client.get("/api/v1/share/slug_private")
    assert response.status_code == 404


def test_public_share_404_unknown_slug(fake_collection):
    response = client.get("/api/v1/share/does-not-exist")
    assert response.status_code == 404


def test_public_share_needs_no_auth(fake_collection):
    fake_collection.docs["a1"] = _stored_analysis(is_public=True, share_slug="slug_public")
    response = client.get("/api/v1/share/slug_public")
    assert response.status_code == 200
