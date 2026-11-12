from datetime import date
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..db import get_db
from ..deps import require_active_subscription, require_roles
from ..models import User, UserRole, AttendanceRecord, AttendanceSession, Student, Classroom, SchoolShift, AttendanceStatus
from ..services.reports import make_excel, make_pdf
from ..services.sms import sms_service
from ..services.audit import log_action
from ..config import settings

router=APIRouter(prefix="/reports",tags=["reports"])
SMS_STATUSES=(AttendanceStatus.ABSENT,AttendanceStatus.EXCUSED)

def _rows(db:Session,school_id:int,start:date,end:date,classroom_id:int|None=None):
    stmt=(select(AttendanceRecord,AttendanceSession,Student,Classroom,User,SchoolShift)
          .join(AttendanceSession,AttendanceSession.id==AttendanceRecord.session_id)
          .join(Student,Student.id==AttendanceRecord.student_id)
          .join(Classroom,Classroom.id==AttendanceSession.classroom_id)
          .join(User,User.id==AttendanceSession.teacher_id)
          .join(SchoolShift,SchoolShift.id==Classroom.shift_id)
          .where(AttendanceRecord.school_id==school_id,
                 AttendanceSession.school_id==school_id,
                 Student.school_id==school_id,
                 Classroom.school_id==school_id,
                 User.school_id==school_id,
                 SchoolShift.school_id==school_id,
                 AttendanceSession.attendance_date.between(start,end)))
    if classroom_id:stmt=stmt.where(Classroom.id==classroom_id)
    result=[]
    fa_status={AttendanceStatus.ABSENT:"غایب",AttendanceStatus.EXCUSED:"غیبت موجه",AttendanceStatus.LATE:"دیرآمده"}
    for rec,ses,stu,cls,teacher,shift in db.execute(stmt.order_by(AttendanceSession.attendance_date,Classroom.name,Student.full_name)).all():
        result.append({"date":ses.attendance_date.isoformat(),"period":ses.period_number,"classroom_id":cls.id,"class_name":cls.name,"shift_name":shift.name,"grade":cls.grade,"field":cls.field,"student_name":stu.full_name,"student_code":stu.student_code,"status":rec.status.value,"status_fa":fa_status[rec.status],"reason":rec.reason,"teacher_name":teacher.full_name})
    return result

def _pending_sms_student_ids(db:Session,school_id:int,start:date,end:date,classroom_id:int|None=None,with_phone:bool=True):
    stmt=(select(Student.id)
          .join(AttendanceRecord,AttendanceRecord.student_id==Student.id)
          .join(AttendanceSession,AttendanceSession.id==AttendanceRecord.session_id)
          .where(AttendanceRecord.school_id==school_id,
                 Student.school_id==school_id,
                 AttendanceSession.attendance_date.between(start,end),
                 AttendanceSession.school_id==school_id,
                 AttendanceRecord.status.in_(SMS_STATUSES),
                 AttendanceRecord.parent_sms_sent.is_(False)))
    if classroom_id is not None:
        stmt=stmt.where(AttendanceSession.classroom_id==classroom_id)
    if with_phone:
        stmt=stmt.where(Student.guardian_phone.is_not(None),Student.guardian_phone!="")
    return db.scalars(stmt.distinct().order_by(Student.id)).all()

def _validate_report_range(start:date,end:date):
    if start>end:
        raise HTTPException(400,"تاریخ شروع باید قبل از تاریخ پایان باشد.")

@router.get("/summary")
def summary(start:date,end:date,classroom_id:int|None=Query(default=None,ge=1),user:User=Depends(require_roles(UserRole.MANAGER,UserRole.DEPUTY)), _sub:User=Depends(require_active_subscription), db:Session=Depends(get_db)):
    _validate_report_range(start,end)
    rows=_rows(db,user.school_id,start,end,classroom_id)
    counts={}
    class_summaries={}
    for r in rows:
        k=(r["classroom_id"],r["student_code"])
        if k not in counts:counts[k]={"classroom_id":r["classroom_id"],"student_code":r["student_code"],"student_name":r["student_name"],"class_name":r["class_name"],"shift_name":r["shift_name"],"absent":0,"excused":0,"late":0}
        counts[k][r["status"]]+=1
        group=class_summaries.setdefault(r["classroom_id"],{"absent":0,"excused":0,"late":0})
        group[r["status"]]+=1

    sessions_stmt=(select(AttendanceSession,Classroom,SchoolShift)
                   .join(Classroom,Classroom.id==AttendanceSession.classroom_id)
                   .join(SchoolShift,SchoolShift.id==Classroom.shift_id)
                   .where(AttendanceSession.school_id==user.school_id,
                          Classroom.school_id==user.school_id,
                          SchoolShift.school_id==user.school_id,
                          AttendanceSession.attendance_date.between(start,end)))
    if classroom_id is not None:
        sessions_stmt=sessions_stmt.where(Classroom.id==classroom_id)
    class_rows={}
    for session,cls,shift in db.execute(sessions_stmt.order_by(AttendanceSession.attendance_date,AttendanceSession.period_number)).all():
        item=class_rows.setdefault(cls.id,{
            "classroom_id":cls.id,
            "class_name":cls.name,
            "shift_name":shift.name,
            "sessions":0,
            "periods":[],
            "absent":0,
            "excused":0,
            "late":0,
            "sms_pending":0,
        })
        item["sessions"]+=1
        item["periods"].append({"date":session.attendance_date.isoformat(),"period":session.period_number})
    for class_id,item in class_rows.items():
        item.update(class_summaries.get(class_id,{}))

    pending_stmt=(select(AttendanceSession.classroom_id,AttendanceRecord.student_id)
                  .join(AttendanceRecord,AttendanceRecord.session_id==AttendanceSession.id)
                  .join(Student,Student.id==AttendanceRecord.student_id)
                  .where(AttendanceRecord.school_id==user.school_id,
                         Student.school_id==user.school_id,
                         AttendanceSession.school_id==user.school_id,
                         AttendanceSession.attendance_date.between(start,end),
                         AttendanceRecord.status.in_(SMS_STATUSES),
                         AttendanceRecord.parent_sms_sent.is_(False),
                         Student.guardian_phone.is_not(None),
                         Student.guardian_phone!="")
                  .distinct())
    if classroom_id is not None:
        pending_stmt=pending_stmt.where(AttendanceSession.classroom_id==classroom_id)
    pending_by_class={}
    for class_key,student_id in db.execute(pending_stmt).all():
        pending_by_class.setdefault(class_key,set()).add(student_id)
    for class_key,item in class_rows.items():
        item["sms_pending"]=len(pending_by_class.get(class_key,set()))
        item["periods"].sort(key=lambda value:(value["date"],value["period"]))

    sms_pending=len(_pending_sms_student_ids(db,user.school_id,start,end,classroom_id))
    classes=sorted(class_rows.values(),key=lambda x:(x["shift_name"],x["class_name"]))
    return {"rows":rows,"students":sorted(counts.values(),key=lambda x:(-x["absent"],x["student_name"])),"classes":classes,"sms_pending":sms_pending}

