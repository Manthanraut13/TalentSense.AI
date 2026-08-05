"""Phase 22 — Job application tracker.

The application service is exercised against an in-memory fake collection and
the routes are tested via TestClient with the service patched out.
"""

import asyncio

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.main import app
from app.services import application_service

client = TestClient(app)
TEST_USER_ID = "user_test123"


class FakeApplicationsCollection:
    """In-memory job_applications collection with a Motor-like API."""

    def __init__(self):
        self.docs = {}

    async def insert_one(self, doc):
        doc["_id"] = ObjectId()
        self.docs[str(doc["_id"])] = dict(doc)

        class Result:
            inserted_id = doc["_id"]

        return Result()

    def find(self, query):
        return FakeCursor(self, query)

    async def find_one_and_update(self, query, update, return_document=False):
        app_id = str(query.get("_id"))
        user_id = query.get("user_id")
        doc = self.docs.get(app_id)
        if doc is None or doc.get("user_id") != user_id:
            return None

        updated = dict(doc)
        for field, value in update.get("$set", {}).items():
            updated[field] = value
        for key, pushed in update.get("$push", {}).items():
            updated[key] = list(doc.get(key, [])) + [pushed]
        self.docs[app_id] = updated
        return updated if return_document else None

    async def delete_one(self, query):
        app_id = str(query.get("_id"))
        user_id = query.get("user_id")
        doc = self.docs.get(app_id)
        if doc is None or doc.get("user_id") != user_id:
            return type("R", (), {"deleted_count": 0})()
        del self.docs[app_id]
        return type("R", (), {"deleted_count": 1})()


class FakeCursor:
    def __init__(self, collection, query):
        self.collection = collection
        self.query = query
        self._sort_key = None

    def sort(self, key, direction):
        self._sort_key = key
        return self

    def __aiter__(self):
        docs = [
            doc
            for doc in self.collection.docs.values()
            if all(doc.get(k) == v for k, v in self.query.items())
        ]
        if self._sort_key:
            docs = sorted(docs, key=lambda d: d.get(self._sort_key, ""), reverse=True)
        self._iter = iter(docs)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


def _public(collection, app_id):
    return application_service._public_doc(dict(collection.docs[app_id]))


@pytest.fixture
def fake_collection(monkeypatch):
    collection = FakeApplicationsCollection()
    monkeypatch.setattr(application_service, "_applications_collection", lambda: collection)
    return collection


def _seed(collection, user_id, *, status="saved", notes=""):
    return asyncio.run(
        application_service.create_application(
            user_id,
            {
                "company": "Stripe",
                "role": "Backend Engineer",
                "status": status,
                "notes": notes,
            },
        )
    )


# ── service unit tests ───────────────────────────────────────────────────────


def test_create_application_sets_initial_fields(fake_collection):
    created = asyncio.run(
        application_service.create_application(
            TEST_USER_ID,
            {
                "company": "Stripe",
                "role": "Backend Engineer",
                "match_score": 82,
                "analysis_id": "ana1",
            },
        )
    )
    assert created["application_id"]
    assert created["status"] == "saved"
    assert created["match_score"] == 82
    assert created["analysis_id"] == "ana1"
    assert len(created["status_history"]) == 1
    assert created["status_history"][0]["status"] == "saved"


def test_get_applications_returns_all_for_user(fake_collection):
    _seed(fake_collection, TEST_USER_ID)
    _seed(fake_collection, TEST_USER_ID, status="applied")

    result = asyncio.run(application_service.get_applications(TEST_USER_ID))
    assert len(result) == 2
    assert all("application_id" in doc for doc in result)


def test_update_application_status_appends_history(fake_collection):
    created = _seed(fake_collection, TEST_USER_ID)
    updated = asyncio.run(
        application_service.update_application_status(
            created["application_id"], TEST_USER_ID, "phone_screen", "Scheduled call"
        )
    )
    assert updated["status"] == "phone_screen"
    assert updated["notes"] == "Scheduled call"
    assert len(updated["status_history"]) == 2
    assert updated["status_history"][-1]["status"] == "phone_screen"


def test_update_application_status_rejects_invalid_status(fake_collection):
    created = _seed(fake_collection, TEST_USER_ID)
    with pytest.raises(ValueError):
        asyncio.run(
            application_service.update_application_status(
                created["application_id"], TEST_USER_ID, "bogus"
            )
        )


def test_update_application_status_not_found_returns_none(fake_collection):
    result = asyncio.run(
        application_service.update_application_status(
            "0" * 24, TEST_USER_ID, "applied"
        )
    )
    assert result is None


def test_update_application_edits_fields(fake_collection):
    created = _seed(fake_collection, TEST_USER_ID)
    updated = asyncio.run(
        application_service.update_application(
            created["application_id"],
            TEST_USER_ID,
            {"notes": "Referral from Anna"},
        )
    )
    assert updated["notes"] == "Referral from Anna"
    assert updated["company"] == "Stripe"


def test_delete_application_returns_bool(fake_collection):
    created = _seed(fake_collection, TEST_USER_ID)
    assert asyncio.run(
        application_service.delete_application(created["application_id"], TEST_USER_ID)
    ) is True
    assert asyncio.run(
        application_service.delete_application(created["application_id"], TEST_USER_ID)
    ) is False


# ── route integration tests ──────────────────────────────────────────────────


def setup_function() -> None:
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_create_application_endpoint(monkeypatch, fake_collection):
    response = client.post(
        "/api/v1/applications",
        headers={"Authorization": "Bearer test-token"},
        json={"company": "Stripe", "role": "Backend Engineer", "match_score": 82},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["application_id"]
    assert body["company"] == "Stripe"


def test_create_application_validates_required_fields():
    response = client.post(
        "/api/v1/applications",
        headers={"Authorization": "Bearer test-token"},
        json={"company": "", "role": ""},
    )
    assert response.status_code == 422


def test_list_applications_endpoint(fake_collection):
    _seed(fake_collection, TEST_USER_ID)
    response = client.get(
        "/api/v1/applications",
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_patch_status_endpoint(monkeypatch, fake_collection):
    created = _seed(fake_collection, TEST_USER_ID)
    response = client.patch(
        f"/api/v1/applications/{created['application_id']}/status",
        headers={"Authorization": "Bearer test-token"},
        json={"status": "applied"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "applied"


def test_patch_status_invalid_returns_400(monkeypatch, fake_collection):
    created = _seed(fake_collection, TEST_USER_ID)
    response = client.patch(
        f"/api/v1/applications/{created['application_id']}/status",
        headers={"Authorization": "Bearer test-token"},
        json={"status": "bogus"},
    )
    assert response.status_code == 400


def test_patch_status_not_found_returns_404(monkeypatch, fake_collection):
    response = client.patch(
        "/api/v1/applications/000000000000000000000000/status",
        headers={"Authorization": "Bearer test-token"},
        json={"status": "applied"},
    )
    assert response.status_code == 404


def test_delete_application_endpoint(fake_collection):
    created = _seed(fake_collection, TEST_USER_ID)
    response = client.delete(
        f"/api/v1/applications/{created['application_id']}",
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 200
    assert response.json() == {"deleted": True}

    missing = client.delete(
        f"/api/v1/applications/{created['application_id']}",
        headers={"Authorization": "Bearer test-token"},
    )
    assert missing.status_code == 404
