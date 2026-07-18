from fastapi.testclient import TestClient

from app.api.routes import analysis as analysis_route
from app.api.routes import history as history_route
from app.core.config import settings
from app.main import app
from app.models.response import AIAnalysisPayload, AnalysisResult, HistoryItem, HistoryListResponse, Scores


client = TestClient(app)


def valid_headers() -> dict[str, str]:
    return {"X-Session-ID": "11111111-1111-4111-8111-111111111111"}


def valid_resume() -> str:
    return (
        "SUMMARY\nPython backend developer with FastAPI and REST API experience.\n"
        "SKILLS\nPython, FastAPI, React, TypeScript, PostgreSQL, testing, deployment.\n"
        "EXPERIENCE\nBuilt APIs, deployed services, wrote automated tests, and worked with databases. "
        * 3
    )


def valid_jd() -> str:
    return (
        "We need a Python backend developer with FastAPI, REST APIs, testing, deployment, "
        "database experience, and frontend collaboration skills. "
        * 2
    )


def test_analyze_requires_session_header() -> None:
    response = client.post(
        "/analyze",
        data={
            "input_mode": "text",
            "resume_text": valid_resume(),
            "job_description": valid_jd(),
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Missing X-Session-ID header"


def test_analyze_rejects_short_resume() -> None:
    response = client.post(
        "/analyze",
        headers=valid_headers(),
        data={
            "input_mode": "text",
            "resume_text": "too short",
            "job_description": valid_jd(),
        },
    )

    assert response.status_code == 422


def test_analyze_returns_503_without_groq_key(monkeypatch) -> None:
    monkeypatch.setattr(settings, "groq_api_key", None)

    response = client.post(
        "/analyze",
        headers=valid_headers(),
        data={
            "input_mode": "text",
            "resume_text": valid_resume(),
            "job_description": valid_jd(),
        },
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Groq API key is not configured"


def test_analyze_returns_ai_payload_when_chain_succeeds(monkeypatch) -> None:
    class FakeAnalysisChain:
        async def analyze(self, *, parsed_resume, job_description, past_context=""):
            assert len(parsed_resume.text) >= 200
            assert len(job_description) >= 100
            return AIAnalysisPayload(
                job_title="Senior Python Developer",
                scores=Scores(
                    overall=72,
                    skills_match=80,
                    experience_relevance=65,
                    keyword_coverage=70,
                ),
                missing_skills=["Kubernetes", "Redis", "System Design"],
                ats_keywords=["microservices", "CI/CD", "REST API", "cloud-native", "agile"],
                strengths=["Strong Python backend experience", "Relevant FastAPI work"],
                improvement_tips=[
                    "Add Kubernetes to the Skills section.",
                    "Include metrics in backend API bullets.",
                    "Mirror REST API terminology from the job description.",
                ],
                context_note="No past context was available.",
            )

    monkeypatch.setattr(analysis_route, "analysis_chain", FakeAnalysisChain())

    response = client.post(
        "/analyze",
        headers=valid_headers(),
        data={
            "input_mode": "text",
            "resume_text": valid_resume(),
            "job_description": valid_jd(),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["job_title"] == "Senior Python Developer"
    assert body["scores"]["overall"] == 72
    assert len(body["ats_keywords"]) == 5


def test_analyze_retrieves_context_and_saves_history(monkeypatch) -> None:
    calls = {"context": False, "upsert": False, "save": False}

    class FakeAnalysisChain:
        async def analyze(self, *, parsed_resume, job_description, past_context=""):
            assert "Previous backend analysis" in past_context
            return AIAnalysisPayload(
                job_title="Backend Engineer",
                scores=Scores(
                    overall=81,
                    skills_match=85,
                    experience_relevance=80,
                    keyword_coverage=78,
                ),
                missing_skills=["Redis"],
                ats_keywords=["FastAPI", "REST API", "PostgreSQL", "CI/CD", "testing"],
                strengths=["Strong API experience", "Testing experience"],
                improvement_tips=[
                    "Add Redis if relevant.",
                    "Mention CI/CD deployment details.",
                    "Add PostgreSQL impact metrics.",
                ],
                context_note="Compared against previous backend analysis.",
            )

    class FakeQdrantService:
        async def retrieve_context(self, *, session_id, job_description):
            calls["context"] = True
            assert session_id == valid_headers()["X-Session-ID"]
            assert "Python backend developer" in job_description
            return "Previous backend analysis scored 70."

        async def upsert_analysis(self, *, session_id, result, parsed_resume):
            calls["upsert"] = True
            assert result.job_title == "Backend Engineer"
            return result.analysis_id

    class FakeMongoService:
        async def save_analysis(self, *, session_id, result, resume_text, qdrant_vector_id=None):
            calls["save"] = True
            assert qdrant_vector_id == result.analysis_id
            assert len(resume_text) >= 200
            return True

    monkeypatch.setattr(analysis_route, "analysis_chain", FakeAnalysisChain())
    monkeypatch.setattr(analysis_route, "qdrant_service", FakeQdrantService())
    monkeypatch.setattr(analysis_route, "mongo_service", FakeMongoService())

    response = client.post(
        "/analyze",
        headers=valid_headers(),
        data={
            "input_mode": "text",
            "resume_text": valid_resume(),
            "job_description": valid_jd(),
        },
    )

    assert response.status_code == 200
    assert calls == {"context": True, "upsert": True, "save": True}
    assert response.json()["scores"]["overall"] == 81


def test_history_routes_use_mongo_and_qdrant_services(monkeypatch) -> None:
    result = AnalysisResult(
        analysis_id="22222222-2222-4222-8222-222222222222",
        job_title="Backend Engineer",
        timestamp="2026-06-08T10:00:00Z",
        scores=Scores(
            overall=81,
            skills_match=85,
            experience_relevance=80,
            keyword_coverage=78,
        ),
        missing_skills=["Redis"],
        ats_keywords=["FastAPI", "REST API", "PostgreSQL", "CI/CD", "testing"],
        strengths=["Strong API experience"],
        improvement_tips=["Add Redis if relevant."],
        context_note="Stored analysis.",
    )

    class FakeDelete:
        deleted = True
        qdrant_vector_id = result.analysis_id

    class FakeMongoService:
        async def list_history(self, *, session_id, limit=10, skip=0):
            assert limit == 10
            assert skip == 0
            return HistoryListResponse(
                analyses=[
                    HistoryItem(
                        analysis_id=result.analysis_id,
                        job_title=result.job_title,
                        timestamp=result.timestamp,
                        scores=result.scores,
                    )
                ],
                total=1,
            )

        async def get_analysis(self, *, session_id, analysis_id):
            assert analysis_id == result.analysis_id
            return result

        async def delete_analysis(self, *, session_id, analysis_id):
            assert analysis_id == result.analysis_id
            return FakeDelete()

    class FakeQdrantService:
        async def delete_analysis(self, *, vector_id):
            assert vector_id == result.analysis_id
            return True

    monkeypatch.setattr(history_route, "mongo_service", FakeMongoService())
    monkeypatch.setattr(history_route, "qdrant_service", FakeQdrantService())

    list_response = client.get("/history", headers=valid_headers())
    detail_response = client.get(f"/history/{result.analysis_id}", headers=valid_headers())
    delete_response = client.delete(f"/history/{result.analysis_id}", headers=valid_headers())

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert detail_response.status_code == 200
    assert detail_response.json()["analysis_id"] == result.analysis_id
    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted": True, "qdrant_deleted": True}
