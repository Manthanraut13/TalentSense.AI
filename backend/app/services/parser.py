from dataclasses import dataclass, field
import re
from fastapi import HTTPException, UploadFile, status
from typing import Optional


MAX_PDF_BYTES = 5 * 1024 * 1024
MIN_RESUME_CHARS = 200
MIN_JD_CHARS = 100

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
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Resume text too short (minimum {MIN_RESUME_CHARS} characters)",
        )

    sections = detect_sections(cleaned)
    return ParsedResume(
        text=cleaned,
        sections=sections,
        used_section_fallback=not bool(sections),
    )


def validate_job_description(job_description: str) -> str:
    cleaned = normalize_text(job_description)
    if len(cleaned) < MIN_JD_CHARS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Job description too short (minimum {MIN_JD_CHARS} characters)",
        )
    return cleaned


async def parse_pdf_upload(file: UploadFile) -> ParsedResume:
    if file.content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF resumes are supported",
        )

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume file must use a .pdf extension",
        )

    data = await file.read()
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Resume PDF exceeds 5MB limit",
        )

    try:
        import fitz
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF parser dependency is not installed",
        ) from exc

    try:
        with fitz.open(stream=data, filetype="pdf") as document:
            page_text = [page.get_text("text") for page in document]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not parse PDF file",
        ) from exc

    return validate_resume_text("\n".join(page_text))


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
