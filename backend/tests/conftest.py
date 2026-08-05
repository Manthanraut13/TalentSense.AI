import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

FAKE_USER_ID = "user_test_123"


@pytest.fixture
def fake_user_id() -> str:
    return FAKE_USER_ID


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
async def async_client():
    """Async HTTP client for FastAPI endpoint testing."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client


@pytest.fixture
def sample_resume_text() -> str:
    return """
    John Doe | john@example.com | github.com/johndoe

    SKILLS
    Python, FastAPI, PostgreSQL, Docker, Git, REST APIs, Linux

    EXPERIENCE
    Software Engineer — Acme Corp (2021–2024)
    - Built REST APIs using FastAPI and Python
    - Managed PostgreSQL databases with SQLAlchemy
    - Containerized services using Docker

    EDUCATION
    B.Tech Computer Science — XYZ University (2017–2021)
    """


@pytest.fixture
def sample_jd_text() -> str:
    return """
    Senior Python Developer — TechCorp

    Requirements:
    - 3+ years of Python experience
    - Experience with FastAPI or Django
    - Docker and Kubernetes knowledge required
    - PostgreSQL or MongoDB experience
    - CI/CD pipeline experience (GitHub Actions, Jenkins)
    - Bachelor's degree in Computer Science or related field

    Nice to have:
    - Redis knowledge
    - Microservices architecture experience
    - AWS or GCP cloud experience
    """
