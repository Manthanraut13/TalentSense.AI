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
