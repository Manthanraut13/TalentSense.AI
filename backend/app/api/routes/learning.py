import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.api.deps import enforce_rate_limit
from app.services.learning_service import generate_learning_plan
from app.services.rate_limit_service import increment_usage

router = APIRouter(prefix="/api", tags=["learning"])
logger = logging.getLogger(__name__)

MAX_SKILLS_PER_REQUEST = 8
MAX_SKILL_LENGTH = 80


class LearningPlanRequest(BaseModel):
    skills: list[str] = Field(min_length=1)  # List of missing skills from analysis
    job_context: str = ""                    # Optional: JD excerpt for context


@router.post("/learning-plan")
async def get_learning_plan(
    request: Request,
    response: Response,
    body: LearningPlanRequest,
    user_id: str = Depends(enforce_rate_limit),
):
    """Generate learning plans for a list of missing skills."""
    skills = [s.strip()[:MAX_SKILL_LENGTH] for s in body.skills[:MAX_SKILLS_PER_REQUEST] if s.strip()]
    if not skills:
        raise HTTPException(status_code=422, detail="skills list cannot be empty")

    logger.info("Learning plan requested: user=%s, skills=%d, job_context_len=%d",
                user_id, len(skills), len(body.job_context))

    # Generate all plans in parallel
    plans = await asyncio.gather(
        *[generate_learning_plan(skill, body.job_context) for skill in skills],
        return_exceptions=True,
    )

    results = []
    for skill, plan in zip(skills, plans):
        if isinstance(plan, Exception):
            logger.warning("Learning plan generation failed for skill=%s: %s", skill, plan)
            results.append({
                "skill": skill,
                "error": "Could not generate plan",
                "priority": "medium",
                "estimated_weeks": 2,
                "resources": [],
            })
        else:
            results.append(plan)

    # Count each planned skill against the daily limit AFTER success
    try:
        await increment_usage(user_id, count=len(skills))
    except Exception as exc:
        logger.warning("Rate limit increment failed: %s", exc)

    # Rate limit headers
    rate_status = request.state.rate_limit_info
    response.headers["X-RateLimit-Limit"] = str(rate_status["limit"])
    response.headers["X-RateLimit-Remaining"] = str(rate_status["remaining"])
    response.headers["X-RateLimit-Used"] = str(rate_status["used"])

    logger.info("Learning plans generated: user=%s, total=%d", user_id, len(results))

    return {
        "plans": results,
        "total": len(results),
    }
