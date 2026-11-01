from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from openpyxl import Workbook, load_workbook
from io import BytesIO
from ..db import get_db
from ..deps import require_roles
from ..models import User, UserRole, SchoolShift, ShiftPeriod, Classroom, Student, TeacherAssignment
from ..schemas import UserCreate, UserUpdate, ClassCreate, StudentCreate, StudentUpdate, ShiftCreate, ShiftUpdate
from ..auth import hash_password
from ..services.audit import log_action

router = APIRouter(prefix="/setup", tags=["setup"])
admin_dep = require_roles(UserRole.MANAGER, UserRole.DEPUTY)

@router.get("/shifts")
def list_shifts(user: User = Depends(admin_dep), db: Session = Depends(get_db)):
    shifts=db.scalars(select(SchoolShift).where(SchoolShift.school_id == user.school_id).order_by(SchoolShift.id)).all()
    return [{
        "id":shift.id,"school_id":shift.school_id,"name":shift.name,"starts_at":shift.starts_at,
        "periods_count":shift.periods_count,"is_active":shift.is_active,
        "periods":[{"period_number":p.period_number,"starts_at":p.starts_at,"ends_at":p.ends_at} for p in shift.periods],
    } for shift in shifts]

@router.post("/shifts")
def create_shift(data: ShiftCreate, user: User = Depends(require_roles(UserRole.MANAGER)), db: Session = Depends(get_db)):
    if db.scalar(select(SchoolShift).where(SchoolShift.school_id == user.school_id, SchoolShift.name == data.name)):
        raise HTTPException(409, "این شیفت وجود دارد")
    if len(data.periods) != data.periods_count:
        raise HTTPException(400,"برای هر زنگ، ساعت شروع و پایان را وارد کنید")
    row = SchoolShift(school_id=user.school_id,name=data.name,starts_at=data.periods[0].starts_at,periods_count=data.periods_count)
    db.add(row); db.flush()
    for number,period in enumerate(data.periods,1):
        db.add(ShiftPeriod(shift_id=row.id,period_number=number,starts_at=period.starts_at,ends_at=period.ends_at))
    log_action(db,user,"shift_created","shift"); db.commit(); db.refresh(row); return {"id":row.id}

@router.patch("/shifts/{shift_id}")
def update_shift(shift_id:int, data:ShiftUpdate, user:User=Depends(require_roles(UserRole.MANAGER)), db:Session=Depends(get_db)):
    row=db.scalar(select(SchoolShift).where(SchoolShift.id==shift_id, SchoolShift.school_id==user.school_id))
    if not row: raise HTTPException(404,"شیفت پیدا نشد")
    vals=data.model_dump(exclude_unset=True,exclude={"periods"})
    for k,v in vals.items(): setattr(row,k,v)
    if data.periods is not None:
        if not data.periods:
            raise HTTPException(400,"شیفت باید دست‌کم یک زنگ داشته باشد")
        db.execute(delete(ShiftPeriod).where(ShiftPeriod.shift_id==row.id))
        row.periods_count=len(data.periods)
        row.starts_at=data.periods[0].starts_at
        for number,period in enumerate(data.periods,1):
            db.add(ShiftPeriod(shift_id=row.id,period_number=number,starts_at=period.starts_at,ends_at=period.ends_at))
    log_action(db,user,"shift_updated","shift",str(row.id)); db.commit(); db.refresh(row); return {"ok":True}

@router.get("/classes")
def list_classes(user: User = Depends(admin_dep), db: Session = Depends(get_db)):
    rows = db.execute(select(Classroom, SchoolShift).join(SchoolShift).where(Classroom.school_id == user.school_id).order_by(SchoolShift.id, Classroom.name)).all()
    return [{"id": c.id, "name": c.name, "grade": c.grade, "field": c.field, "shift_id": c.shift_id, "shift_name": s.name, "periods_count": s.periods_count, "periods":[{"period_number":p.period_number,"starts_at":p.starts_at,"ends_at":p.ends_at} for p in s.periods], "is_active": c.is_active} for c,s in rows]

@router.post("/classes")
def create_class(data: ClassCreate, user: User = Depends(admin_dep), db: Session = Depends(get_db)):
    shift = db.scalar(select(SchoolShift).where(SchoolShift.id == data.shift_id, SchoolShift.school_id == user.school_id))
    if not shift: raise HTTPException(404,"شیفت پیدا نشد")
    row = Classroom(school_id=user.school_id, **data.model_dump())
    db.add(row); log_action(db,user,"class_created","class"); db.commit(); db.refresh(row); return row

