"""Phase 23 — Share & Viral Loop.

Public share links for analysis results. Sharing is opt-in: analyses are
private by default, and the public endpoint only returns a safe, non-PII
subset of the analysis (blurred fields are handled client-side).
"""

import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.config import settings
from app.services.mongo_service import mongo_service

router = APIRouter(tags=["sharing"])
logger = logging.getLogger(__name__)


@router.post("/analyses/{analysis_id}/share")
async def enable_sharing(
    analysis_id: str,
    user_id: str = Depends(get_current_user),
):
    """Enable public sharing for an analysis. Returns the share slug."""
    collection = mongo_service._get_collection()
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage unavailable",
        )

    document = await collection.find_one({"user_id": user_id, "analysis_id": analysis_id})
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )

    share_slug = document.get("share_slug") or secrets.token_urlsafe(10)
    await collection.update_one(
        {"user_id": user_id, "analysis_id": analysis_id},
        {"$set": {"is_public": True, "share_slug": share_slug}},
    )

    logger.info("Sharing enabled: user=%s, analysis=%s", user_id, analysis_id)
    return {
        "share_slug": share_slug,
        "share_url": f"{settings.app_url.rstrip('/')}/share/{share_slug}",
    }


@router.delete("/analyses/{analysis_id}/share")
async def disable_sharing(
    analysis_id: str,
    user_id: str = Depends(get_current_user),
):
    """Disable public sharing for an analysis."""
    collection = mongo_service._get_collection()
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage unavailable",
        )

    await collection.update_one(
        {"user_id": user_id, "analysis_id": analysis_id},
        {"$set": {"is_public": False}},
    )
    logger.info("Sharing disabled: user=%s, analysis=%s", user_id, analysis_id)
    return {"sharing_disabled": True}


@router.get("/share/{slug}")
async def get_public_analysis(slug: str):
    """Public endpoint — NO AUTH REQUIRED.

    Returns a safe subset of the analysis for the share page. Blurred fields
    are omitted entirely; the frontend renders the blur-to-signup overlay.
    """
    collection = mongo_service._get_collection()
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage unavailable",
        )

    document = await collection.find_one({"share_slug": slug, "is_public": True})
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared analysis not found or sharing has been disabled",
        )

    scores = document.get("scores", {})
    strengths = document.get("strengths", [])
    return {
        "job_title": document.get("job_title", "Untitled job"),
        "timestamp": document.get("timestamp"),
        "scores": {
            "overall": scores.get("overall"),
            "skills_match": scores.get("skills_match"),
            "experience_relevance": scores.get("experience_relevance"),
            "keyword_coverage": scores.get("keyword_coverage"),
        },
        "missing_skills_count": len(document.get("missing_skills", [])),
        "ats_keywords_count": len(document.get("ats_keywords", [])),
        "strengths_count": len(strengths),
        "improvement_tips_count": len(document.get("improvement_tips", [])),
        "strength_preview": strengths[0] if strengths else "",
    }
