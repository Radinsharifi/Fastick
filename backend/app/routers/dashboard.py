from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import require_active_subscription
from ..models import User, UserRole, Classroom, SchoolShift, Student, TeacherAssignment, AttendanceSession, AttendanceRecord, AttendanceStatus

router=APIRouter(prefix="/dashboard",tags=["dashboard"])

@router.get("/today")
def today_dashboard(target_date:date|None=None,user:User=Depends(require_active_subscription),db:Session=Depends(get_db)):
    tehran=timezone(timedelta(hours=3,minutes=30))
    d=target_date or datetime.now(timezone.utc).astimezone(tehran).date()
    teacher_class_ids=None
    if user.role==UserRole.TEACHER:
        teacher_class_ids=set(db.scalars(
            select(TeacherAssignment.classroom_id).where(
                TeacherAssignment.teacher_id==user.id,
                TeacherAssignment.school_id==user.school_id,
            ).distinct()
        ).all())

    class_query=select(Classroom,SchoolShift).join(SchoolShift).where(
        Classroom.school_id==user.school_id,
        SchoolShift.school_id==user.school_id,
        Classroom.is_active==True,
        SchoolShift.is_active==True,
    )
    if teacher_class_ids is not None:
        class_query=class_query.where(Classroom.id.in_(teacher_class_ids))
    classes=db.execute(class_query.order_by(SchoolShift.name,Classroom.name)).all()

    student_query=select(func.count(Student.id)).where(
        Student.school_id==user.school_id,
        Student.is_active==True,
    )
    if teacher_class_ids is not None:
        student_query=student_query.where(Student.classroom_id.in_(teacher_class_ids))
    total_students=db.scalar(student_query) or 0

    session_query=select(AttendanceSession).where(
        AttendanceSession.school_id==user.school_id,
        AttendanceSession.attendance_date==d,
    )
    if teacher_class_ids is not None:
        session_query=session_query.where(AttendanceSession.classroom_id.in_(teacher_class_ids))
    submitted=db.scalars(session_query).all()
    by_key={(s.classroom_id,s.period_number):s for s in submitted}
    def count_records(status:AttendanceStatus,day:date):
        query=select(func.count(AttendanceRecord.id)).join(
            AttendanceSession,
            AttendanceSession.id==AttendanceRecord.session_id,
        ).where(
            AttendanceRecord.school_id==user.school_id,
            AttendanceSession.school_id==user.school_id,
            AttendanceSession.attendance_date==day,
            AttendanceRecord.status==status,
        )
        if teacher_class_ids is not None:
            query=query.where(AttendanceSession.classroom_id.in_(teacher_class_ids))
        return db.scalar(query) or 0

    absent=count_records(AttendanceStatus.ABSENT,d)
    late=count_records(AttendanceStatus.LATE,d)
    statuses=[]; expected=0
    for c,s in classes:
        periods=[]
        for p in range(1,s.periods_count+1):
            expected+=1
            ses=by_key.get((c.id,p))
            periods.append({"period":p,"submitted":bool(ses),"teacher_id":ses.teacher_id if ses else None})
        statuses.append({"classroom_id":c.id,"class_name":c.name,"grade":c.grade,"field":c.field,"shift":s.name,"periods_count":s.periods_count,"periods":periods})
    # Weekly series: submitted sessions and absence records
    series=[]
    for i in range(6,-1,-1):
        day=d-timedelta(days=i)
        sessions_query=select(func.count(AttendanceSession.id)).where(
            AttendanceSession.school_id==user.school_id,
            AttendanceSession.attendance_date==day,
        )
        if teacher_class_ids is not None:
            sessions_query=sessions_query.where(AttendanceSession.classroom_id.in_(teacher_class_ids))
        sessions_count=db.scalar(sessions_query) or 0
        abs_count=count_records(AttendanceStatus.ABSENT,day)
        series.append({"date":day.isoformat(),"sessions":sessions_count,"absences":abs_count})
    return {"date":d,"total_students":total_students,"absent_records":absent,"late_records":late,"submitted_sessions":len(submitted),"expected_sessions":expected,"completion_percent":round((len(submitted)/expected*100),1) if expected else 0,"classes":statuses,"weekly":series}
