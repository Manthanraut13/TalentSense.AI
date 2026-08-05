from app.services.ats_simulator import (
    check_experience_in_resume,
    extract_experience_requirement,
    extract_keywords_from_jd,
    run_ats_simulation,
)


def test_extract_keywords_finds_python_and_docker():
    jd = "We need someone with Python, FastAPI, and Docker experience"
    keywords = extract_keywords_from_jd(jd)
    assert "python" in keywords
    assert "docker" in keywords


def test_extract_experience_requirement():
    jd = "Minimum 3 years of software engineering experience required"
    assert extract_experience_requirement(jd) == 3


def test_extract_experience_with_plus():
    jd = "5+ years of Python development experience"
    assert extract_experience_requirement(jd) == 5


def test_extract_experience_at_least():
    jd = "At least 2 years of backend development"
    assert extract_experience_requirement(jd) == 2


def test_extract_experience_missing_returns_none():
    jd = "We are a fast growing startup"
    assert extract_experience_requirement(jd) is None


def test_experience_match_with_sufficient_years():
    resume = "Software Engineer at Acme Corp 2018-2024\nPython Developer 2016-2018"
    assert check_experience_in_resume(5, resume) is True


def test_experience_no_match_with_insufficient_years():
    resume = "Junior Developer at Acme Corp 2022-2024"
    assert check_experience_in_resume(5, resume) is False


def test_ats_simulation_returns_score(sample_resume_text, sample_jd_text):
    result = run_ats_simulation(sample_resume_text, sample_jd_text)
    assert 0 <= result.ats_score <= 100
    assert isinstance(result.keyword_hits, list)
    assert isinstance(result.keyword_misses, list)
    assert "python" in result.keyword_hits


def test_ats_simulation_detects_missing_kubernetes(sample_resume_text, sample_jd_text):
    result = run_ats_simulation(sample_resume_text, sample_jd_text)
    assert "kubernetes" in result.keyword_misses


def test_ats_simulation_checks_education_match(sample_resume_text, sample_jd_text):
    result = run_ats_simulation(sample_resume_text, sample_jd_text)
    assert result.education_required == "bachelor"
    assert result.education_match is True
    assert result.checks_total >= 1
    assert len(result.details) == result.checks_total
