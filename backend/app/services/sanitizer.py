import re
import bleach
import magic
from fastapi import HTTPException

# Character limits
MAX_RESUME_CHARS = 8_000
MAX_JD_CHARS = 4_000
MAX_PDF_SIZE_MB = 5
MAX_PDF_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024

# Prompt injection patterns
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|above|prior)\s+instructions",
    r"disregard\s+(all\s+)?(previous|above|prior)\s+instructions",
    r"you\s+are\s+now\s+(a|an)",
    r"act\s+as\s+(a|an|if)",
    r"pretend\s+(you\s+are|to\s+be)",
    r"new\s+instructions?\s*:",
    r"system\s*prompt",
    r"your\s+(real|true|actual)\s+(purpose|goal|task)",
    r"jailbreak",
    r"dan\s+mode",
    r"<\s*script",
    r"javascript\s*:",
]

def sanitize_text(text: str, max_chars: int, field_name: str = "Input") -> str:
    """Clean and validate user-provided text. Raises HTTPException 400 if injection detected."""
    if not text or not text.strip():
        raise HTTPException(status_code=422, detail=f"{field_name} cannot be empty")

    # 1. Strip HTML tags
    text = bleach.clean(text, tags=[], strip=True)

    # 2. Truncate to max length
    if len(text) > max_chars:
        text = text[:max_chars]

    # 3. Check for prompt injection
    text_lower = text.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{field_name} contains content that cannot be processed. "
                    "Please paste plain resume or job description text only."
                )
            )

    return text.strip()


def validate_pdf_bytes(pdf_bytes: bytes, filename: str = "file") -> None:
    """Validate that uploaded bytes are actually a PDF and within size limits."""
    # 1. Check file size
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"PDF file too large. Maximum size is {MAX_PDF_SIZE_MB}MB."
        )

    # 2. Check MIME type using libmagic
    mime = magic.from_buffer(pdf_bytes, mime=True)
    if mime != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {mime}. Only PDF files are accepted."
        )

    # 3. Check PDF magic bytes header
    if not pdf_bytes.startswith(b"%PDF"):
        raise HTTPException(
            status_code=400,
            detail="File does not appear to be a valid PDF."
        )
