from datetime import datetime, timedelta, timezone, time
from sqlalchemy import select
from .db import Base, engine, SessionLocal
from .models import School, SchoolShift, Classroom, Student, User, UserRole, TeacherAssignment, SubscriptionStatus
from .auth import hash_password

Base.metadata.create_all(engine)
db=SessionLocal()
try:
    school=db.scalar(select(School).where(School.code=='demo'))
    if school:
        print('Demo already exists: school_code=demo')
    else:
        school=School(name='دبیرستان نمونه امید',code='demo',city='تهران',subscription_status=SubscriptionStatus.TRIAL,trial_ends_at=datetime.now(timezone.utc)+timedelta(days=30))
        db.add(school);db.flush()
        morning=SchoolShift(school_id=school.id,name='صبح',starts_at=time(7,30),periods_count=4);db.add(morning);db.flush()
        c1=Classroom(school_id=school.id,shift_id=morning.id,name='7/1',grade='هفتم');c2=Classroom(school_id=school.id,shift_id=morning.id,name='7/2',grade='هفتم')
        db.add_all([c1,c2]);db.flush()
        manager=User(school_id=school.id,full_name='مدیر نمونه',phone='09120000001',personnel_code='M1',hashed_password=hash_password('Demo12345!'),role=UserRole.MANAGER)
        deputy=User(school_id=school.id,full_name='معاون نمونه',phone='09120000002',personnel_code='D1',hashed_password=hash_password('D1'),role=UserRole.DEPUTY)
        teacher=User(school_id=school.id,full_name='معلم نمونه',phone='09120000003',personnel_code='T1',hashed_password=hash_password('T1'),role=UserRole.TEACHER)
        db.add_all([manager,deputy,teacher]);db.flush()
        db.add_all([TeacherAssignment(school_id=school.id,teacher_id=teacher.id,classroom_id=c1.id,subject='ریاضی'),TeacherAssignment(school_id=school.id,teacher_id=teacher.id,classroom_id=c2.id,subject='ریاضی')])
        names=['علی رضایی','محمد محمدی','امیرحسین کریمی','سارا احمدی','زهرا موسوی','پارسا قاسمی','نسترن عباسی','مهدی نادری','آراد کاظمی','یسنا مرادی']
        for i,name in enumerate(names,1):
            db.add(Student(school_id=school.id,classroom_id=c1.id if i<=5 else c2.id,student_code=f'10{i:02d}',full_name=name,guardian_name=f'ولی {name}',guardian_phone='09121111111'))
        db.commit()
        print('Demo created.')
    print('Manager: school=demo phone=09120000001 password=Demo12345!')
    print('Deputy : school=demo phone=09120000002 password=Demo12345!')
    print('Teacher: school=demo phone=09120000003 password=Demo12345!')
finally:
    db.close()
