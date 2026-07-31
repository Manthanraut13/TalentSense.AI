from datetime import datetime

from pydantic import BaseModel, Field


class Scores(BaseModel):
    overall: int = Field(ge=0, le=100)
    skills_match: int = Field(ge=0, le=100)
    experience_relevance: int = Field(ge=0, le=100)
    keyword_coverage: int = Field(ge=0, le=100)


class AIAnalysisPayload(BaseModel):
    job_title: str = Field(min_length=1)
    scores: Scores
    missing_skills: list[str] = Field(min_length=0)
    ats_keywords: list[str] = Field(min_length=0)
    strengths: list[str] = Field(min_length=0)
    improvement_tips: list[str] = Field(min_length=0)
    context_note: str | None = None


class AnalysisResult(BaseModel):
    analysis_id: str
    job_title: str
    timestamp: datetime
    scores: Scores
    missing_skills: list[str]
    ats_keywords: list[str]
    strengths: list[str]
    improvement_tips: list[str]
    context_note: str | None = None
    # ATS Simulator fields (rules-based, not AI)
    ats_score: int | None = None
    ats_keyword_hits: list[str] = []
    ats_keyword_misses: list[str] = []
    ats_checks: list[dict] = []
    ats_checks_passed: int = 0
    ats_checks_total: int = 0


class HistoryItem(BaseModel):
    analysis_id: str
    job_title: str
    timestamp: datetime
    scores: Scores


class HistoryListResponse(BaseModel):
    analyses: list[HistoryItem]
    total: int
