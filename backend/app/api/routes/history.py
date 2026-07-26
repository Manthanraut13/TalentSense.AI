from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.models.response import HistoryListResponse
from app.services.mongo_service import mongo_service
from app.services.qdrant_service import qdrant_service

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=HistoryListResponse)
async def list_history(
    user_id: str = Depends(get_current_user),
    limit: int = Query(default=10, ge=1, le=50),
    skip: int = Query(default=0, ge=0),
) -> HistoryListResponse:
    return await mongo_service.list_history(user_id=user_id, limit=limit, skip=skip)


@router.get("/{analysis_id}")
async def get_history_item(analysis_id: str, user_id: str = Depends(get_current_user)):
    analysis = await mongo_service.get_analysis(user_id=user_id, analysis_id=analysis_id)
    if analysis is not None:
        return analysis

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Analysis {analysis_id} was not found",
    )


@router.delete("/{analysis_id}")
async def delete_history_item(analysis_id: str, user_id: str = Depends(get_current_user)):
    deletion = await mongo_service.delete_analysis(user_id=user_id, analysis_id=analysis_id)
    qdrant_deleted = await qdrant_service.delete_analysis(vector_id=deletion.qdrant_vector_id)
    return {"deleted": deletion.deleted, "qdrant_deleted": qdrant_deleted}

@router.get("/dashboard/stats")
async def get_dashboard_stats(user_id: str = Depends(get_current_user)):
    # MongoDB aggregation pipeline
    collection = mongo_service._get_collection()
    if collection is None:
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
            "all_missing_skills": {"$push": "$missing_skills"},
            "score_trend": {"$push": {"date": "$timestamp", "score": "$scores.overall", "job_title": "$job_title"}}
        }}
    ]
    result = await collection.aggregate(pipeline).to_list(1)
    if not result:
        return {"total_analyses": 0, "avg_overall": 0, "score_trend": [], "top_missing_skills": []}
    stats = result[0]
    from collections import Counter
    all_skills = [skill for sublist in stats["all_missing_skills"] for skill in sublist]
    top_missing = [{"skill": k, "count": v} for k, v in Counter(all_skills).most_common(8)]
    return {
        "total_analyses": stats["total_analyses"],
        "avg_overall": round(stats["avg_overall"], 1),
        "avg_skills": round(stats["avg_skills"], 1),
        "avg_experience": round(stats["avg_experience"], 1),
        "avg_keywords": round(stats["avg_keywords"], 1),
        "best_score": stats["best_score"],
        "worst_score": stats["worst_score"],
        "score_trend": stats["score_trend"][-20:],
        "top_missing_skills": top_missing,
    }
