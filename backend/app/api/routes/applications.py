import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.services.application_service import (
    APPLICATION_STATUSES,
    create_application,
    delete_application,
    get_applications,
    update_application,
    update_application_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["applications"])


class CreateApplicationRequest(BaseModel):
    company: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=100)
    job_url: str = ""
    status: str = "saved"
    analysis_id: str | None = None
    match_score: int | None = None
    notes: str = ""
    applied_date: str | None = None


class UpdateStatusRequest(BaseModel):
    status: str
    notes: str | None = None


class UpdateApplicationRequest(BaseModel):
    company: str | None = None
    role: str | None = None
    job_url: str | None = None
    notes: str | None = None
    applied_date: str | None = None


@router.get("/applications")
async def list_applications(user_id: str = Depends(get_current_user)) -> list[dict]:
    return await get_applications(user_id)


@router.post("/applications", status_code=201)
async def add_application(
    body: CreateApplicationRequest,
    user_id: str = Depends(get_current_user),
) -> dict:
    created = await create_application(user_id, body.model_dump())
    if created is None:
        raise HTTPException(status_code=503, detail="Tracker storage is unavailable")
    return created


@router.patch("/applications/{application_id}/status")
async def change_status(
    application_id: str,
    body: UpdateStatusRequest,
    user_id: str = Depends(get_current_user),
) -> dict:
    if body.status not in APPLICATION_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")
    updated = await update_application_status(
        application_id, user_id, body.status, body.notes
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return updated


@router.patch("/applications/{application_id}")
async def edit_application(
    application_id: str,
    body: UpdateApplicationRequest,
    user_id: str = Depends(get_current_user),
) -> dict:
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = await update_application(application_id, user_id, payload)
    if updated is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return updated


@router.delete("/applications/{application_id}")
async def remove_application(
    application_id: str,
    user_id: str = Depends(get_current_user),
) -> dict:
    deleted = await delete_application(application_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"deleted": True}
