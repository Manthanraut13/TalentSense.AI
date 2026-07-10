from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_session_id
from app.models.response import HistoryListResponse
from app.services.mongo_service import mongo_service
from app.services.qdrant_service import qdrant_service

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=HistoryListResponse)
async def list_history(
    session_id: str = Depends(get_session_id),
    limit: int = Query(default=10, ge=1, le=50),
    skip: int = Query(default=0, ge=0),
) -> HistoryListResponse:
    return await mongo_service.list_history(session_id=session_id, limit=limit, skip=skip)


@router.get("/{analysis_id}")
async def get_history_item(analysis_id: str, session_id: str = Depends(get_session_id)):
    analysis = await mongo_service.get_analysis(session_id=session_id, analysis_id=analysis_id)
    if analysis is not None:
        return analysis

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Analysis {analysis_id} was not found",
    )


@router.delete("/{analysis_id}")
async def delete_history_item(analysis_id: str, session_id: str = Depends(get_session_id)):
    deletion = await mongo_service.delete_analysis(session_id=session_id, analysis_id=analysis_id)
    qdrant_deleted = await qdrant_service.delete_analysis(vector_id=deletion.qdrant_vector_id)
    return {"deleted": deletion.deleted, "qdrant_deleted": qdrant_deleted}
