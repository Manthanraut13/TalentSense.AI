import pytest

from app.services.parser import (
    ParsedResume,
    detect_sections,
    extract_text_from_pdf,
    format_resume_for_llm,
    match_section_header,
    normalize_text,
    validate_resume_text,
)


def test_extract_text_from_generated_pdf():
    """A real PDF produced by PyMuPDF extracts to its text content."""
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Python FastAPI Developer")
    pdf_bytes = doc.tobytes()
    doc.close()

    result = extract_text_from_pdf(pdf_bytes)
    assert "Python" in result
    assert "FastAPI" in result


def test_extract_text_from_invalid_pdf():
    """Non-PDF bytes raise instead of returning garbage."""
    import fitz

    with pytest.raises(fitz.FileDataError):
        extract_text_from_pdf(b"not a pdf at all")


def test_normalize_text_collapses_excess_newlines():
    text = "Line one\r\n\r\n\r\nLine two"
    assert normalize_text(text) == "Line one\n\nLine two"


def test_section_detection_finds_skills_and_experience():
    text = """
    John Doe
    SKILLS
    Python, FastAPI, Docker
    EXPERIENCE
    Software Engineer 2020-2024
    """
    sections = detect_sections(text)
    assert "skills" in sections
    assert "experience" in sections
    assert "Python" in sections["skills"]


def test_section_detection_fallback_for_unstructured_text():
    text = "Just some plain text without any section headers at all"
    assert detect_sections(text) == {}


def test_match_section_header_variants():
    assert match_section_header("Technical Skills") == "skills"
    assert match_section_header("WORK EXPERIENCE") == "experience"
    assert match_section_header("Academic Background") == "education"
    assert match_section_header("Random heading") is None


def test_validate_resume_text_rejects_short_text():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        validate_resume_text("too short")
    assert exc_info.value.status_code == 422


def test_validate_resume_text_builds_parsed_resume():
    text = (
        "SUMMARY\nSenior engineer.\n"
        "SKILLS\nPython, FastAPI, Docker.\n"
        "EXPERIENCE\nBuilt REST APIs at Acme 2019-2024 and led a small team. "
        "Shipped several services and maintained the database layer. "
        "Wrote tests and worked with containers in production. "
    )
    parsed = validate_resume_text(text)
    assert isinstance(parsed, ParsedResume)
    assert parsed.text == text.strip()
    assert "skills" in parsed.sections
    assert parsed.used_section_fallback is False


def test_format_resume_for_llm_returns_text():
    parsed = ParsedResume(text="Python, FastAPI", sections={})
    output = format_resume_for_llm(parsed)
    assert output == "Python, FastAPI"
