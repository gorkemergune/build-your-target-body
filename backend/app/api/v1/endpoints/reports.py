from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.ai_report import AiReport
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.schemas.report import ReportResponse, ReportSummary
from app.services.pdf_generator import generate_pdf_bytes
from app.services.report_generator import generate_monthly_report, generate_weekly_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/generate-weekly", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def gen_weekly(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    title, content = await generate_weekly_report(current_user, db)
    record = AiReport(user_id=current_user.id, type="weekly", title=title, content=content)
    db.add(record)
    db.add(UsageEvent(user_id=current_user.id, event_type="report_generated"))
    db.commit()
    db.refresh(record)
    return record


@router.post("/generate-monthly", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def gen_monthly(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    title, content = await generate_monthly_report(current_user, db)
    record = AiReport(user_id=current_user.id, type="monthly", title=title, content=content)
    db.add(record)
    db.add(UsageEvent(user_id=current_user.id, event_type="report_generated"))
    db.commit()
    db.refresh(record)
    return record


@router.get("", response_model=list[ReportSummary])
def list_reports(
    limit: int = 20,
    type: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AiReport).filter(AiReport.user_id == current_user.id)
    if type:
        q = q.filter(AiReport.type == type)
    return q.order_by(AiReport.generated_at.desc()).limit(limit).all()


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(AiReport).filter(
        AiReport.id == report_id,
        AiReport.user_id == current_user.id,
    ).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


@router.get("/{report_id}/pdf")
def download_pdf(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(AiReport).filter(
        AiReport.id == report_id,
        AiReport.user_id == current_user.id,
    ).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    pdf_bytes = generate_pdf_bytes(report.title, report.content, report.generated_at)
    safe_title = report.title.replace(" ", "_").replace("—", "-")[:60]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )
