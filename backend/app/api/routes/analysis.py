from datetime import datetime, timezone
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status

from app.api.deps import get_session_id
from app.core.config import settings
from app.models.response import AnalysisResult
from app.services.chain import AnalysisServiceUnavailable, analyze as analyze_fn
from app.services.mongo_service import mongo_service
from app.services.parser import parse_pdf_upload, validate_job_description, validate_resume_text
from app.services.qdrant_service import qdrant_service
from app.services.rate_limiter import check_limit, get_headers


router = APIRouter(tags=["analysis"])
logger = logging.getLogger(__name__)


async def check_rate_limit(request: Request, session_id: str = Depends(get_session_id)) -> str:
    """Rate limit by session ID."""
    allowed, remaining, retry_after = check_limit(session_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Try again after {retry_after} seconds.",
            headers={
                "X-RateLimit-Limit": str(settings.rate_limit_requests),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Window": str(settings.rate_limit_window_seconds),
                "Retry-After": str(retry_after),
            },
        )
    # Add rate limit headers to response
    request.state.rate_limit_headers = get_headers(session_id, True, remaining, 0)
    return session_id

@router.post("/analyze", response_model=AnalysisResult)
async def analyze_resume(
    request: Request,
    response: Response,
    session_id: str = Depends(check_rate_limit),
    input_mode: str = Form(...),
    job_description: str = Form(...),
    resume_text: str | None = Form(default=None),
    resume_file: UploadFile | None = File(default=None),
) -> AnalysisResult:
    validated_job_description = validate_job_description(job_description)

    if input_mode == "text":
        if not resume_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Resume text is required for text input mode",
            )
        parsed_resume = validate_resume_text(resume_text)
    elif input_mode == "pdf":
        if resume_file is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Resume PDF is required for pdf input mode",
            )
        parsed_resume = await parse_pdf_upload(resume_file)
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='input_mode must be either "text" or "pdf"',
        )

    try:
        past_context = await qdrant_service.retrieve_context(
            session_id=session_id,
            job_description=validated_job_description,
        )
        ai_result = await analyze_fn(
            parsed_resume=parsed_resume,
            job_description=validated_job_description,
            past_context=past_context,
        )
    except AnalysisServiceUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    result = AnalysisResult(
        analysis_id=str(uuid4()),
        job_title=ai_result.job_title,
        timestamp=datetime.now(timezone.utc),
        scores=ai_result.scores,
        missing_skills=ai_result.missing_skills,
        ats_keywords=ai_result.ats_keywords,
        strengths=ai_result.strengths,
        improvement_tips=ai_result.improvement_tips,
        context_note=ai_result.context_note or f"Session {session_id} analyzed without prior context.",
    )

    qdrant_vector_id = await qdrant_service.upsert_analysis(
        session_id=session_id,
        result=result,
        parsed_resume=parsed_resume,
    )

    try:
        await mongo_service.save_analysis(
            session_id=session_id,
            result=result,
            resume_text=parsed_resume.text,
            qdrant_vector_id=qdrant_vector_id,
        )
    except Exception as exc:
        logger.warning("MongoDB analysis save failed: %s", exc)
        if result.context_note:
            result.context_note = f"{result.context_note} History was not saved."
        else:
            result.context_note = "History was not saved."

    # Add rate limit headers to response
    if hasattr(request.state, "rate_limit_headers"):
        for header, value in request.state.rate_limit_headers.items():
            response.headers[header] = value

    return result