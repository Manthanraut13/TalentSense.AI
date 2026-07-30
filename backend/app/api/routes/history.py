import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user
from app.models.response import HistoryListResponse
from app.services.mongo_service import mongo_service
from app.services.qdrant_service import qdrant_service
from app.services.pdf_export import generate_analysis_pdf
import io

router = APIRouter(prefix="/history", tags=["history"])
logger = logging.getLogger(__name__)


@router.get("", response_model=HistoryListResponse)
async def list_history(
    user_id: str = Depends(get_current_user),
    limit: int = Query(default=10, ge=1, le=50),
    skip: int = Query(default=0, ge=0),
) -> HistoryListResponse:
    logger.info("Listing history: user=%s, limit=%d, skip=%d", user_id, limit, skip)
    result = await mongo_service.list_history(user_id=user_id, limit=limit, skip=skip)
    logger.debug("History list result: total=%d, returned=%d", result.total, len(result.analyses))
    return result


@router.get("/{analysis_id}")
async def get_history_item(analysis_id: str, user_id: str = Depends(get_current_user)):
    logger.info("Fetching analysis: user=%s, analysis_id=%s", user_id, analysis_id)
    analysis = await mongo_service.get_analysis(user_id=user_id, analysis_id=analysis_id)
    if analysis is not None:
        return analysis

    logger.warning("Analysis not found: user=%s, analysis_id=%s", user_id, analysis_id)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Analysis {analysis_id} was not found",
    )


@router.delete("/{analysis_id}")
async def delete_history_item(analysis_id: str, user_id: str = Depends(get_current_user)):
    logger.info("Deleting analysis: user=%s, analysis_id=%s", user_id, analysis_id)
    deletion = await mongo_service.delete_analysis(user_id=user_id, analysis_id=analysis_id)
    qdrant_deleted = await qdrant_service.delete_analysis(vector_id=deletion.qdrant_vector_id)
    logger.info("Delete result: mongo=%s, qdrant=%s", deletion.deleted, qdrant_deleted)
    return {"deleted": deletion.deleted, "qdrant_deleted": qdrant_deleted}

@router.get("/dashboard/stats")
async def get_dashboard_stats(user_id: str = Depends(get_current_user)):
    logger.info("Dashboard stats requested for user=%s", user_id)
    collection = mongo_service._get_collection()
    if collection is None:
        logger.warning("Dashboard stats: MongoDB not available")
        return {"total_analyses": 0, "score_trend": [], "top_missing_skills": []}
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$sort": {"timestamp": 1}},
        {"$group": {
            "_id": None,
            "total_analyses": {"$sum": 1},
            "avg_overall": {"$avg": "$scores.overall"},
            "avg_skills": {"$avg": "$scores.skills_match"},
            "avg_experience": {"$avg": "$scores.experience_relevance"},
            "avg_keywords": {"$avg": "$scores.keyword_coverage"},
            "best_score": {"$max": "$scores.overall"},
            "worst_score": {"$min": "$scores.overall"},
            "all_docs": {"$push": {
                "timestamp": "$timestamp",
                "job_title": "$job_title",
                "score": "$scores.overall",
                "missing_skills": "$missing_skills",
            }},
        }}
    ]

    stats = await collection.aggregate(pipeline).to_list()
    if not stats:
        logger.info("Dashboard stats: no analyses found for user=%s", user_id)
        return {"total_analyses": 0, "score_trend": [], "top_missing_skills": []}

    doc = stats[0]

    score_trend = [
        {
            "date": d["timestamp"][:10],
            "score": d["score"],
            "job_title": d["job_title"],
        }
        for d in doc["all_docs"]
    ]

    from collections import Counter
    all_missing = []
    for d in doc["all_docs"]:
        all_missing.extend(d.get("missing_skills") or [])
    top_missing_skills = [
        {"skill": skill, "count": count}
        for skill, count in Counter(all_missing).most_common(10)
    ]

    logger.info("Dashboard stats computed: total=%d, top_skills=%d",
                 doc["total_analyses"], len(top_missing_skills))

    return {
        "total_analyses": doc["total_analyses"],
        "avg_overall": round(doc["avg_overall"]),
        "avg_skills": round(doc["avg_skills"]),
        "avg_experience": round(doc["avg_experience"]),
        "avg_keywords": round(doc["avg_keywords"]),
        "best_score": doc["best_score"],
        "worst_score": doc["worst_score"],
        "score_trend": score_trend,
        "top_missing_skills": top_missing_skills,
    }

@router.get("/{analysis_id}/export-pdf")
async def export_analysis_pdf(
    analysis_id: str,
    user_id: str = Depends(get_current_user),
):
    """Generate and return a PDF export of the analysis."""
    logger.info("PDF export requested: user=%s, analysis_id=%s", user_id, analysis_id)
    doc = await mongo_service.get_analysis(user_id=user_id, analysis_id=analysis_id)
    if not doc:
        logger.warning("PDF export: analysis not found for user=%s, analysis_id=%s", user_id, analysis_id)
        raise HTTPException(404, "Analysis not found")

    pdf_bytes = generate_analysis_pdf(doc)

    safe_title = doc["job_title"].replace(" ", "_").replace("/", "-")[:30]
    filename = f"analysis_{safe_title}_{analysis_id[:8]}.pdf"

    logger.info("PDF export generated: filename=%s, size=%d", filename, len(pdf_bytes))

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
