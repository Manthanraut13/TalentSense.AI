"""Phase 24 — Training signal collection scaffold.

Verifies the anonymized (resume, jd) -> score signal logging used to build a
future fine-tuning dataset. Uses a fake Mongo collection — no network calls.
"""

import asyncio

import pytest

from app.core.config import settings
from app.services import training_data_service as tds
from app.services.mongo_service import mongo_service

SAMPLE_RESUME = "Python developer with 5 years of FastAPI experience."
SAMPLE_JD = "Senior Python Developer — need FastAPI, Docker, PostgreSQL."
OTHER_RESUME = "Marketing manager focused on brand strategy."
OTHER_JD = "Growth Marketing Lead — need SEO and paid acquisition."


class FakeTrainingCollection:
    def __init__(self):
        self.docs = []
        self.last_doc = None

    async def find_one(self, query):
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return dict(doc)
        return None

    async def insert_one(self, doc):
        self.last_doc = dict(doc)
        self.docs.append(dict(doc))


@pytest.fixture
def fake_collection(monkeypatch):
    collection = FakeTrainingCollection()
    monkeypatch.setattr(
        mongo_service,
        "_get_collection",
        lambda: _fake_analyses(collection),
    )
    return collection


def _fake_analyses(training_collection):
    class Wrapper:
        class database:
            training_signals = training_collection

    return Wrapper()


def test_log_training_signal_stores_hashes_and_score(monkeypatch, fake_collection):
    monkeypatch.setattr(settings, "store_resume_snippet", False)
    ok = asyncio.run(
        tds.log_training_signal(
            user_id="user1",
            resume_text=SAMPLE_RESUME,
            jd_text=SAMPLE_JD,
            score=82,
        )
    )
    assert ok is True
    doc = fake_collection.docs[0]
    assert doc["score"] == 82
    assert doc["resume_hash"] == tds._hash(SAMPLE_RESUME)
    assert doc["jd_hash"] == tds._hash(SAMPLE_JD)
    assert "user_id" not in doc
    assert "resume_snippet" not in doc  # privacy setting off


def test_log_training_signal_stores_snippets_when_enabled(monkeypatch, fake_collection):
    monkeypatch.setattr(settings, "store_resume_snippet", True)
    asyncio.run(
        tds.log_training_signal(
            user_id="user1",
            resume_text=SAMPLE_RESUME,
            jd_text=SAMPLE_JD,
            score=60,
        )
    )
    doc = fake_collection.docs[0]
    assert doc["resume_snippet"] == SAMPLE_RESUME[:500]
    assert doc["jd_snippet"] == SAMPLE_JD[:500]


def test_log_training_signal_deduplicates_identical_pairs(fake_collection):
    asyncio.run(
        tds.log_training_signal(
            user_id="user1",
            resume_text=SAMPLE_RESUME,
            jd_text=SAMPLE_JD,
            score=82,
        )
    )
    second = asyncio.run(
        tds.log_training_signal(
            user_id="user1",
            resume_text=SAMPLE_RESUME,
            jd_text=SAMPLE_JD,
            score=85,
        )
    )
    assert second is False
    assert len(fake_collection.docs) == 1


def test_log_training_signal_allows_distinct_pairs(fake_collection):
    asyncio.run(
        tds.log_training_signal(
            user_id="user1",
            resume_text=SAMPLE_RESUME,
            jd_text=SAMPLE_JD,
            score=82,
        )
    )
    asyncio.run(
        tds.log_training_signal(
            user_id="user1",
            resume_text=OTHER_RESUME,
            jd_text=OTHER_JD,
            score=40,
        )
    )
    assert len(fake_collection.docs) == 2


def test_log_training_signal_returns_false_when_db_unavailable(monkeypatch):
    monkeypatch.setattr(mongo_service, "_get_collection", lambda: None)
    ok = asyncio.run(
        tds.log_training_signal(
            user_id="user1",
            resume_text=SAMPLE_RESUME,
            jd_text=SAMPLE_JD,
            score=50,
        )
    )
    assert ok is False


def test_prepare_training_pairs_labels():
    from scripts import prepare_training_pairs

    records = [
        {"resume_snippet": "a", "jd_snippet": "b", "score": 90},
        {"resume_snippet": "c", "jd_snippet": "d", "score": 30},
        {"resume_snippet": "e", "jd_snippet": "f", "score": 55},  # middle -> skipped
        {"score": 88},  # missing snippets -> skipped
    ]
    pairs = prepare_training_pairs.build_pairs(records)
    assert len(pairs) == 2
    assert pairs[0]["label"] == 1.0
    assert pairs[1]["label"] == 0.0
    assert pairs[0]["sentence1"] == "a"
    assert pairs[1]["sentence2"] == "d"
