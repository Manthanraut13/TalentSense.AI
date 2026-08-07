import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models.request import CompareRequest
from app.services.chain import generate_recommendation, run_comparison
from app.services.sanitizer import sanitize_text, MAX_RESUME_CHARS, MAX_JD_CHARS

router = APIRouter(tags=["compare"])
logger = logging.getLogger(__name__)


@router.post("/compare")
async def compare_jobs(
    body: CompareRequest,
    user_id: str = Depends(get_current_user),
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

    logger.info("Comparison complete: user=%s, compared=%d, recommended_index=%s",
                user_id, len(results), recommendation.get("recommended_index"))

    return {
        "results": results,
        "recommendation": recommendation,
        "total_compared": len(results),
    }
