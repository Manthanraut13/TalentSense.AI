import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from app.api.deps import get_current_user
from app.services.resume_service import (
    save_resume, get_resumes, get_resume_by_id, delete_resume
)
from app.services.parser import ParsedResume, extract_text_from_pdf, format_resume_for_llm
from app.services.sanitizer import sanitize_text, validate_pdf_bytes, MAX_RESUME_CHARS
from app.services.user_service import get_user_plan

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/resumes")
async def list_resumes(user_id: str = Depends(get_current_user)):
    logger.info("Listing resumes for user=%s", user_id)
    resumes = await get_resumes(user_id)
    logger.debug("Resume list: user=%s, count=%d", user_id, len(resumes))
    return resumes

@router.post("/resumes")
async def create_resume(
    name: str = Form(...),
    input_mode: str = Form(...),
    resume_text: str | None = Form(None),
    resume_file: UploadFile | None = File(None),
    user_id: str = Depends(get_current_user),
):
    logger.info("Resume create: user=%s, name=%s, input_mode=%s", user_id, name, input_mode)

    if input_mode == "pdf":
        if not resume_file:
            raise HTTPException(400, "PDF file required")
        pdf_bytes = await resume_file.read()
        validate_pdf_bytes(pdf_bytes)
        sections = extract_text_from_pdf(pdf_bytes)
        content = format_resume_for_llm(ParsedResume(text=sections))
        logger.debug("Resume PDF parsed: filename=%s, chars=%d", resume_file.filename, len(content))
    else:
        if not resume_text:
            raise HTTPException(422, "Resume text required")
        content = resume_text

    content = sanitize_text(content, MAX_RESUME_CHARS, "Resume")

    try:
        saved = await save_resume(user_id, name.strip(), content, is_pro=True)
        logger.info("Resume saved: user=%s, resume_id=%s", user_id, saved.get("resume_id"))
        return saved
    except ValueError as e:
        logger.warning("Resume save failed: user=%s, error=%s", user_id, e)
        raise HTTPException(400, str(e))

@router.get("/resumes/{resume_id}")
async def get_resume(resume_id: str, user_id: str = Depends(get_current_user)):
    logger.info("Fetching resume: user=%s, resume_id=%s", user_id, resume_id)
    doc = await get_resume_by_id(resume_id, user_id)
    if not doc:
        logger.warning("Resume not found: user=%s, resume_id=%s", user_id, resume_id)
        raise HTTPException(404, "Resume not found")
    return doc

@router.delete("/resumes/{resume_id}")
async def remove_resume(resume_id: str, user_id: str = Depends(get_current_user)):
    logger.info("Deleting resume: user=%s, resume_id=%s", user_id, resume_id)
    deleted = await delete_resume(resume_id, user_id)
    if not deleted:
        logger.warning("Resume not found for deletion: user=%s, resume_id=%s", user_id, resume_id)
        raise HTTPException(404, "Resume not found")
    logger.info("Resume deleted: user=%s, resume_id=%s", user_id, resume_id)
    return {"deleted": True}