@router.get("/excel")
def excel(start:date,end:date,classroom_id:int|None=Query(default=None,ge=1),user:User=Depends(require_roles(UserRole.MANAGER,UserRole.DEPUTY)), _sub:User=Depends(require_active_subscription), db:Session=Depends(get_db)):
    _validate_report_range(start,end)
    rows=_rows(db,user.school_id,start,end,classroom_id); data=make_excel(rows,f"گزارش حضور و غیاب {start} تا {end}")
    return StreamingResponse(BytesIO(data),media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",headers={"Content-Disposition":f"attachment; filename=attendance-{start}-{end}.xlsx"})

@router.get("/pdf")
def pdf(start:date,end:date,classroom_id:int|None=Query(default=None,ge=1),user:User=Depends(require_roles(UserRole.MANAGER,UserRole.DEPUTY)), _sub:User=Depends(require_active_subscription), db:Session=Depends(get_db)):
    _validate_report_range(start,end)
    rows=_rows(db,user.school_id,start,end,classroom_id); data=make_pdf(rows,f"گزارش حضور و غیاب {start} تا {end}")
    return StreamingResponse(BytesIO(data),media_type="application/pdf",headers={"Content-Disposition":f"attachment; filename=attendance-{start}-{end}.pdf"})

@router.post("/sms")
def send_parent_sms(start:date,end:date,classroom_id:int=Query(ge=1),user:User=Depends(require_roles(UserRole.MANAGER,UserRole.DEPUTY)), _sub:User=Depends(require_active_subscription), db:Session=Depends(get_db)):
    _validate_report_range(start,end)
    if start!=end:
        raise HTTPException(400,"برای ارسال پیامک، یک روز مشخص را انتخاب کنید.")
    classroom=db.scalar(select(Classroom.id).where(Classroom.id==classroom_id,Classroom.school_id==user.school_id))
    if not classroom:
        raise HTTPException(404,"کلاس پیدا نشد")

    pending_ids=_pending_sms_student_ids(db,user.school_id,start,end,classroom_id,with_phone=False)
    sent=failed=skipped_no_phone=0
    for student_id in pending_ids:
        entries=db.execute(
            select(AttendanceRecord,AttendanceSession,Student)
            .join(AttendanceSession,AttendanceSession.id==AttendanceRecord.session_id)
            .join(Student,Student.id==AttendanceRecord.student_id)
            .where(AttendanceRecord.school_id==user.school_id,
                   Student.school_id==user.school_id,
                   AttendanceSession.attendance_date.between(start,end),
                   AttendanceSession.school_id==user.school_id,
                   AttendanceSession.classroom_id==classroom_id,
                   Student.id==student_id,
                   AttendanceRecord.status.in_(SMS_STATUSES),
                   AttendanceRecord.parent_sms_sent.is_(False))
            .order_by(AttendanceSession.attendance_date,AttendanceSession.period_number)
            .with_for_update(of=AttendanceRecord,skip_locked=True)
        ).all()
        if not entries:
            continue
        student=entries[0][2]
        if not student.guardian_phone:
            skipped_no_phone+=1
            db.rollback()
            continue
        message=f"ولی محترم {student.full_name}، {len(entries)} مورد غیبت/غیبت موجه ایشان از تاریخ {start} تا {end} در مدرسه ثبت شده است."
        accepted = sms_service.send(student.guardian_phone,message)
        if accepted:
            for record,_,_ in entries:
                record.parent_sms_sent=True
            db.commit()
            sent+=1
        else:
            db.rollback()
            failed+=1

    log_action(db,user,"parent_absence_sms_sent","class",str(classroom_id),{"start":str(start),"end":str(end),"sent":sent,"failed":failed,"skipped_no_phone":skipped_no_phone})
    db.commit()
    return {"sent":sent,"failed":failed,"skipped_no_phone":skipped_no_phone,"provider":settings.sms_provider}
