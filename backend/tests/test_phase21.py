"""Phase 21 — LangGraph AI career coach.

The coach agent's graph is exercised with a mocked LLM and a fake Mongo
service so no external network calls are made.
"""

import asyncio
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, HumanMessage

from app.api.deps import get_current_user
from app.api.routes import coach as coach_route
from app.main import app
from app.models.response import AnalysisResult, HistoryItem, HistoryListResponse, Scores
from app.services import coach_agent

client = TestClient(app)
TEST_USER_ID = "user_test123"


class FakeMongoService:
    def __init__(self, analyses=None, full=None):
        self.analyses = analyses or []
        self.full = full or {}

    async def list_history(self, *, user_id, limit=10, skip=0):
        return HistoryListResponse(analyses=self.analyses, total=len(self.analyses))

    async def get_analysis(self, *, user_id, analysis_id):
        return self.full.get(analysis_id)


def _analysis(analysis_id: str, title: str, score: int) -> AnalysisResult:
    return AnalysisResult(
        analysis_id=analysis_id,
        job_title=title,
        timestamp="2026-07-01T10:00:00Z",
        scores=Scores(overall=score, skills_match=70, experience_relevance=60, keyword_coverage=65),
        missing_skills=["Kubernetes", "Redis"],
        ats_keywords=["FastAPI", "Docker"],
        strengths=["Strong Python"],
        improvement_tips=["Add Kubernetes"],
        context_note="",
    )


def _item(analysis_id: str, title: str, score: int) -> HistoryItem:
    return HistoryItem(
        analysis_id=analysis_id,
        job_title=title,
        timestamp="2026-07-01T10:00:00Z",
        scores=Scores(overall=score, skills_match=70, experience_relevance=60, keyword_coverage=65),
    )


def test_build_system_prompt_includes_history():
    prompt = coach_agent.build_system_prompt("USER HISTORY:\n- Backend Engineer: 80%")
    assert "USER HISTORY:" in prompt
    assert "Backend Engineer: 80%" in prompt


def test_should_continue_returns_end():
    assert coach_agent.should_continue({}) == "END"


def test_load_user_context_with_no_analyses(monkeypatch):
    monkeypatch.setattr(coach_agent, "mongo_service", FakeMongoService())

    async def run():
        return await coach_agent.load_user_context({"user_id": TEST_USER_ID, "messages": []})

    result = asyncio.run(run())
    assert "has not run any analyses" in result["user_context"]


def test_load_user_context_skips_when_already_loaded(monkeypatch):
    fake = FakeMongoService()
    monkeypatch.setattr(coach_agent, "mongo_service", fake)

    async def run():
        return await coach_agent.load_user_context(
            {"user_id": TEST_USER_ID, "messages": [], "user_context": "existing"}
        )

    result = asyncio.run(run())
    assert result == {}
    assert fake.analyses == []


def test_load_user_context_builds_history_summary(monkeypatch):
    item = _item("a1", "Backend Engineer", 80)
    fake = FakeMongoService(
        analyses=[item],
        full={"a1": _analysis("a1", "Backend Engineer", 80)},
    )
    monkeypatch.setattr(coach_agent, "mongo_service", fake)

    async def run():
        return await coach_agent.load_user_context({"user_id": TEST_USER_ID, "messages": []})

    result = asyncio.run(run())
    assert "Backend Engineer" in result["user_context"]
    assert "80% match" in result["user_context"]
    assert "Kubernetes" in result["user_context"]


def test_chat_with_coach_returns_ai_content(monkeypatch):
    fake_llm = AsyncMock()
    fake_llm.ainvoke = AsyncMock(return_value=AIMessage(content="Focus on Kubernetes next."))
    monkeypatch.setattr(coach_agent, "get_coach_llm", lambda: fake_llm)
    monkeypatch.setattr(coach_agent, "mongo_service", FakeMongoService())

    result = asyncio.run(coach_agent.chat_with_coach(TEST_USER_ID, "What should I learn?", "c1"))
    assert result == "Focus on Kubernetes next."


def test_chat_with_coach_fallbacks_without_ai_message(monkeypatch):
    fake_llm = AsyncMock()
    fake_llm.ainvoke = AsyncMock(return_value=HumanMessage(content="oops"))
    monkeypatch.setattr(coach_agent, "get_coach_llm", lambda: fake_llm)
    monkeypatch.setattr(coach_agent, "mongo_service", FakeMongoService())

    result = asyncio.run(coach_agent.chat_with_coach(TEST_USER_ID, "hello", "c2"))
    assert result == "I'm having trouble responding right now."


def setup_function() -> None:
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_coach_chat_endpoint_returns_response_and_conversation_id(monkeypatch):
    async def fake_chat(*, user_id, message, conversation_id):
        assert user_id == TEST_USER_ID
        assert message == "What jobs match my background?"
        return "You match backend roles best."

    monkeypatch.setattr(coach_route, "chat_with_coach", fake_chat)

    response = client.post(
        "/api/v1/coach/chat",
        headers={"Authorization": "Bearer test-token"},
        json={"message": "What jobs match my background?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["response"] == "You match backend roles best."
    assert body["conversation_id"]


def test_coach_chat_preserves_provided_conversation_id(monkeypatch):
    async def fake_chat(*, user_id, message, conversation_id):
        return "ok"

    monkeypatch.setattr(coach_route, "chat_with_coach", fake_chat)

    response = client.post(
        "/api/v1/coach/chat",
        headers={"Authorization": "Bearer test-token"},
        json={"message": "hi", "conversation_id": "conv-abc"},
    )

    assert response.status_code == 200
    assert response.json()["conversation_id"] == "conv-abc"


def test_coach_chat_rejects_empty_message():
    response = client.post(
        "/api/v1/coach/chat",
        headers={"Authorization": "Bearer test-token"},
        json={"message": "   "},
    )
    assert response.status_code == 400


def test_coach_chat_rejects_long_message():
    response = client.post(
        "/api/v1/coach/chat",
        headers={"Authorization": "Bearer test-token"},
        json={"message": "x" * 1001},
    )
    assert response.status_code == 400
