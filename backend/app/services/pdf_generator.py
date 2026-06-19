import re
from datetime import datetime
from io import BytesIO

_FONT_REGULAR = "Helvetica"
_FONT_BOLD = "Helvetica-Bold"
_FONTS_REGISTERED = False


def _register_unicode_fonts() -> tuple[str, str]:
    global _FONTS_REGISTERED, _FONT_REGULAR, _FONT_BOLD
    if _FONTS_REGISTERED:
        return _FONT_REGULAR, _FONT_BOLD
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        pdfmetrics.registerFont(TTFont("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
        _FONT_REGULAR = "DejaVu"
        _FONT_BOLD = "DejaVu-Bold"
    except Exception:
        pass  # fall back to Helvetica
    _FONTS_REGISTERED = True
    return _FONT_REGULAR, _FONT_BOLD


def _strip_emoji(text: str) -> str:
    return re.sub(
        "[\U0001F300-\U0001F9FF\U00002702-\U000027B0\U0001FA00-\U0001FA9F]+",
        "",
        text,
    ).strip()


def generate_pdf_bytes(title: str, content: str, generated_at: datetime) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    body_font, bold_font = _register_unicode_fonts()

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=22 * mm,
        leftMargin=22 * mm,
        topMargin=22 * mm,
        bottomMargin=22 * mm,
        title=title,
    )

    title_style = ParagraphStyle(
        "Title", fontName=bold_font, fontSize=20, spaceAfter=4, textColor=colors.HexColor("#111827")
    )
    meta_style = ParagraphStyle(
        "Meta", fontName=body_font, fontSize=9, spaceAfter=14, textColor=colors.HexColor("#6b7280")
    )
    h2_style = ParagraphStyle(
        "H2",
        fontName=bold_font,
        fontSize=13,
        spaceBefore=14,
        spaceAfter=4,
        textColor=colors.HexColor("#1d4ed8"),
        borderPad=2,
    )
    body_style = ParagraphStyle(
        "Body", fontName=body_font, fontSize=10, leading=15, spaceAfter=3,
        textColor=colors.HexColor("#1f2937")
    )
    bullet_style = ParagraphStyle(
        "Bullet",
        fontName=body_font,
        fontSize=10,
        leading=14,
        leftIndent=14,
        spaceAfter=2,
        textColor=colors.HexColor("#1f2937"),
    )

    story = [
        Paragraph(_strip_emoji(title), title_style),
        Paragraph(
            f"Generated: {generated_at.strftime('%Y-%m-%d %H:%M UTC')}",
            meta_style,
        ),
    ]

    for raw_line in content.split("\n"):
        line = raw_line.strip()
        if not line:
            story.append(Spacer(1, 5))
            continue

        clean = _strip_emoji(line)

        if line.startswith("## "):
            story.append(Paragraph(clean[3:].strip(), h2_style))
        elif line.startswith("### "):
            story.append(Paragraph(f"<b>{clean[4:].strip()}</b>", body_style))
        elif line.startswith(("- ", "* ", "• ")):
            text = clean[2:].strip()
            # handle inline **bold**
            text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
            story.append(Paragraph(f"• {text}", bullet_style))
        else:
            text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", clean)
            story.append(Paragraph(text, body_style))

    doc.build(story)
    return buf.getvalue()
