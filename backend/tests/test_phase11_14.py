import pytest
from fastapi.testclient import TestClient

from app.api import deps
from app.api.deps import get_current_user
from app.api.routes import compare as compare_route
from app.api.routes import learning as learning_route
from app.main import app
from app.services.ats_simulator import run_ats_simulation

client = TestClient(app)
TEST_USER_ID = "user_test123"


def valid_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}


async def fake_current_user() -> str:
    return TEST_USER_ID


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


def setup_function() -> None:
    app.dependency_overrides.clear()


def teardown_function() -> None:
    app.dependency_overrides.clear()


# --------------------------------------------------------------------------- #
# ATS Simulator
# --------------------------------------------------------------------------- #

def test_ats_simulator_keyword_hits_and_misses() -> None:
    resume = "Python developer with FastAPI, PostgreSQL and Docker experience."
    jd = "We require python, fastapi, kubernetes, react and aws skills."
    result = run_ats_simulation(resume, jd)
    assert "python" in result.keyword_hits
    assert "fastapi" in result.keyword_hits
    assert "kubernetes" in result.keyword_misses
    assert "react" in result.keyword_misses
    assert 0 <= result.ats_score <= 100
    assert any(d["check"] == "Keyword Coverage" for d in result.details)


def test_ats_simulator_experience_and_education() -> None:
    resume = "2019 - 2024 Software Engineer. Bachelor of Science in Computer Science."
    jd = "Requires 3+ years of experience and a bachelor's degree."
    result = run_ats_simulation(resume, jd)
    assert result.experience_required == 3
    assert result.experience_match is True
    assert result.education_required == "bachelor"
    assert result.education_match is True


def test_ats_simulator_is_deterministic() -> None:
    resume = valid_resume()
    jd = valid_jd()
    first = run_ats_simulation(resume, jd)
    second = run_ats_simulation(resume, jd)
    assert first.ats_score == second.ats_score
    assert first.keyword_hits == second.keyword_hits


# --------------------------------------------------------------------------- #
# Rate limiting
# --------------------------------------------------------------------------- #

def test_analyze_returns_429_when_limit_reached(monkeypatch) -> None:
    app.dependency_overrides[get_current_user] = fake_current_user

    async def limited(user_id: str, is_pro: bool = False):
        return {"allowed": False, "used": 5, "limit": 5, "remaining": 0}

    monkeypatch.setattr(deps, "check_rate_limit", limited)

    response = client.post(
        "/analyze",
        headers=valid_headers(),
        data={
            "input_mode": "text",
            "resume_text": valid_resume(),
            "job_description": valid_jd(),
        },
    )

    assert response.status_code == 429
    assert response.json()["detail"]["message"] == "Daily analysis limit reached. Please try again tomorrow."


# --------------------------------------------------------------------------- #
# Phase 11: Multi-JD Comparison
# --------------------------------------------------------------------------- #

def test_compare_requires_two_jds() -> None:
    app.dependency_overrides[get_current_user] = fake_current_user
    response = client.post(
        "/api/compare",
        headers=valid_headers(),
        json={"resume_text": valid_resume(), "job_descriptions": [valid_jd()]},
    )
    assert response.status_code == 422


def test_compare_rejects_three_plus_jds() -> None:
    app.dependency_overrides[get_current_user] = fake_current_user
    response = client.post(
        "/api/compare",
        headers=valid_headers(),
        json={"resume_text": valid_resume(), "job_descriptions": [valid_jd(), valid_jd(), valid_jd(), valid_jd()]},
    )
    assert response.status_code == 422