@router.get("/users")
def list_users(user: User = Depends(admin_dep), db: Session = Depends(get_db)):
    users = db.scalars(select(User).where(User.school_id == user.school_id).order_by(User.role, User.full_name)).all()
    out=[]
    for u in users:
        ass = db.execute(select(TeacherAssignment, Classroom).join(Classroom).where(TeacherAssignment.teacher_id == u.id)).all()
        out.append({"id":u.id,"full_name":u.full_name,"phone":u.phone,"personnel_code":u.personnel_code,"role":u.role.value,"is_active":u.is_active,"assignments":[{"id":a.id,"classroom_id":c.id,"class_name":c.name,"subject":a.subject} for a,c in ass]})
    return out

@router.post("/users")
def create_user(data: UserCreate, user: User = Depends(require_roles(UserRole.MANAGER)), db: Session = Depends(get_db)):
    if data.role == UserRole.PLATFORM_ADMIN: raise HTTPException(400,"نقش نامعتبر")
    personnel_code=(data.personnel_code or "").strip()
    if data.role != UserRole.MANAGER and not personnel_code:
        raise HTTPException(400,"برای کارکنان کد پرسنلی الزامی است و همان کد به‌عنوان رمز اولیه استفاده می‌شود")
    if data.role == UserRole.MANAGER and not data.password:
        raise HTTPException(400,"برای مدیر مدرسه رمز عبور جداگانه وارد کنید")
    if db.scalar(select(User).where(User.school_id == user.school_id, User.phone == data.phone.strip())):
        raise HTTPException(409,"این شماره موبایل قبلاً ثبت شده")
    password=data.password if data.role==UserRole.MANAGER else personnel_code
    if password is None:
        raise HTTPException(400,"رمز عبور مدیر مدرسه را وارد کنید")
    row = User(school_id=user.school_id, full_name=data.full_name, phone=data.phone.strip(), personnel_code=personnel_code or None, role=data.role, hashed_password=hash_password(password), must_change_password=data.role!=UserRole.MANAGER)
    db.add(row); db.flush()
    if data.role == UserRole.TEACHER:
        for a in data.assignments:
            classroom_id=int(a.get("classroom_id")); subject=str(a.get("subject") or "عمومی")
            c=db.scalar(select(Classroom).where(Classroom.id==classroom_id, Classroom.school_id==user.school_id))
            if c: db.add(TeacherAssignment(school_id=user.school_id, teacher_id=row.id, classroom_id=c.id, subject=subject))
    log_action(db,user,"user_created","user",str(row.id),{"role":row.role.value}); db.commit(); db.refresh(row); return {"id":row.id}

@router.patch("/users/{user_id}")
def update_user(user_id:int, data:UserUpdate, user:User=Depends(require_roles(UserRole.MANAGER)), db:Session=Depends(get_db)):
    row=db.scalar(select(User).where(User.id==user_id, User.school_id==user.school_id))
    if not row: raise HTTPException(404,"کاربر پیدا نشد")
    vals=data.model_dump(exclude_unset=True)
    password=vals.pop("password",None)
    if "full_name" in vals:
        vals["full_name"]=vals["full_name"].strip()
        if not vals["full_name"]:
            raise HTTPException(400,"نام کاربر الزامی است")
    if "phone" in vals:
        vals["phone"]=vals["phone"].strip()
        if not vals["phone"]:
            raise HTTPException(400,"شماره موبایل الزامی است")
    next_phone=vals.get("phone",row.phone)
    duplicate_phone=db.scalar(select(User.id).where(User.school_id==user.school_id,User.phone==next_phone,User.id!=row.id))
    if duplicate_phone:
        raise HTTPException(409,"این شماره موبایل قبلاً ثبت شده")
    next_role=vals.get("role",row.role)
    next_code=vals.get("personnel_code",row.personnel_code)
    if next_role!=UserRole.MANAGER:
        if not next_code or not str(next_code).strip():
            raise HTTPException(400,"برای کارکنان کد پرسنلی الزامی است")
        next_code=str(next_code).strip()
        vals["personnel_code"]=next_code
        duplicate_code=db.scalar(select(User.id).where(User.school_id==user.school_id,User.personnel_code==next_code,User.id!=row.id))
        if duplicate_code:
            raise HTTPException(409,"این کد پرسنلی قبلاً ثبت شده")
        if password and password!=str(next_code).strip():
            raise HTTPException(400,"رمز کارکنان باید با کد پرسنلی یکسان باشد")
    elif row.role!=UserRole.MANAGER and not password:
        raise HTTPException(400,"برای تبدیل نقش به مدیر، رمز عبور جداگانه وارد کنید")
    for k,v in vals.items(): setattr(row,k,v)
    if next_role!=UserRole.MANAGER:
        row.hashed_password=hash_password(str(next_code).strip()); row.must_change_password=True
    elif password:
        row.hashed_password=hash_password(password); row.must_change_password=False
    log_action(db,user,"user_updated","user",str(row.id)); db.commit(); return {"ok":True}

