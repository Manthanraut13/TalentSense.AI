import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.deps import enforce_rate_limit
from app.models.request import CompareRequest
from app.services.chain import generate_recommendation, run_comparison
from app.services.rate_limit_service import increment_usage
from app.services.sanitizer import sanitize_text, MAX_RESUME_CHARS, MAX_JD_CHARS

router = APIRouter(prefix="/api", tags=["compare"])
logger = logging.getLogger(__name__)


@router.post("/compare")
async def compare_jobs(
    request: Request,
    response: Response,
    body: CompareRequest,
    user_id: str = Depends(enforce_rate_limit),
):
    """Compare resume against 2-3 job descriptions and get a ranked recommendation."""
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
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Comparison failed: {str(exc)}",
        ) from exc

    # Generate recommendation
    recommendation = generate_recommendation(results)

    # Count each compared JD against the daily limit AFTER success
    try:
        await increment_usage(user_id, count=len(clean_jds))
    except Exception as exc:
        logger.warning("Rate limit increment failed: %s", exc)

    # Rate limit headers
    rate_status = request.state.rate_limit_info
    response.headers["X-RateLimit-Limit"] = str(rate_status["limit"])
    response.headers["X-RateLimit-Remaining"] = str(rate_status["remaining"])
    response.headers["X-RateLimit-Used"] = str(rate_status["used"])

    logger.info("Comparison complete: user=%s, compared=%d, recommended_index=%s",
                user_id, len(results), recommendation.get("recommended_index"))

    return {
        "results": results,
        "recommendation": recommendation,
        "total_compared": len(results),
    }