def test_compare_returns_ranked_results(monkeypatch) -> None:
    app.dependency_overrides[get_current_user] = fake_current_user

    async def fake_run_comparison(resume_text: str, job_descriptions: list[str]) -> list[dict]:
        assert len(job_descriptions) == 2
        return [
            {
                "job_title": "Backend Engineer",
                "scores": {"overall": 85, "skills_match": 88, "experience_relevance": 82, "keyword_coverage": 80},
                "missing_skills": ["Redis"],
                "key_strengths": ["FastAPI"],
                "biggest_gap": "No Redis",
                "fit_summary": "Strong fit.",
            },
            {
                "job_title": "Frontend Engineer",
                "scores": {"overall": 55, "skills_match": 50, "experience_relevance": 60, "keyword_coverage": 55},
                "missing_skills": ["React", "CSS", "Next.js"],
                "key_strengths": ["TypeScript"],
                "biggest_gap": "No React experience",
                "fit_summary": "Weak fit.",
            },
        ]

    async def allow_rate_limit(user_id: str, is_pro: bool = False):
        return {"allowed": True, "used": 1, "limit": 5, "remaining": 4}

    monkeypatch.setattr(compare_route, "run_comparison", fake_run_comparison)
    monkeypatch.setattr(deps, "check_rate_limit", allow_rate_limit)

    response = client.post(
        "/api/compare",
        headers=valid_headers(),
        json={"resume_text": valid_resume(), "job_descriptions": [valid_jd(), valid_jd()]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_compared"] == 2
    assert body["recommendation"]["recommended_index"] == 0
    assert body["recommendation"]["recommended_title"] == "Backend Engineer"
    assert body["recommendation"]["avoid_index"] == 1
    assert body["results"][0]["scores"]["overall"] == 85


def test_compare_handles_partial_failure(monkeypatch) -> None:
    app.dependency_overrides[get_current_user] = fake_current_user

    async def failing_run_comparison(resume_text: str, job_descriptions: list[str]) -> list[dict]:
        return [
            {"job_title": "Job 1", "error": "boom", "scores": {"overall": 0, "skills_match": 0, "experience_relevance": 0, "keyword_coverage": 0}},
            {
                "job_title": "Data Engineer",
                "scores": {"overall": 70, "skills_match": 72, "experience_relevance": 68, "keyword_coverage": 70},
                "missing_skills": [],
                "key_strengths": ["SQL"],
                "biggest_gap": "",
                "fit_summary": "Decent.",
            },
        ]

    async def allow_rate_limit(user_id: str, is_pro: bool = False):
        return {"allowed": True, "used": 1, "limit": 5, "remaining": 4}

    monkeypatch.setattr(compare_route, "run_comparison", failing_run_comparison)
    monkeypatch.setattr(deps, "check_rate_limit", allow_rate_limit)

    response = client.post(
        "/api/compare",
        headers=valid_headers(),
        json={"resume_text": valid_resume(), "job_descriptions": [valid_jd(), valid_jd()]},
    )

    assert response.status_code == 200
    body = response.json()
    assert "error" in body["results"][0]
    assert body["recommendation"]["recommended_index"] == 1


def test_compare_returns_429_when_limited(monkeypatch) -> None:
    app.dependency_overrides[get_current_user] = fake_current_user

    async def limited(user_id: str, is_pro: bool = False):
        return {"allowed": False, "used": 5, "limit": 5, "remaining": 0}

    monkeypatch.setattr(deps, "check_rate_limit", limited)

    response = client.post(
        "/api/compare",
        headers=valid_headers(),
        json={"resume_text": valid_resume(), "job_descriptions": [valid_jd(), valid_jd()]},
    )

    assert response.status_code == 429


# --------------------------------------------------------------------------- #
# Phase 12: Learning Roadmap
# --------------------------------------------------------------------------- #

def test_learning_plan_generates_plans(monkeypatch) -> None:
    app.dependency_overrides[get_current_user] = fake_current_user

    async def fake_generate_plan(skill: str, job_context: str = "") -> dict:
        return {
            "skill": skill,
            "priority": "high",
            "why_needed": "Required by the JD.",
            "estimated_weeks": 3,
            "learning_path": ["Learn basics", "Build project", "Practice"],
            "resources": [
                {"title": "Tutorial", "url": "https://youtube.com/watch?v=1", "snippet": "learn", "type": "video"}
            ],
        }

    async def allow_rate_limit(user_id: str, is_pro: bool = False):
        return {"allowed": True, "used": 1, "limit": 5, "remaining": 4}

    monkeypatch.setattr(learning_route, "generate_learning_plan", fake_generate_plan)
    monkeypatch.setattr(deps, "check_rate_limit", allow_rate_limit)

    response = client.post(
        "/api/learning-plan",
        headers=valid_headers(),
        json={"skills": ["Redis", "Kubernetes"], "job_context": "Backend role"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert body["plans"][0]["skill"] == "Redis"
    assert body["plans"][1]["resources"][0]["type"] == "video"


def test_learning_plan_caps_at_eight_skills(monkeypatch) -> None:
    app.dependency_overrides[get_current_user] = fake_current_user

    async def fake_generate_plan(skill: str, job_context: str = "") -> dict:
        return {"skill": skill, "priority": "low", "estimated_weeks": 1, "learning_path": [], "resources": []}

    async def allow_rate_limit(user_id: str, is_pro: bool = False):
        return {"allowed": True, "used": 1, "limit": 5, "remaining": 4}

    monkeypatch.setattr(learning_route, "generate_learning_plan", fake_generate_plan)
    monkeypatch.setattr(deps, "check_rate_limit", allow_rate_limit)

    response = client.post(
        "/api/learning-plan",
        headers=valid_headers(),
        json={"skills": [f"Skill {i}" for i in range(15)]},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 8


def test_learning_plan_rejects_empty_skills(monkeypatch) -> None:
    app.dependency_overrides[get_current_user] = fake_current_user

    async def allow_rate_limit(user_id: str, is_pro: bool = False):
        return {"allowed": True, "used": 1, "limit": 5, "remaining": 4}

    monkeypatch.setattr(deps, "check_rate_limit", allow_rate_limit)

    response = client.post(
        "/api/learning-plan",
        headers=valid_headers(),
        json={"skills": ["   "]},
    )

    assert response.status_code == 422