@router.post("/users/{user_id}/assignments")
def set_assignments(user_id:int, assignments:list[dict], user:User=Depends(require_roles(UserRole.MANAGER)), db:Session=Depends(get_db)):
    teacher=db.scalar(select(User).where(User.id==user_id, User.school_id==user.school_id, User.role==UserRole.TEACHER))
    if not teacher: raise HTTPException(404,"معلم پیدا نشد")
    db.execute(delete(TeacherAssignment).where(TeacherAssignment.teacher_id==teacher.id))
    for a in assignments:
        cid=int(a.get("classroom_id")); subject=str(a.get("subject") or "عمومی")
        c=db.scalar(select(Classroom).where(Classroom.id==cid, Classroom.school_id==user.school_id))
        if c: db.add(TeacherAssignment(school_id=user.school_id, teacher_id=teacher.id, classroom_id=cid, subject=subject))
    log_action(db,user,"teacher_assignments_updated","user",str(teacher.id)); db.commit(); return {"ok":True}

@router.get("/staff-template")
def staff_template(user:User=Depends(require_roles(UserRole.MANAGER))):
    wb=Workbook(); ws=wb.active; ws.title="کارکنان"; ws.sheet_view.rightToLeft=True
    ws.append(["نام و نام خانوادگی","موبایل","کد پرسنلی","نقش","کلاس","درس","رمز اولیه"])
    ws.append(["محمد احمدی","09121111111","T100","معلم","7/1","ریاضی","T100"])
    ws.append(["محمد احمدی","09121111111","T100","معلم","7/2","ریاضی","T100"])
    ws.append(["علی رضایی","09122222222","D20","معاون","","","D20"])
    bio=BytesIO(); wb.save(bio); bio.seek(0)
    return StreamingResponse(bio,media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",headers={"Content-Disposition":"attachment; filename=staff-template.xlsx"})

@router.post("/staff/import")
def import_staff(file:UploadFile=File(...), user:User=Depends(require_roles(UserRole.MANAGER)), db:Session=Depends(get_db)):
    content=file.file.read(); wb=load_workbook(BytesIO(content),data_only=True); ws=wb.active
    headers={str(v).strip():i for i,v in enumerate(next(ws.iter_rows(values_only=True)))}
    aliases={"name":["نام و نام خانوادگی","full_name"],"phone":["موبایل","phone"],"code":["کد پرسنلی","personnel_code"],"role":["نقش","role"],"class":["کلاس","class_name"],"subject":["درس","subject"],"password":["رمز اولیه","password"]}
    def idx(key):
        for a in aliases[key]:
            if a in headers:return headers[a]
        return None
    if any(idx(k) is None for k in ["name","phone","role"]): raise HTTPException(400,"ستون‌های نام، موبایل و نقش الزامی‌اند")
    role_map={"معلم":UserRole.TEACHER,"teacher":UserRole.TEACHER,"معاون":UserRole.DEPUTY,"deputy":UserRole.DEPUTY,"مدیر":UserRole.MANAGER,"manager":UserRole.MANAGER}
    created=assignments=errors=0
    seen=set()
    for values in ws.iter_rows(values_only=True):
        if not values or not values[idx("phone")]: continue
        try:
            phone=str(values[idx("phone")]).strip(); name=str(values[idx("name")]).strip(); role_raw=str(values[idx("role")]).strip().lower(); role=role_map.get(role_raw)
            if not role: raise ValueError("role")
            personnel=str(values[idx("code")]).strip() if idx("code") is not None and values[idx("code")] is not None else None
            password=str(values[idx("password")]).strip() if idx("password") is not None and values[idx("password")] is not None else ""
            if role==UserRole.MANAGER and len(password)<8: raise ValueError("password")
            if role!=UserRole.MANAGER and not personnel: raise ValueError("personnel_code")
            staff=db.scalar(select(User).where(User.school_id==user.school_id,User.phone==phone))
            if not staff:
                initial_password=password if role==UserRole.MANAGER else personnel
                staff=User(school_id=user.school_id,full_name=name,phone=phone,personnel_code=personnel,role=role,hashed_password=hash_password(initial_password),must_change_password=role!=UserRole.MANAGER)
                db.add(staff);db.flush();created+=1
            else:
                staff.full_name=name;staff.personnel_code=personnel or staff.personnel_code;staff.role=role
                if role!=UserRole.MANAGER:
                    staff.hashed_password=hash_password(staff.personnel_code)
                    staff.must_change_password=True
            if role==UserRole.TEACHER and idx("class") is not None and values[idx("class")]:
                class_name=str(values[idx("class")]).strip(); subject=str(values[idx("subject")]).strip() if idx("subject") is not None and values[idx("subject")] else "عمومی"
                classroom=db.scalar(select(Classroom).where(Classroom.school_id==user.school_id,Classroom.name==class_name))
                if not classroom: raise ValueError("class")
                key=(staff.id,classroom.id,subject)
                if key not in seen and not db.scalar(select(TeacherAssignment.id).where(TeacherAssignment.teacher_id==staff.id,TeacherAssignment.classroom_id==classroom.id,TeacherAssignment.subject==subject)):
                    db.add(TeacherAssignment(school_id=user.school_id,teacher_id=staff.id,classroom_id=classroom.id,subject=subject));assignments+=1;seen.add(key)
        except Exception:
            errors+=1
    log_action(db,user,"staff_imported","user",data={"created":created,"assignments":assignments,"errors":errors});db.commit()
    return {"created":created,"assignments":assignments,"errors":errors}

@router.get("/students")
def list_students(classroom_id:int|None=None, q:str|None=None, user:User=Depends(admin_dep), db:Session=Depends(get_db)):
    stmt=select(Student,Classroom).join(Classroom).where(Student.school_id==user.school_id)
    if classroom_id: stmt=stmt.where(Student.classroom_id==classroom_id)
    if q: stmt=stmt.where(Student.full_name.ilike(f"%{q}%"))
    rows=db.execute(stmt.order_by(Classroom.name,Student.full_name).limit(2000)).all()
    return [{"id":s.id,"student_code":s.student_code,"full_name":s.full_name,"guardian_name":s.guardian_name,"guardian_phone":s.guardian_phone,"classroom_id":c.id,"class_name":c.name,"grade":c.grade,"field":c.field,"is_active":s.is_active} for s,c in rows]

@router.post("/students")
def create_student(data:StudentCreate,user:User=Depends(admin_dep),db:Session=Depends(get_db)):
    code=data.student_code.strip()
    name=data.full_name.strip()
    if not code or not name:
        raise HTTPException(400,"کد و نام دانش‌آموز الزامی است")
    classroom=db.scalar(select(Classroom).where(Classroom.id==data.classroom_id,Classroom.school_id==user.school_id))
    if not classroom:
        raise HTTPException(404,"کلاس پیدا نشد")
    if db.scalar(select(Student.id).where(Student.school_id==user.school_id,Student.student_code==code)):
        raise HTTPException(409,"این کد دانش‌آموزی قبلاً ثبت شده است")
    row=Student(
        school_id=user.school_id,
        classroom_id=classroom.id,
        student_code=code,
        full_name=name,
        guardian_name=data.guardian_name.strip() if data.guardian_name and data.guardian_name.strip() else None,
        guardian_phone=data.guardian_phone.strip() if data.guardian_phone and data.guardian_phone.strip() else None,
        is_active=data.is_active,
    )
    db.add(row);db.flush()
    log_action(db,user,"student_created","student",str(row.id))
    db.commit();db.refresh(row)
    return {"id":row.id}

@router.patch("/students/{student_id}")
def update_student(student_id:int,data:StudentUpdate,user:User=Depends(admin_dep),db:Session=Depends(get_db)):
    row=db.scalar(select(Student).where(Student.id==student_id,Student.school_id==user.school_id))
    if not row:
        raise HTTPException(404,"دانش‌آموز پیدا نشد")
    values=data.model_dump(exclude_unset=True)
    if values.get("student_code") is None and "student_code" in values:
        raise HTTPException(400,"کد دانش‌آموزی نمی‌تواند خالی باشد")
    if values.get("full_name") is None and "full_name" in values:
        raise HTTPException(400,"نام دانش‌آموز نمی‌تواند خالی باشد")
    if values.get("is_active") is None and "is_active" in values:
        raise HTTPException(400,"وضعیت دانش‌آموز نامعتبر است")
    if "student_code" in values:
        values["student_code"]=values["student_code"].strip()
        if not values["student_code"]:
            raise HTTPException(400,"کد دانش‌آموزی نمی‌تواند خالی باشد")
        duplicate=db.scalar(select(Student.id).where(Student.school_id==user.school_id,Student.student_code==values["student_code"],Student.id!=row.id))
        if duplicate:
            raise HTTPException(409,"این کد دانش‌آموزی قبلاً ثبت شده است")
    if "full_name" in values:
        values["full_name"]=values["full_name"].strip()
        if not values["full_name"]:
            raise HTTPException(400,"نام دانش‌آموز نمی‌تواند خالی باشد")
    if "classroom_id" in values:
        classroom=db.scalar(select(Classroom).where(Classroom.id==values["classroom_id"],Classroom.school_id==user.school_id))
        if not classroom:
            raise HTTPException(404,"کلاس پیدا نشد")
    for field in ("guardian_name","guardian_phone"):
        if field in values:
            values[field]=values[field].strip() or None if values[field] else None
    for key,value in values.items():
        setattr(row,key,value)
    log_action(db,user,"student_updated","student",str(row.id))
    db.commit()
    return {"ok":True}

@router.get("/student-template")
def student_template(user:User=Depends(admin_dep)):
    wb=Workbook(); ws=wb.active; ws.title="دانش‌آموزان"; ws.sheet_view.rightToLeft=True
    ws.append(["کد دانش‌آموزی","نام و نام خانوادگی","پایه","رشته","کلاس","شیفت","نام ولی","موبایل ولی"])
    ws.append(["1001","علی رضایی","هفتم","","7/1","صبح","رضا رضایی","09121234567"])
    bio=BytesIO(); wb.save(bio); bio.seek(0)
    return StreamingResponse(bio,media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",headers={"Content-Disposition":"attachment; filename=students-template.xlsx"})

@router.post("/students/import")
def import_students(file:UploadFile=File(...), user:User=Depends(admin_dep), db:Session=Depends(get_db)):
    content=file.file.read(); wb=load_workbook(BytesIO(content),data_only=True); ws=wb.active
    headers={str(v).strip():i for i,v in enumerate(next(ws.iter_rows(values_only=True)))}
    aliases={
      "code":["کد دانش‌آموزی","student_code"],"name":["نام و نام خانوادگی","full_name"],"grade":["پایه","grade"],"field":["رشته","field"],"class":["کلاس","class_name"],"shift":["شیفت","shift_name"],"guardian":["نام ولی","guardian_name"],"phone":["موبایل ولی","guardian_phone"]}
    def idx(key):
        for a in aliases[key]:
            if a in headers:return headers[a]
        return None
    required=["code","name","class","shift"]
    if any(idx(k) is None for k in required): raise HTTPException(400,"ستون‌های الزامی فایل کامل نیست")
    created=updated=errors=0
    seen_codes=set()
    for values in ws.iter_rows(min_row=2,values_only=True):
        if not values or not values[idx("code")]: continue
        try:
            code=str(values[idx("code")]).strip(); name=str(values[idx("name")]).strip(); class_name=str(values[idx("class")]).strip(); shift_name=str(values[idx("shift")]).strip()
            if code in seen_codes:
                errors+=1
                continue
            seen_codes.add(code)
            shift=db.scalar(select(SchoolShift).where(SchoolShift.school_id==user.school_id,SchoolShift.name==shift_name))
            if not shift: raise ValueError(f"شیفت {shift_name} تعریف نشده")
            classroom=db.scalar(select(Classroom).where(Classroom.school_id==user.school_id,Classroom.shift_id==shift.id,Classroom.name==class_name))
            if not classroom:
                classroom=Classroom(school_id=user.school_id,shift_id=shift.id,name=class_name,grade=(str(values[idx('grade')]).strip() if idx('grade') is not None and values[idx('grade')] is not None else None),field=(str(values[idx('field')]).strip() if idx('field') is not None and values[idx('field')] is not None else None)); db.add(classroom); db.flush()
            student=db.scalar(select(Student).where(Student.school_id==user.school_id,Student.student_code==code))
            payload=dict(classroom_id=classroom.id,full_name=name,guardian_name=(str(values[idx('guardian')]).strip() if idx('guardian') is not None and values[idx('guardian')] is not None else None),guardian_phone=(str(values[idx('phone')]).strip() if idx('phone') is not None and values[idx('phone')] is not None else None))
            if student:
                for k,v in payload.items():setattr(student,k,v)
                updated+=1
            else:
                db.add(Student(school_id=user.school_id,student_code=code,**payload)); created+=1
        except Exception:
            errors+=1
    log_action(db,user,"students_imported","student",data={"created":created,"updated":updated,"errors":errors}); db.commit()
    return {"created":created,"updated":updated,"errors":errors}
