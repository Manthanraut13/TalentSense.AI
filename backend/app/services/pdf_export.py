from jinja2 import Environment, FileSystemLoader
from pathlib import Path
import io
import sys
import platform

# Try to import WeasyPrint for Linux/Render, fallback to fpdf2 on Windows
try:
    if platform.system() != "Windows":
        from weasyprint import HTML
        WEASYPRINT_AVAILABLE = True
    else:
        WEASYPRINT_AVAILABLE = False
except ImportError:
    WEASYPRINT_AVAILABLE = False

# Fallback to fpdf2 (pure Python)
from fpdf import FPDF

template_dir = Path(__file__).parent.parent / "templates"
jinja_env = Environment(loader=FileSystemLoader(str(template_dir)))

def get_score_class(score: int) -> str:
    if score >= 80: return "score-green"
    if score >= 60: return "score-amber"
    if score >= 40: return "score-orange"
    return "score-red"


def _render_html(analysis: dict) -> str:
    """Render the analysis as HTML using Jinja2 template."""
    template = jinja_env.get_template("report.html")
    return template.render(
        job_title=analysis["job_title"],
        timestamp=analysis["timestamp"][:10],
        scores=analysis["scores"],
        missing_skills=analysis["missing_skills"],
        ats_keywords=analysis["ats_keywords"],
        strengths=analysis["strengths"],
        improvement_tips=analysis["improvement_tips"],
        score_class=get_score_class,
        enumerate=enumerate,
    )


def _generate_pdf_with_fpdf2(html_content: str) -> bytes:
    """Generate PDF using fpdf2 (pure Python) as fallback."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Add fonts (DejaVu Sans is available in fpdf2)
    pdf.add_font('DejaVu', '', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', uni=True)
    pdf.add_font('DejaVu', 'B', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', uni=True)

    # Simple text extraction from HTML for fpdf2
    from html.parser import HTMLParser

    class HTMLToText(HTMLParser):
        def __init__(self):
            super().__init__()
            self.text_parts = []
            self.ignore = False

        def handle_starttag(self, tag, attrs):
            if tag in ('style', 'script', 'head', 'meta'):
                self.ignore = True

        def handle_endtag(self, tag):
            if tag in ('style', 'script', 'head', 'meta'):
                self.ignore = False
            elif tag in ('p', 'div', 'br', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
                self.text_parts.append('\n')

        def handle_data(self, data):
            if not self.ignore and data.strip():
                self.text_parts.append(data.strip() + ' ')

    parser = HTMLToText()
    parser.feed(html_content)
    text = ''.join(parser.text_parts)

    pdf.set_font('DejaVu', '', 10)
    pdf.multi_cell(0, 5, text)

    return bytes(pdf.output())


def generate_analysis_pdf(analysis: dict) -> bytes:
    """Render the analysis as HTML, then convert to PDF bytes."""
    html_content = _render_html(analysis)

    # Try WeasyPrint first (Linux/Render), fallback to fpdf2
    if WEASYPRINT_AVAILABLE:
        try:
            from weasyprint import HTML
            pdf_bytes = HTML(string=html_content).write_pdf()
            return pdf_bytes
        except Exception:
            pass  # Fall through to fpdf2

    # Fallback to fpdf2
    return _generate_pdf_with_fpdf2(html_content)
