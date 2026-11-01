from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select, union_all
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import require_roles
from ..models import AuditLog, User, UserRole, School, Student, UsageEvent

router=APIRouter(prefix="/platform",tags=["platform"])

@router.get("/stats")
def stats(user:User=Depends(require_roles(UserRole.PLATFORM_ADMIN)),db:Session=Depends(get_db)):
    return {"schools":db.scalar(select(func.count(School.id))) or 0,"students":db.scalar(select(func.count(Student.id))) or 0,"active_schools":db.scalar(select(func.count(School.id)).where(School.is_active==True)) or 0}

@router.get("/analytics")
def analytics(user:User=Depends(require_roles(UserRole.PLATFORM_ADMIN)),db:Session=Depends(get_db)):
    today=datetime.utcnow().date()
    start_day=today-timedelta(days=29)
    start=datetime.combine(start_day,datetime.min.time())

    activity_union=union_all(
        select(func.date(UsageEvent.created_at).label("day"),UsageEvent.school_id.label("school_id"),UsageEvent.user_id.label("user_id"))
        .where(UsageEvent.created_at>=start),
        select(func.date(AuditLog.created_at).label("day"),AuditLog.school_id.label("school_id"),AuditLog.user_id.label("user_id"))
        .where(AuditLog.created_at>=start,AuditLog.school_id.is_not(None)),
    ).subquery()
    daily_active=db.execute(
        select(
            activity_union.c.day,
            func.count(func.distinct(activity_union.c.school_id)),
            func.count(func.distinct(activity_union.c.user_id)),
        ).group_by(activity_union.c.day)
    ).all()
    daily={str(day)[:10]:{"active_schools":int(schools or 0),"active_users":int(users or 0)} for day,schools,users in daily_active}

    daily_pages=db.execute(
        select(func.date(UsageEvent.created_at),func.count(UsageEvent.id))
        .where(UsageEvent.created_at>=start)
        .group_by(func.date(UsageEvent.created_at))
    ).all()
    for day,count in daily_pages:
        daily.setdefault(str(day)[:10],{"active_schools":0,"active_users":0})["page_views"]=int(count or 0)

    attendance_action=case((AuditLog.action=="attendance_submitted",1),else_=0)
    login_action=case((AuditLog.action=="login",1),else_=0)
    sms_action=case((AuditLog.action=="parent_absence_sms_sent",1),else_=0)
    daily_actions=db.execute(
        select(
            func.date(AuditLog.created_at),
            func.sum(attendance_action),
            func.sum(login_action),
            func.sum(sms_action),
        ).where(AuditLog.created_at>=start,AuditLog.school_id.is_not(None))
        .group_by(func.date(AuditLog.created_at))
    ).all()
    for day,attendance,logins,sms in daily_actions:
        row=daily.setdefault(str(day)[:10],{"active_schools":0,"active_users":0})
        row.update({
            "attendance_submissions":int(attendance or 0),
            "successful_logins":int(logins or 0),
            "sms_class_attempts":int(sms or 0),
        })

    daily_signups=db.execute(
        select(func.date(School.created_at),func.count(School.id))
        .where(School.created_at>=start)
        .group_by(func.date(School.created_at))
    ).all()
    for day,count in daily_signups:
        daily.setdefault(str(day)[:10],{"active_schools":0,"active_users":0})["new_schools"]=int(count or 0)

    page_totals=db.execute(
        select(UsageEvent.page,func.count(UsageEvent.id))
        .where(UsageEvent.created_at>=start)
        .group_by(UsageEvent.page)
        .order_by(func.count(UsageEvent.id).desc())
    ).all()
    page_counts=[{"page":page,"views":int(count or 0)} for page,count in page_totals]

    page_by_school=db.execute(
        select(
            UsageEvent.school_id,
            func.count(UsageEvent.id),
            func.count(func.distinct(UsageEvent.user_id)),
            func.max(UsageEvent.created_at),
        ).where(UsageEvent.created_at>=start)
        .group_by(UsageEvent.school_id)
    ).all()
    school_activity={}
    for school_id,views,users,last_seen in page_by_school:
        school_activity[school_id]={
            "page_views":int(views or 0),
            "active_users":int(users or 0),
            "last_activity":last_seen,
            "logins":0,
            "attendance_submissions":0,
            "sms_class_attempts":0,
            "imports":0,
        }

    audit_by_school=db.execute(
        select(
            AuditLog.school_id,
            func.sum(login_action),
            func.sum(attendance_action),
            func.sum(sms_action),
            func.sum(case((AuditLog.action.in_(("students_imported","staff_imported")),1),else_=0)),
            func.max(AuditLog.created_at),
        ).where(AuditLog.created_at>=start,AuditLog.school_id.is_not(None))
        .group_by(AuditLog.school_id)
    ).all()
    for school_id,logins,attendance,sms,imports,last_seen in audit_by_school:
        row=school_activity.setdefault(school_id,{
            "page_views":0,
            "active_users":0,
            "last_activity":None,
            "logins":0,
            "attendance_submissions":0,
            "sms_class_attempts":0,
            "imports":0,
        })
        row["logins"]=int(logins or 0)
        row["attendance_submissions"]=int(attendance or 0)
        row["sms_class_attempts"]=int(sms or 0)
        row["imports"]=int(imports or 0)
        if last_seen and (row["last_activity"] is None or last_seen>row["last_activity"]):
            row["last_activity"]=last_seen

    schools=db.scalars(select(School).order_by(School.created_at.desc())).all()
    school_rows=[]
    for school in schools:
        activity=school_activity.get(school.id,{
            "page_views":0,
            "active_users":0,
            "last_activity":None,
            "logins":0,
            "attendance_submissions":0,
            "sms_class_attempts":0,
            "imports":0,
        })
        school_rows.append({
            "school_id":school.id,
            "name":school.name,
            "code":school.code,
            **activity,
        })
    def school_activity_sort_key(row):
        last_seen=row["last_activity"]
        if last_seen is None:
            last_seen_timestamp=0
        elif last_seen.tzinfo is None:
            last_seen_timestamp=last_seen.replace(tzinfo=timezone.utc).timestamp()
        else:
            last_seen_timestamp=last_seen.timestamp()
        return (
            row["page_views"]+row["attendance_submissions"]+row["logins"],
            last_seen_timestamp,
        )

    school_rows.sort(key=school_activity_sort_key,reverse=True)

    seven_day_start=datetime.combine(today-timedelta(days=6),datetime.min.time())
    active_school_ids=set(db.scalars(select(UsageEvent.school_id).where(UsageEvent.created_at>=seven_day_start).distinct()).all())
    active_school_ids.update(db.scalars(select(AuditLog.school_id).where(AuditLog.created_at>=seven_day_start,AuditLog.school_id.is_not(None)).distinct()).all())
    active_user_ids=set(db.scalars(select(UsageEvent.user_id).where(UsageEvent.created_at>=seven_day_start).distinct()).all())
    active_user_ids.update(db.scalars(select(AuditLog.user_id).where(
        AuditLog.created_at>=seven_day_start,
        AuditLog.school_id.is_not(None),
        AuditLog.user_id.is_not(None),
    ).distinct()).all())

    page_views=int(db.scalar(select(func.count(UsageEvent.id)).where(UsageEvent.created_at>=start)) or 0)
    attendance_submissions=int(db.scalar(select(func.count(AuditLog.id)).where(
        AuditLog.created_at>=start,
        AuditLog.school_id.is_not(None),
        AuditLog.action=="attendance_submitted",
    )) or 0)
    successful_logins=int(db.scalar(select(func.count(AuditLog.id)).where(
        AuditLog.created_at>=start,
        AuditLog.school_id.is_not(None),
        AuditLog.action=="login",
    )) or 0)
    new_schools=int(db.scalar(select(func.count(School.id)).where(School.created_at>=start)) or 0)

    series=[]
    for offset in range(30):
        day=start_day+timedelta(days=offset)
        row=daily.get(day.isoformat(),{})
        series.append({
            "date":day.isoformat(),
            "active_schools":row.get("active_schools",0),
            "active_users":row.get("active_users",0),
            "page_views":row.get("page_views",0),
            "attendance_submissions":row.get("attendance_submissions",0),
            "successful_logins":row.get("successful_logins",0),
            "sms_class_attempts":row.get("sms_class_attempts",0),
            "new_schools":row.get("new_schools",0),
        })

    return {
        "period_days":30,
        "totals":{
            "schools":db.scalar(select(func.count(School.id))) or 0,
            "new_schools_30d":new_schools,
            "active_schools_7d":len(active_school_ids),
            "active_users_7d":len(active_user_ids),
            "page_views_30d":page_views,
            "attendance_submissions_30d":attendance_submissions,
            "successful_logins_30d":successful_logins,
        },
        "daily":series,
        "pages":page_counts,
        "schools_activity":school_rows[:50],
        "note":"آمار بازدید صفحه‌ها و فعالیت مدارس در این داشبورد نمایش داده می‌شود. رویدادهای عملیاتی از گزارش ممیزی سامانه محاسبه می‌شوند.",
    }
