from __future__ import annotations
from datetime import date, datetime, time
from pydantic import BaseModel, Field, ConfigDict, model_validator
from .models import UserRole, AttendanceStatus

class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class ShiftPeriodIn(BaseModel):
    starts_at: time
    ends_at: time

    @model_validator(mode="after")
    def validate_period(self):
        if self.starts_at >= self.ends_at:
            raise ValueError("زمان پایان هر زنگ باید بعد از زمان شروع آن باشد")
        return self

class ShiftIn(BaseModel):
    name: str
    starts_at: time | None = None
    periods_count: int = Field(ge=1, le=12, default=4)
    periods: list[ShiftPeriodIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_periods(self):
        if self.periods:
            if len(self.periods) != self.periods_count:
                raise ValueError("برای هر زنگ باید یک بازه زمانی وارد شود")
            for previous, current in zip(self.periods, self.periods[1:]):
                if previous.starts_at >= current.starts_at or previous.ends_at > current.starts_at:
                    raise ValueError("زنگ‌ها باید به ترتیب زمانی باشند و با هم تداخل نداشته باشند")
        return self

class RegisterSchoolIn(BaseModel):
    school_name: str
    school_code: str = Field(min_length=3, max_length=32)
    city: str | None = None
    school_phone: str | None = None
    manager_name: str
    manager_phone: str
    password: str = Field(min_length=8)
    shifts: list[ShiftIn]

class LoginIn(BaseModel):
    school_code: str | None = None
    phone: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class UserCreate(BaseModel):
    full_name: str
    phone: str
    personnel_code: str | None = None
    role: UserRole
    password: str | None = Field(default=None, min_length=8)
    assignments: list[dict] = []

class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    personnel_code: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)

class ClassCreate(BaseModel):
    name: str
    grade: str | None = None
    field: str | None = None
    shift_id: int

class StudentCreate(BaseModel):
    student_code: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=150)
    classroom_id: int = Field(ge=1)
    guardian_name: str | None = Field(default=None, max_length=150)
    guardian_phone: str | None = Field(default=None, max_length=30)
    is_active: bool = True

class StudentUpdate(BaseModel):
    student_code: str | None = Field(default=None, min_length=1, max_length=50)
    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    classroom_id: int | None = Field(default=None, ge=1)
    guardian_name: str | None = Field(default=None, max_length=150)
    guardian_phone: str | None = Field(default=None, max_length=30)
    is_active: bool | None = None

class ShiftCreate(ShiftIn):
    pass

class ShiftUpdate(BaseModel):
    name: str | None = None
    periods: list[ShiftPeriodIn] | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_periods(self):
        if self.periods is not None:
            for previous, current in zip(self.periods, self.periods[1:]):
                if previous.starts_at >= current.starts_at or previous.ends_at > current.starts_at:
                    raise ValueError("زنگ‌ها باید به ترتیب زمانی باشند و با هم تداخل نداشته باشند")
        return self

class AttendanceRecordIn(BaseModel):
    student_id: int
    status: AttendanceStatus = AttendanceStatus.ABSENT
    reason: str | None = None

class AttendanceSubmitIn(BaseModel):
    classroom_id: int
    attendance_date: date
    period_number: int = Field(ge=1, le=12)
    subject: str | None = None
    note: str | None = None
    records: list[AttendanceRecordIn] = []

class ReminderIn(BaseModel):
    teacher_id: int
    classroom_id: int | None = None
    period_number: int | None = None
    send_sms: bool = False

class SubscriptionRequestIn(BaseModel):
    months: int = Field(ge=1, le=12)
    amount_toman: int | None = None
    reference: str | None = None
    note: str | None = None

class SubscriptionApproveIn(BaseModel):
    days: int = Field(ge=1, le=730)
