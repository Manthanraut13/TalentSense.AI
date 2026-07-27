from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from app.api.deps import get_current_user
from app.services.resume_service import (
    save_resume, get_resumes, get_resume_by_id, delete_resume
)
from app.services.parser import extract_text_from_pdf, format_resume_for_llm
from app.services.sanitizer import sanitize_text, validate_pdf_bytes, MAX_RESUME_CHARS
from app.services.user_service import get_user_plan

router = APIRouter()

@router.get("/resumes")
async def list_resumes(user_id: str = Depends(get_current_user)):
    return await get_resumes(user_id)

@router.post("/resumes")
async def create_resume(
    name: str = Form(...),
    input_mode: str = Form(...),   # "text" | "pdf"
    resume_text: str | None = Form(None),
    resume_file: UploadFile | None = File(None),
    user_id: str = Depends(get_current_user),
):
    plan = await get_user_plan(user_id)
    is_pro = plan == "pro"

    # Parse content
    if input_mode == "pdf":
        if not resume_file:
            raise HTTPException(400, "PDF file required")
        pdf_bytes = await resume_file.read()
        validate_pdf_bytes(pdf_bytes)
        sections = extract_text_from_pdf(pdf_bytes)
        content = format_resume_for_llm(sections)
    else:
        if not resume_text:
            raise HTTPException(422, "Resume text required")
        content = resume_text

    content = sanitize_text(content, MAX_RESUME_CHARS, "Resume")

    try:
        saved = await save_resume(user_id, name.strip(), content, is_pro)
        return saved
    except ValueError as e:
        raise HTTPException(400, str(e))

@router.get("/resumes/{resume_id}")
async def get_resume(resume_id: str, user_id: str = Depends(get_current_user)):
    doc = await get_resume_by_id(resume_id, user_id)
    if not doc:
        raise HTTPException(404, "Resume not found")
    return doc

@router.delete("/resumes/{resume_id}")
async def remove_resume(resume_id: str, user_id: str = Depends(get_current_user)):
    deleted = await delete_resume(resume_id, user_id)
    if not deleted:
        raise HTTPException(404, "Resume not found")
    return {"deleted": True}
