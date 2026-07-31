import re
from typing import NamedTuple

from rapidfuzz import fuzz, process

# Common skills vocabulary for extraction
TECH_SKILLS_VOCAB = {
    "python", "javascript", "typescript", "java", "golang", "rust", "c++",
    "fastapi", "django", "flask", "react", "vue", "angular", "nextjs",
    "docker", "kubernetes", "aws", "gcp", "azure", "terraform",
    "postgresql", "mongodb", "redis", "elasticsearch",
    "machine learning", "deep learning", "nlp", "computer vision",
    "langchain", "pytorch", "tensorflow", "scikit-learn",
    "git", "ci/cd", "agile", "scrum", "rest api", "graphql",
    "microservices", "distributed systems", "system design",
    "sql", "nosql", "kafka", "rabbitmq", "celery",
}

EXPERIENCE_PATTERNS = [
    r"(\d+)\+?\s*(?:to\s*\d+)?\s*years?\s*(?:of\s*)?(?:experience|exp)",
    r"minimum\s+(\d+)\s+years?",
    r"at\s+least\s+(\d+)\s+years?",
]

EDUCATION_KEYWORDS = {
    "bachelor": ["bachelor", "b.s", "b.e", "b.tech", "undergraduate", "bs in"],
    "master": ["master", "m.s", "m.tech", "mba", "graduate degree"],
    "phd": ["phd", "ph.d", "doctorate", "doctoral"],
}


class ATSResult(NamedTuple):
    ats_score: int
    keyword_hits: list[str]
    keyword_misses: list[str]
    experience_required: int | None
    experience_match: bool | None
    education_required: str | None
    education_match: bool | None
    checks_passed: int
    checks_total: int
    details: list[dict]


def extract_keywords_from_jd(jd_text: str) -> list[str]:
    """Extract technical keywords from JD using vocabulary matching."""
    jd_lower = jd_text.lower()
    found = []
    for skill in TECH_SKILLS_VOCAB:
        if skill in jd_lower:
            found.append(skill)
    # Also extract words near requirement markers
    requirement_sections = re.findall(
        r"(?:required|must have|requirements?|skills?|qualifications?)[:\s]+([^.]{20,200})",
        jd_lower
    )
    for section in requirement_sections:
        for skill in TECH_SKILLS_VOCAB:
            if skill in section and skill not in found:
                found.append(skill)
    return found


def check_keyword_in_resume(keyword: str, resume_text: str) -> bool:
    """Check if a keyword appears in the resume (exact or fuzzy match)."""
    resume_lower = resume_text.lower()
    # Exact match first
    if keyword in resume_lower:
        return True
    # Fuzzy match for compound terms
    if len(keyword) > 5:
        words = resume_lower.split()
        if not words:
            return False
        score = process.extractOne(keyword, words, scorer=fuzz.WRatio)
        if score and score[1] >= 85:
            return True
    return False


def extract_experience_requirement(jd_text: str) -> int | None:
    """Extract minimum years of experience from JD."""
    for pattern in EXPERIENCE_PATTERNS:
        match = re.search(pattern, jd_text, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except (ValueError, IndexError):
                pass
    return None


def check_experience_in_resume(required_years: int, resume_text: str) -> bool:
    """Check if resume shows enough experience."""
    # Extract years mentioned in resume
    years_found = re.findall(r"(\d{4})\s*[-–]\s*(\d{4}|present|current)", resume_text, re.IGNORECASE)
    if not years_found:
        return True  # Can't determine — give benefit of doubt

    total_years = 0
    import datetime
    current_year = datetime.datetime.now().year
    for start, end in years_found:
        end_year = current_year if end.lower() in ["present", "current"] else int(end)
        total_years += max(0, end_year - int(start))

    return total_years >= required_years


def check_education(jd_text: str, resume_text: str) -> tuple[str | None, bool | None]:
    """Check if resume meets education requirements from JD."""
    jd_lower = jd_text.lower()
    resume_lower = resume_text.lower()

    required_level = None
    for level, keywords in EDUCATION_KEYWORDS.items():
        if any(kw in jd_lower for kw in keywords):
            required_level = level
            break

    if not required_level:
        return None, None

    # Check if resume has this or higher education
    levels_order = ["bachelor", "master", "phd"]
    required_idx = levels_order.index(required_level)
    for check_level in levels_order[required_idx:]:
        if any(kw in resume_lower for kw in EDUCATION_KEYWORDS[check_level]):
            return required_level, True

    return required_level, False


def run_ats_simulation(resume_text: str, jd_text: str) -> ATSResult:
    """
    Main ATS simulation function.
    Returns a structured result mimicking ATS keyword matching.
    """
    details = []
    checks_passed = 0
    checks_total = 0

    # 1. Keyword matching
    keywords = extract_keywords_from_jd(jd_text)
    keyword_hits = []
    keyword_misses = []

    for kw in keywords:
        if check_keyword_in_resume(kw, resume_text):
            keyword_hits.append(kw)
        else:
            keyword_misses.append(kw)

    if keywords:
        kw_pass_rate = len(keyword_hits) / len(keywords)
        checks_total += 1
        if kw_pass_rate >= 0.6:
            checks_passed += 1
        details.append({
            "check": "Keyword Coverage",
            "passed": kw_pass_rate >= 0.6,
            "detail": f"{len(keyword_hits)}/{len(keywords)} required keywords found",
            "weight": 50,
        })

    # 2. Experience check
    required_exp = extract_experience_requirement(jd_text)
    exp_match = None
    if required_exp is not None:
        checks_total += 1
        exp_match = check_experience_in_resume(required_exp, resume_text)
        if exp_match:
            checks_passed += 1
        details.append({
            "check": "Experience Requirement",
            "passed": exp_match,
            "detail": f"Required: {required_exp}+ years — {'Detected sufficient experience' if exp_match else 'Could not confirm sufficient experience'}",
            "weight": 30,
        })

    # 3. Education check
    required_edu, edu_match = check_education(jd_text, resume_text)
    if required_edu is not None:
        checks_total += 1
        if edu_match:
            checks_passed += 1
        details.append({
            "check": "Education Requirement",
            "passed": bool(edu_match),
            "detail": f"Required: {required_edu.title()} — {'Found in resume' if edu_match else 'Not clearly stated in resume'}",
            "weight": 20,
        })

    # Calculate ATS score
    if not keywords:
        ats_score = 50  # Can't assess without keywords
    else:
        kw_score = (len(keyword_hits) / max(len(keywords), 1)) * 50
        exp_score = 30 if (exp_match is None or exp_match) else 0
        edu_score = 20 if (edu_match is None or edu_match) else 0
        ats_score = round(kw_score + exp_score + edu_score)

    return ATSResult(
        ats_score=min(100, ats_score),
        keyword_hits=keyword_hits,
        keyword_misses=keyword_misses,
        experience_required=required_exp,
        experience_match=exp_match,
        education_required=required_edu,
        education_match=edu_match,
        checks_passed=checks_passed,
        checks_total=checks_total,
        details=details,
    )
