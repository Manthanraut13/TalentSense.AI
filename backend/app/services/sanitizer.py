import logging
import re
import bleach
import magic
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Character limits
MAX_RESUME_CHARS = 8_000
MAX_JD_CHARS = 4_000
MAX_PDF_SIZE_MB = 5
MAX_PDF_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024

# Prompt injection patterns.
# Kept deliberately narrow: job descriptions are web content and legitimately
# contain phrases like "act as a subject matter expert" or "you are now part of
# the team". Only clearly instruction-targeted phrasings are blocked.
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|above|prior)\s+instructions",
    r"disregard\s+(all\s+)?(previous|above|prior)\s+instructions",
    r"you\s+are\s+now\s+a(?:n)?\s+(?:different\s+)?(?:ai|assistant|chatbot|gpt|model|robot|system)\b",
    r"from\s+now\s+on[^\n]{0,60}\b(?:act\s+as|you\s+are)\b",
    r"act\s+as\s+if\b",
    r"pretend\s+you\s+are\b",
    r"new\s+instructions?\s*:",
    r"system\s*prompt",
    r"jailbreak",
    r"dan\s+mode",
    r"<\s*script",
    r"javascript\s*:",
]

def sanitize_text(text: str, max_chars: int, field_name: str = "Input") -> str:
    """Clean and validate user-provided text. Raises HTTPException 400 if injection detected."""
    logger.info("Sanitize: field=%s, input_len=%d", field_name, len(text) if text else 0)

    if not text or not text.strip():
        logger.warning("Sanitize: %s is empty or whitespace only", field_name)
        raise HTTPException(status_code=422, detail=f"{field_name} cannot be empty")

    # 1. Strip HTML tags
    original_len = len(text)
    text = bleach.clean(text, tags=[], strip=True)
    if len(text) != original_len:
        logger.info("Sanitize: HTML stripped, len %d -> %d", original_len, len(text))

    # 2. Truncate to max length
    if len(text) > max_chars:
        logger.info("Sanitize: truncating from %d to %d", len(text), max_chars)
        text = text[:max_chars]

    # 3. Check for prompt injection
    text_lower = text.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE):
            logger.warning("Sanitize: Injection pattern matched: %s in field=%s", pattern, field_name)
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{field_name} contains content that cannot be processed. "
                    "Please paste plain resume or job description text only."
                )
            )

    logger.info("Sanitize: final_len=%d", len(text))
    return text.strip()


def validate_pdf_bytes(pdf_bytes: bytes, filename: str = "file") -> None:
    """Validate that uploaded bytes are actually a PDF and within size limits."""
    if len(pdf_bytes) > MAX_PDF_BYTES:
        logger.warning("PDF size exceeded: filename=%s, size=%d, max=%d",
                        filename, len(pdf_bytes), MAX_PDF_BYTES)
        raise HTTPException(
            status_code=400,
            detail=f"PDF file too large. Maximum size is {MAX_PDF_SIZE_MB}MB."
        )

    mime = magic.from_buffer(pdf_bytes, mime=True)
    if mime != "application/pdf":
        logger.warning("Invalid PDF MIME type: filename=%s, mime=%s", filename, mime)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {mime}. Only PDF files are accepted."
        )

    if not pdf_bytes.startswith(b"%PDF"):
        logger.warning("Missing PDF magic bytes: filename=%s", filename)
        raise HTTPException(
            status_code=400,
            detail="File does not appear to be a valid PDF."
        )

    logger.debug("PDF validated: filename=%s, size=%d", filename, len(pdf_bytes))
