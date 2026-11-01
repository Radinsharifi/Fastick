from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import get_current_user, require_active_subscription
from ..models import User, UserRole, Classroom, Student, TeacherAssignment, AttendanceSession, AttendanceRecord
from ..schemas import AttendanceSubmitIn
from ..services.audit import log_action

router = APIRouter(prefix="/attendance", tags=["attendance"])

def _can_access_class(db:Session,user:User,classroom_id:int)->bool:
    if user.role in (UserRole.MANAGER,UserRole.DEPUTY): return bool(db.scalar(select(Classroom.id).where(Classroom.id==classroom_id,Classroom.school_id==user.school_id)))
    return bool(db.scalar(select(TeacherAssignment.id).where(TeacherAssignment.teacher_id==user.id,TeacherAssignment.classroom_id==classroom_id,TeacherAssignment.school_id==user.school_id)))

@router.get("/class/{classroom_id}/students")
def class_students(classroom_id:int, user:User=Depends(require_active_subscription), db:Session=Depends(get_db)):
    if not _can_access_class(db,user,classroom_id): raise HTTPException(403,"به این کلاس دسترسی ندارید")
    cls=db.scalar(select(Classroom).where(Classroom.id==classroom_id,Classroom.school_id==user.school_id))
    students=db.scalars(select(Student).where(Student.school_id==user.school_id,Student.classroom_id==classroom_id,Student.is_active==True).order_by(Student.full_name)).all()
    return {"classroom":{"id":cls.id,"name":cls.name,"grade":cls.grade,"field":cls.field},"students":[{"id":s.id,"student_code":s.student_code,"full_name":s.full_name} for s in students]}

@router.get("/session")
def get_session(classroom_id:int, attendance_date:date, period_number:int, user:User=Depends(require_active_subscription), db:Session=Depends(get_db)):
    if not _can_access_class(db,user,classroom_id): raise HTTPException(403,"دسترسی ندارید")
    session=db.scalar(select(AttendanceSession).where(AttendanceSession.school_id==user.school_id,AttendanceSession.classroom_id==classroom_id,AttendanceSession.attendance_date==attendance_date,AttendanceSession.period_number==period_number))
    if not session:return {"exists":False,"records":[]}
    records=db.scalars(select(AttendanceRecord).where(AttendanceRecord.session_id==session.id)).all()
    return {"exists":True,"session_id":session.id,"teacher_id":session.teacher_id,"subject":session.subject,"note":session.note,"records":[{"student_id":r.student_id,"status":r.status.value,"reason":r.reason} for r in records]}

@router.post("/submit")
def submit(data:AttendanceSubmitIn, user:User=Depends(require_active_subscription), db:Session=Depends(get_db)):
    if not _can_access_class(db,user,data.classroom_id): raise HTTPException(403,"به این کلاس دسترسی ندارید")
    cls=db.scalar(select(Classroom).where(Classroom.id==data.classroom_id,Classroom.school_id==user.school_id))
    if not cls: raise HTTPException(404,"کلاس پیدا نشد")
    if data.period_number<1 or data.period_number>cls.shift.periods_count: raise HTTPException(400,"شماره زنگ خارج از محدوده شیفت است")
    session=db.scalar(select(AttendanceSession).where(AttendanceSession.school_id==user.school_id,AttendanceSession.classroom_id==data.classroom_id,AttendanceSession.attendance_date==data.attendance_date,AttendanceSession.period_number==data.period_number))
    sent_student_ids=set()
    if session and user.role==UserRole.TEACHER and session.teacher_id!=user.id:
        raise HTTPException(409,"این زنگ قبلاً توسط معلم دیگری ثبت شده است")
    if not session:
        session=AttendanceSession(school_id=user.school_id,classroom_id=data.classroom_id,teacher_id=user.id,attendance_date=data.attendance_date,period_number=data.period_number,subject=data.subject,note=data.note)
        db.add(session); db.flush()
    else:
        sent_student_ids=set(db.scalars(select(AttendanceRecord.student_id).where(AttendanceRecord.session_id==session.id,AttendanceRecord.parent_sms_sent.is_(True))).all())
        session.teacher_id=user.id; session.subject=data.subject; session.note=data.note; session.updated_at=datetime.now(timezone.utc)
        db.execute(delete(AttendanceRecord).where(AttendanceRecord.session_id==session.id))
    valid_ids=set(db.scalars(select(Student.id).where(Student.school_id==user.school_id,Student.classroom_id==data.classroom_id)).all())
    for r in data.records:
        if r.student_id not in valid_ids: raise HTTPException(400,"دانش‌آموز متعلق به این کلاس نیست")
        db.add(AttendanceRecord(school_id=user.school_id,session_id=session.id,student_id=r.student_id,status=r.status,reason=r.reason,parent_sms_sent=r.student_id in sent_student_ids))
    log_action(db,user,"attendance_submitted","attendance_session",str(session.id),{"classroom_id":data.classroom_id,"period":data.period_number,"count":len(data.records)})
    db.commit()
    return {"ok":True,"session_id":session.id,"recorded":len(data.records)}
