from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import School, SchoolShift, ShiftPeriod, User, UserRole, SubscriptionStatus
from ..schemas import RegisterSchoolIn, LoginIn, TokenOut
from ..auth import hash_password, verify_password, create_access_token
from ..config import settings
from ..services.audit import log_action

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register-school", response_model=TokenOut)
def register_school(data: RegisterSchoolIn, db: Session = Depends(get_db)):
    code = data.school_code.strip().lower()
    if db.scalar(select(School).where(School.code == code)):
        raise HTTPException(409, "کد مدرسه قبلاً استفاده شده است")
    now = datetime.now(timezone.utc)
    school = School(
        name=data.school_name.strip(), code=code, city=data.city, phone=data.school_phone,
        subscription_status=SubscriptionStatus.TRIAL,
        trial_ends_at=now + timedelta(days=settings.trial_days),
    )
    db.add(school); db.flush()
    for shift in data.shifts:
        if len(shift.periods) != shift.periods_count:
            raise HTTPException(400, "برای همه زنگ‌های هر شیفت باید ساعت شروع و پایان وارد شود")
        row=SchoolShift(school_id=school.id, name=shift.name, starts_at=shift.periods[0].starts_at, periods_count=shift.periods_count)
        db.add(row); db.flush()
        for number,period in enumerate(shift.periods,1):
            db.add(ShiftPeriod(shift_id=row.id,period_number=number,starts_at=period.starts_at,ends_at=period.ends_at))
    manager = User(
        school_id=school.id, full_name=data.manager_name.strip(), phone=data.manager_phone.strip(),
        hashed_password=hash_password(data.password), role=UserRole.MANAGER
    )
    db.add(manager); db.flush()
    log_action(db, manager, "school_registered", "school", str(school.id))
    db.commit(); db.refresh(manager)
    token = create_access_token(str(manager.id), {"role": manager.role.value, "school_id": school.id})
    return TokenOut(access_token=token, user={"id": manager.id, "full_name": manager.full_name, "role": manager.role.value, "school_id": school.id, "school_code": school.code})

@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    if data.school_code:
        school = db.scalar(select(School).where(School.code == data.school_code.strip().lower()))
        if not school:
            raise HTTPException(401, "کد مدرسه یا اطلاعات ورود نادرست است")
        user = db.scalar(select(User).where(User.school_id == school.id, User.phone == data.phone.strip()))
    else:
        user = db.scalar(select(User).where(User.school_id.is_(None), User.phone == data.phone.strip(), User.role == UserRole.PLATFORM_ADMIN))
    if not user or not verify_password(data.password, user.hashed_password) or not user.is_active:
        raise HTTPException(401, "کد مدرسه، موبایل یا رمز عبور نادرست است")
    token = create_access_token(str(user.id), {"role": user.role.value, "school_id": user.school_id})
    log_action(db, user, "login")
    db.commit()
    return TokenOut(access_token=token, user={"id": user.id, "full_name": user.full_name, "role": user.role.value, "school_id": user.school_id})
