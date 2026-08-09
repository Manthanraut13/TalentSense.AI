from dataclasses import dataclass, field
import logging
import re
from fastapi import HTTPException, UploadFile, status
from typing import Optional

logger = logging.getLogger(__name__)


MAX_PDF_BYTES = 5 * 1024 * 1024
MIN_RESUME_CHARS = 200

SECTION_PATTERNS = {
    "summary": r"^(summary|profile|professional summary)\s*$",
    "skills": r"^(skills|technical skills|core skills)\s*$",
    "experience": r"^(experience|work experience|professional experience|employment)\s*$",
    "education": r"^(education|academic background)\s*$",
    "projects": r"^(projects|project experience)\s*$",
    "certifications": r"^(certifications|certificates|licenses)\s*$",
}


@dataclass(frozen=True)
class ParsedResume:
    text: str
    sections: dict[str, str] = field(default_factory=dict)
    used_section_fallback: bool = False


def validate_resume_text(resume_text: str) -> ParsedResume:
    cleaned = normalize_text(resume_text)
    if len(cleaned) < MIN_RESUME_CHARS:
        logger.warning("Resume text too short: %d chars (min %d)", len(cleaned), MIN_RESUME_CHARS)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Resume text too short (minimum {MIN_RESUME_CHARS} characters)",
        )

    sections = detect_sections(cleaned)
    fallback = not bool(sections)
    logger.debug("Resume validation: chars=%d, sections=%d, used_fallback=%s",
                  len(cleaned), len(sections), fallback)
    return ParsedResume(
        text=cleaned,
        sections=sections,
        used_section_fallback=fallback,
    )


def validate_job_description(job_description: str) -> str:
    return normalize_text(job_description)


async def parse_pdf_upload(file: UploadFile) -> ParsedResume:
    if file.content_type not in {"application/pdf", "application/x-pdf"}:
        logger.warning("Invalid PDF content type: %s", file.content_type)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF resumes are supported",
        )

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        logger.warning("Invalid PDF filename: %s", file.filename)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume file must use a .pdf extension",
        )

    data = await file.read()
    if len(data) > MAX_PDF_BYTES:
        logger.warning("PDF too large: %d bytes (max %d)", len(data), MAX_PDF_BYTES)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Resume PDF exceeds 5MB limit",
        )

    try:
        import fitz
    except ImportError as exc:
        logger.error("PyMuPDF not installed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF parser dependency is not installed",
        ) from exc

    try:
        with fitz.open(stream=data, filetype="pdf") as document:
            page_text = [page.get_text("text") for page in document]
        combined = "\n".join(page_text)
        logger.debug("PDF parsed: pages=%d, chars=%d", len(page_text), len(combined))
    except Exception as exc:
        logger.warning("PDF parse failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not parse PDF file",
        ) from exc

    return validate_resume_text(combined)


def normalize_text(value: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", value.replace("\r\n", "\n").strip())


def detect_sections(text: str) -> dict[str, str]:
    lines = text.splitlines()
    sections: dict[str, list[str]] = {}
    current_section: str | None = None

    for raw_line in lines:
        line = raw_line.strip()
        matched_section = match_section_header(line)
        if matched_section:
            current_section = matched_section
            sections.setdefault(current_section, [])
            continue

        if current_section and line:
            sections[current_section].append(raw_line)

    return {
        name: normalize_text("\n".join(content))
        for name, content in sections.items()
        if normalize_text("\n".join(content))
    }


def match_section_header(line: str) -> str | None:
    normalized = line.lower().strip(": ")
    for section, pattern in SECTION_PATTERNS.items():
        if re.match(pattern, normalized, flags=re.IGNORECASE):
            return section
    return None


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using PyMuPDF."""
    import fitz
    with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
        page_text = [page.get_text("text") for page in document]
    return "\n".join(page_text)


def format_resume_for_llm(parsed_resume) -> str:
    """Format a ParsedResume object into a formatted text string for LLM processing."""
    parts = []
    if parsed_resume.text:
        parts.append(parsed_resume.text)
    return "\n".join(parts)
