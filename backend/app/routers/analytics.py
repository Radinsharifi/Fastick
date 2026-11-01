from datetime import datetime
from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import get_current_user
from ..models import UsageEvent, User, UserRole

router = APIRouter(prefix="/analytics", tags=["analytics"])

ALLOWED_PAGES = {
    "/",
    "/attendance",
    "/reports",
    "/students",
    "/staff",
    "/settings",
    "/notifications",
    "/subscription",
}


class PageViewIn(BaseModel):
    event: Literal["page_view"] = "page_view"
    page: str = Field(min_length=1, max_length=100)


@router.post("/page-view")
def record_page_view(
    data: PageViewIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role == UserRole.PLATFORM_ADMIN or not user.school_id:
        return {"recorded": False}
    if data.page not in ALLOWED_PAGES:
        return {"recorded": False}

    db.add(UsageEvent(
        school_id=user.school_id,
        user_id=user.id,
        role=user.role.value,
        event=data.event,
        page=data.page,
        created_at=datetime.utcnow(),
    ))
    db.commit()
    return {"recorded": True}
