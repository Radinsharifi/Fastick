from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from .db import Base, engine, SessionLocal
from .config import settings
from .models import User, UserRole, SchoolShift, ShiftPeriod
from .auth import hash_password
from .routers import auth, me, setup, attendance, dashboard, notifications, reports, subscription, platform, analytics

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db=SessionLocal()
    try:
        for shift in db.scalars(select(SchoolShift)).all():
            existing={period.period_number for period in shift.periods}
            for number in range(1,shift.periods_count+1):
                if number not in existing:
                    db.add(ShiftPeriod(shift_id=shift.id,period_number=number))
        db.commit()
        admin=db.scalar(select(User).where(User.school_id.is_(None),User.role==UserRole.PLATFORM_ADMIN,User.phone==settings.platform_admin_phone))
        if not admin:
            db.add(User(school_id=None,full_name="ادمین پلتفرم",phone=settings.platform_admin_phone,hashed_password=hash_password(settings.platform_admin_password),role=UserRole.PLATFORM_ADMIN))
            db.commit()
    finally:db.close()
    yield

app=FastAPI(title="FASTICK | سامانه هوشمند حضور و غیاب مدارس",version="1.0.0",lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=settings.cors_list,allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
for r in [auth.router,me.router,setup.router,attendance.router,dashboard.router,notifications.router,reports.router,subscription.router,platform.router,analytics.router]:app.include_router(r,prefix="/api")

@app.get("/health")
def health():return {"ok":True}
