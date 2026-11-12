from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import get_current_user, require_roles
from ..models import User,UserRole,Notification,TeacherAssignment,Classroom
from ..schemas import ReminderIn
from ..services.sms import sms_service
from ..services.audit import log_action

router=APIRouter(prefix="/notifications",tags=["notifications"])

@router.get("")
def list_notifications(user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    rows=db.scalars(select(Notification).where(Notification.recipient_id==user.id).order_by(Notification.created_at.desc()).limit(100)).all()
    return [{"id":n.id,"title":n.title,"message":n.message,"kind":n.kind,"created_at":n.created_at,"read_at":n.read_at} for n in rows]

@router.post("/{notification_id}/read")
def mark_read(notification_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    n=db.scalar(select(Notification).where(Notification.id==notification_id,Notification.recipient_id==user.id))
    if not n: raise HTTPException(404,"اعلان پیدا نشد")
    n.read_at=datetime.now(timezone.utc); db.commit(); return {"ok":True}

@router.post("/reminder")
def reminder(data:ReminderIn,user:User=Depends(require_roles(UserRole.MANAGER,UserRole.DEPUTY)),db:Session=Depends(get_db)):
    teacher=db.scalar(select(User).where(User.id==data.teacher_id,User.school_id==user.school_id,User.role==UserRole.TEACHER))
    if not teacher: raise HTTPException(404,"معلم پیدا نشد")
    suffix=""
    if data.classroom_id:
        c=db.scalar(select(Classroom).where(Classroom.id==data.classroom_id,Classroom.school_id==user.school_id));
        if c: suffix+=f" کلاس {c.name}"
    if data.period_number:suffix+=f" زنگ {data.period_number}"
    message=f"لطفاً حضور و غیاب{suffix} را ثبت کنید."
    db.add(Notification(school_id=user.school_id,recipient_id=teacher.id,sender_id=user.id,title="یادآوری حضور و غیاب",message=message,kind="attendance_reminder"))
    sms_sent=False
    if data.send_sms:
        sms_sent=sms_service.send(teacher.phone,message)
    log_action(db,user,"attendance_reminder_sent","user",str(teacher.id),{"sms":sms_sent}); db.commit(); return {"ok":True,"sms_sent":sms_sent}
