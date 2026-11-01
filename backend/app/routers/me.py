from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import get_current_user
from ..models import User, School, TeacherAssignment, Classroom, SchoolShift, Notification

router = APIRouter(prefix="/me", tags=["me"])

@router.get("")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    school = db.get(School, user.school_id) if user.school_id else None
    unread = db.scalar(select(__import__('sqlalchemy').func.count(Notification.id)).where(Notification.recipient_id == user.id, Notification.read_at.is_(None))) or 0
    return {
        "id": user.id, "full_name": user.full_name, "phone": user.phone, "role": user.role.value,
        "school": None if not school else {
            "id": school.id, "name": school.name, "code": school.code,
            "subscription_status": school.subscription_status.value,
            "trial_ends_at": school.trial_ends_at, "subscription_ends_at": school.subscription_ends_at,
        },
        "unread_notifications": unread,
    }

@router.get("/assignments")
def assignments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(TeacherAssignment, Classroom, SchoolShift)
        .join(Classroom, Classroom.id == TeacherAssignment.classroom_id)
        .join(SchoolShift, SchoolShift.id == Classroom.shift_id)
        .where(TeacherAssignment.teacher_id == user.id, TeacherAssignment.school_id == user.school_id)
        .order_by(Classroom.name)
    ).all()
    return [{"assignment_id": a.id, "classroom_id": c.id, "class_name": c.name, "grade": c.grade, "field": c.field, "subject": a.subject, "shift": s.name, "periods_count": s.periods_count, "periods":[{"period_number":p.period_number,"starts_at":p.starts_at,"ends_at":p.ends_at} for p in s.periods]} for a,c,s in rows]
