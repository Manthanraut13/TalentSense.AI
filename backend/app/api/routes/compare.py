import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import get_current_user
from app.models.request import CompareRequest
from app.services.chain import generate_recommendation, run_comparison
from app.services.rate_limit_service import check_rate_limit, increment_usage
from app.services.sanitizer import sanitize_text, MAX_RESUME_CHARS, MAX_JD_CHARS

router = APIRouter(prefix="/api", tags=["compare"])
logger = logging.getLogger(__name__)


@router.post("/compare")
async def compare_jobs(
    request: Request,
    body: CompareRequest,
    user_id: str = Depends(get_current_user),
):
    """Compare resume against 2-3 job descriptions and get a ranked recommendation."""
    rate_status = await check_rate_limit(user_id, is_pro=False)
    if not rate_status["allowed"]:
        logger.warning("Compare rate limit exceeded: user=%s, used=%s/%s",
                       user_id, rate_status["used"], rate_status["limit"])
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Daily analysis limit reached. Please try again tomorrow.",
                "used": rate_status["used"],
                "limit": rate_status["limit"],
                "resets": "midnight UTC",
            },
        )

    # Sanitize all inputs
    resume_content = sanitize_text(body.resume_text, MAX_RESUME_CHARS, "Resume")
    clean_jds = [
        sanitize_text(jd, MAX_JD_CHARS, f"Job description {i + 1}")
        for i, jd in enumerate(body.job_descriptions)
    ]

    # Run all analyses in parallel
    try:
        results = await run_comparison(resume_content, clean_jds)
    except Exception as exc:
        logger.error("Comparison failed: %s", exc)
        raise HTTPException(503, f"Comparison failed: {str(exc)}") from exc

    # Generate recommendation
    recommendation = generate_recommendation(results)

    # Count each compared JD against the daily limit AFTER success
    try:
        await increment_usage(user_id, count=len(clean_jds))
    except Exception as exc:
        logger.warning("Rate limit increment failed: %s", exc)

    logger.info("Comparison complete: user=%s, compared=%d, recommended_index=%s",
                user_id, len(results), recommendation.get("recommended_index"))

    return {
        "results": results,
        "recommendation": recommendation,
        "total_compared": len(results),
    }
