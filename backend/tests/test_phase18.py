import asyncio

import pytest

from app.core.config import settings
from app.services import mongo_service as mongo_module


class FakeAsyncCollection:
    def __init__(self, conflict: bool = False, db=None):
        self.created = []
        self.conflict = conflict
        self.database = db

    async def create_index(self, keys, *args, **kwargs):
        self.created.append((keys, kwargs.get("name")))
        if self.conflict:
            error = Exception("Index already exists with a different name")
            error.code = 85
            raise error


class FakeDatabase:
    def __init__(self):
        self.rate_limits = FakeAsyncCollection(db=self)
        self.users = FakeAsyncCollection(db=self)
        self.resumes = FakeAsyncCollection(db=self)
        self.learning_plans = FakeAsyncCollection(db=self)
        self.scraped_jds = FakeAsyncCollection(db=self)
        self.job_applications = FakeAsyncCollection(db=self)


@pytest.fixture(autouse=True)
def reset_index_cache():
    mongo_module.mongo_service._indexes_ready = False
    yield
    mongo_module.mongo_service._indexes_ready = False


def test_create_indexes_issues_expected_indexes(monkeypatch):
    db = FakeDatabase()
    analyses = FakeAsyncCollection(db=db)
    monkeypatch.setattr(
        mongo_module.mongo_service,
        "_get_collection",
        lambda: analyses,
    )

    asyncio.run(mongo_module.mongo_service.create_indexes())

    names = [name for _, name in analyses.created]
    assert "user_history_idx" in names
    assert "analysis_id_unique_idx" in names

    assert [name for _, name in db.rate_limits.created] == [
        "rate_limit_user_date_idx",
        "rate_limit_ttl_idx",
    ]
    assert [name for _, name in db.users.created] == [
        "user_id_unique_idx",
        "stripe_customer_idx",
    ]
    assert [name for _, name in db.resumes.created] == ["resume_user_date_idx"]
    assert [name for _, name in db.learning_plans.created] == [
        "skill_unique_idx",
        "learning_plan_ttl_idx",
    ]
    assert [name for _, name in db.scraped_jds.created] == [
        "url_unique_idx",
        "scraped_jd_ttl_idx",
    ]


def test_create_indexes_tolerates_existing_unnamed_indexes(monkeypatch):
    db = FakeDatabase()
    analyses = FakeAsyncCollection(conflict=True, db=db)
    monkeypatch.setattr(
        mongo_module.mongo_service,
        "_get_collection",
        lambda: analyses,
    )

    # Must NOT raise even though every index conflicts with a differently-named one
    asyncio.run(mongo_module.mongo_service.create_indexes())
    assert mongo_module.mongo_service._indexes_ready is True


def test_create_indexes_is_idempotent(monkeypatch):
    db = FakeDatabase()
    analyses = FakeAsyncCollection(db=db)
    monkeypatch.setattr(
        mongo_module.mongo_service,
        "_get_collection",
        lambda: analyses,
    )

    asyncio.run(mongo_module.mongo_service.create_indexes())
    asyncio.run(mongo_module.mongo_service.create_indexes())

    # Only issued once thanks to the _indexes_ready guard
    assert len(analyses.created) == 2


def test_slow_query_threshold_is_configurable():
    assert settings.slow_query_threshold_ms > 0


def test_list_history_empty_without_mongo(monkeypatch):
    monkeypatch.setattr(mongo_module.mongo_service, "_get_collection", lambda: None)

    response = asyncio.run(
        mongo_module.mongo_service.list_history(user_id="user_x")
    )
    assert response.total == 0
    assert response.analyses == []
