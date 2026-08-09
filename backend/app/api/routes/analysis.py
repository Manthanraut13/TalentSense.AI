import asyncio
from dataclasses import replace
from datetime import datetime, timezone
import logging
from uuid import uuid4

import sentry_sdk
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, status, UploadFile

from app.api.deps import enforce_rate_limit, get_current_user
from app.models.response import AnalysisResult
from app.services.ats_simulator import ATSResult, run_ats_simulation
from app.services.chain import AnalysisServiceUnavailable, analyze as analyze_fn
from app.services.mongo_service import mongo_service
from app.services.parser import parse_pdf_upload, validate_resume_text
from app.services.qdrant_service import qdrant_service
from app.services.rate_limit_service import check_rate_limit, increment_usage
from app.services.sanitizer import sanitize_text, validate_pdf_bytes, MAX_RESUME_CHARS, MAX_JD_CHARS
from app.services.training_data_service import log_training_signal


router = APIRouter(tags=["analysis"])
logger = logging.getLogger(__name__)

_EMPTY_ATS_RESULT = ATSResult(
    ats_score=0,
    keyword_hits=[],
    keyword_misses=[],
    experience_required=None,
    experience_match=None,
    education_required=None,
    education_match=None,
    checks_passed=0,
    checks_total=0,
    details=[],
)


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_resume(
    request: Request,
    response: Response,
    user_id: str = Depends(enforce_rate_limit),
    input_mode: str = Form(...),
    job_description: str = Form(...),
    resume_text: str | None = Form(default=None),
    resume_file: UploadFile | None = File(default=None),
) -> AnalysisResult:
    sentry_sdk.set_user({"id": user_id})

    logger.info("Analysis started: input_mode=%s, jd_len=%d, has_resume_text=%s, has_resume_file=%s",
                 input_mode, len(job_description), resume_text is not None, resume_file is not None)

    # Sanitize job description
    original_jd = job_description
    job_description = sanitize_text(job_description, MAX_JD_CHARS, "Job description")

    logger.info("JD sanitized: original_len=%d, sanitized_len=%d", len(original_jd), len(job_description))

    if input_mode == "text":
        if not resume_text:
            logger.warning("Analysis aborted: resume_text missing for text mode")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Resume text is required for text input mode",
            )
        resume_text = sanitize_text(resume_text, MAX_RESUME_CHARS, "Resume")
        if len(resume_text) < 200:
            logger.warning("Analysis aborted: resume_text too short after sanitization (%d chars)", len(resume_text))
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Resume text is too short after sanitization (minimum 200 characters)",
            )
        parsed_resume = validate_resume_text(resume_text)
    elif input_mode == "pdf":
        if resume_file is None:
            logger.warning("Analysis aborted: resume_file missing for pdf mode")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Resume PDF is required for pdf input mode",
            )
        pdf_bytes = await resume_file.read()
        validate_pdf_bytes(pdf_bytes, resume_file.filename or "resume.pdf")
        await resume_file.seek(0)
        logger.info("PDF validated: filename=%s, size=%d", resume_file.filename, len(pdf_bytes))
        parsed_resume = await parse_pdf_upload(resume_file)
        resume_text = sanitize_text(parsed_resume.text, MAX_RESUME_CHARS, "Resume")
        if len(resume_text) < 200:
            logger.warning("Analysis aborted: PDF resume too short after processing (%d chars)", len(resume_text))
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Resume is too short after processing (minimum 200 characters)",
            )
        parsed_resume = replace(parsed_resume, text=resume_text)
    else:
        logger.warning("Analysis aborted: invalid input_mode=%s", input_mode)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail='input_mode must be either "text" or "pdf"',
        )

    ats_task = asyncio.create_task(
        asyncio.to_thread(run_ats_simulation, parsed_resume.text, job_description)
    )

    try:
        logger.info("Retrieving Qdrant context for user=%s", user_id)
        past_context = await qdrant_service.retrieve_context(
            user_id=user_id,
            job_description=job_description,
        )

        logger.info("Calling Groq analysis LLM")
        ai_result = await analyze_fn(
            parsed_resume=parsed_resume,
            job_description=job_description,
            past_context=past_context,
        )
    except AnalysisServiceUnavailable as exc:
        ats_task.cancel()
        logger.error("Analysis failed: service unavailable — %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except Exception:
        ats_task.cancel()
        raise

    try:
        ats_result = await ats_task
    except Exception as exc:
        logger.warning("ATS simulation failed: %s", exc)
        ats_result = _EMPTY_ATS_RESULT

    result = AnalysisResult(
        analysis_id=str(uuid4()),
        job_title=ai_result.job_title,
        timestamp=datetime.now(timezone.utc),
        scores=ai_result.scores,
        missing_skills=ai_result.missing_skills,
        ats_keywords=ai_result.ats_keywords,
        strengths=ai_result.strengths,
        improvement_tips=ai_result.improvement_tips,
        context_note=ai_result.context_note or f"User {user_id} analyzed without prior context.",
        ats_score=ats_result.ats_score,
        ats_keyword_hits=ats_result.keyword_hits,
        ats_keyword_misses=ats_result.keyword_misses,
        ats_checks=ats_result.details,
        ats_checks_passed=ats_result.checks_passed,
        ats_checks_total=ats_result.checks_total,
    )

    logger.info("LLM analysis complete: title=%s, overall_score=%d", result.job_title, result.scores.overall)

    qdrant_vector_id = await qdrant_service.upsert_analysis(
        user_id=user_id,
        result=result,
        parsed_resume=parsed_resume,
    )

    try:
        await mongo_service.save_analysis(
            user_id=user_id,
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

    # Log an anonymized training signal for future embedding fine-tuning.
    # Never breaks the response if the log fails.
    try:
        await log_training_signal(
            user_id=user_id,
            resume_text=parsed_resume.text,
            jd_text=job_description,
            score=result.scores.overall,
        )
    except Exception as exc:
        logger.warning("Training signal logging failed: %s", exc)

    # Count the analysis against the daily limit AFTER success
    try:
        await increment_usage(user_id)
    except Exception as exc:
        logger.warning("Rate limit increment failed: %s", exc)

    # Rate limit headers
    rate_status = request.state.rate_limit_info
    response.headers["X-RateLimit-Limit"] = str(rate_status["limit"])
    response.headers["X-RateLimit-Remaining"] = str(rate_status["remaining"])
    response.headers["X-RateLimit-Used"] = str(rate_status["used"])

    logger.info("Analysis complete: analysis_id=%s, job_title=%s, score=%d",
                 result.analysis_id, result.job_title, result.scores.overall)
    return result


@router.get("/usage")
async def get_usage_status(user_id: str = Depends(get_current_user)):
    rate_status = await check_rate_limit(user_id)
    logger.debug("Usage check for user=%s: %s", user_id, rate_status)
    return {
        "used": rate_status["used"],
        "limit": rate_status["limit"],
        "remaining": rate_status["remaining"],
        "is_pro": False,
    }
