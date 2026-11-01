from __future__ import annotations
from io import BytesIO
from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from bidi.algorithm import get_display
import arabic_reshaper
import os


def fa(text: str | None) -> str:
    if text is None:
        return ""
    return get_display(arabic_reshaper.reshape(str(text)))


def _append_text_values(ws, values: list) -> None:
    ws.append(values)
    for cell in ws[ws.max_row]:
        if isinstance(cell.value, str):
            cell.data_type = "s"


def make_excel(rows: list[dict], title: str) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "گزارش"
    ws.sheet_view.rightToLeft = True
    headers = ["تاریخ", "زنگ", "کلاس", "پایه", "رشته", "دانش‌آموز", "کد دانش‌آموزی", "وضعیت", "دلیل", "معلم"]
    _append_text_values(ws, [title])
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    ws["A1"].font = Font(bold=True, size=14)
    ws["A1"].alignment = Alignment(horizontal="center")
    ws.append(headers)
    for cell in ws[2]:
        cell.font = Font(bold=True)
        cell.fill = PatternFill("solid", fgColor="DDEBF7")
        cell.alignment = Alignment(horizontal="center")
    for r in rows:
        _append_text_values(ws, [
            r.get("date"), r.get("period"), r.get("class_name"), r.get("grade"), r.get("field"),
            r.get("student_name"), r.get("student_code"), r.get("status_fa"), r.get("reason"), r.get("teacher_name")
        ])
    widths = [14, 8, 16, 12, 16, 24, 16, 14, 24, 22]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[chr(64+i)].width = w
    for row in ws.iter_rows():
        for cell in row:
            cell.alignment = Alignment(horizontal="right", vertical="center")
    stream = BytesIO()
    wb.save(stream)
    return stream.getvalue()


def make_pdf(rows: list[dict], title: str) -> bytes:
    stream = BytesIO()
    page = landscape(A4)
    c = canvas.Canvas(stream, pagesize=page)
    font_name = "Helvetica"
    for path in ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("Persian", path))
                font_name = "Persian"
                break
            except Exception:
                pass
    width, height = page
    y = height - 35
    c.setFont(font_name, 15)
    c.drawRightString(width - 30, y, fa(title))
    y -= 30
    c.setFont(font_name, 9)
    header = "تاریخ | زنگ | کلاس | دانش‌آموز | وضعیت | دلیل | معلم"
    c.drawRightString(width - 30, y, fa(header))
    y -= 18
    for r in rows:
        line = f"{r.get('date','')} | {r.get('period','')} | {r.get('class_name','')} | {r.get('student_name','')} | {r.get('status_fa','')} | {r.get('reason','') or '-'} | {r.get('teacher_name','')}"
        if y < 35:
            c.showPage()
            c.setFont(font_name, 9)
            y = height - 35
        c.drawRightString(width - 30, y, fa(line))
        y -= 16
    c.save()
    return stream.getvalue()
