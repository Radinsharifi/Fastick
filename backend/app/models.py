from __future__ import annotations
from datetime import date, datetime, time
from enum import Enum
from sqlalchemy import (
    String, Integer, Date, DateTime, Time, ForeignKey, Boolean, Text, UniqueConstraint,
    Index, Enum as SAEnum, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

class UserRole(str, Enum):
    PLATFORM_ADMIN = "platform_admin"
    MANAGER = "manager"
    DEPUTY = "deputy"
    TEACHER = "teacher"

class AttendanceStatus(str, Enum):
    ABSENT = "absent"
    EXCUSED = "excused"
    LATE = "late"

class SubscriptionStatus(str, Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    EXPIRED = "expired"
    SUSPENDED = "suspended"

class School(Base):
    __tablename__ = "schools"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    subscription_status: Mapped[SubscriptionStatus] = mapped_column(SAEnum(SubscriptionStatus), default=SubscriptionStatus.TRIAL)
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    subscription_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    users = relationship("User", back_populates="school", cascade="all,delete-orphan")
    shifts = relationship("SchoolShift", back_populates="school", cascade="all,delete-orphan")
    classes = relationship("Classroom", back_populates="school", cascade="all,delete-orphan")

class SchoolShift(Base):
    __tablename__ = "school_shifts"
    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_shift_school_name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    starts_at: Mapped[time | None] = mapped_column(Time, nullable=True)
    periods_count: Mapped[int] = mapped_column(Integer, default=4)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    school = relationship("School", back_populates="shifts")
    classes = relationship("Classroom", back_populates="shift")
    periods = relationship("ShiftPeriod", back_populates="shift", cascade="all,delete-orphan", order_by="ShiftPeriod.period_number")

class ShiftPeriod(Base):
    __tablename__ = "shift_periods"
    __table_args__ = (
        UniqueConstraint("shift_id", "period_number", name="uq_shift_period_number"),
        Index("ix_shift_periods_shift", "shift_id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    shift_id: Mapped[int] = mapped_column(ForeignKey("school_shifts.id", ondelete="CASCADE"), index=True)
    period_number: Mapped[int] = mapped_column(Integer)
    starts_at: Mapped[time | None] = mapped_column(Time, nullable=True)
    ends_at: Mapped[time | None] = mapped_column(Time, nullable=True)
    shift = relationship("SchoolShift", back_populates="periods")

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("school_id", "phone", name="uq_user_school_phone"),
        UniqueConstraint("school_id", "personnel_code", name="uq_user_school_personnel"),
        Index("ix_users_school_role", "school_id", "role"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int | None] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str] = mapped_column(String(30), index=True)
    personnel_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    school = relationship("School", back_populates="users")
    assignments = relationship("TeacherAssignment", back_populates="teacher", cascade="all,delete-orphan")

class Classroom(Base):
    __tablename__ = "classrooms"
    __table_args__ = (
        UniqueConstraint("school_id", "shift_id", "name", name="uq_class_school_shift_name"),
        Index("ix_classrooms_school_shift", "school_id", "shift_id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    shift_id: Mapped[int] = mapped_column(ForeignKey("school_shifts.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    grade: Mapped[str | None] = mapped_column(String(50), nullable=True)
    field: Mapped[str | None] = mapped_column(String(80), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    school = relationship("School", back_populates="classes")
    shift = relationship("SchoolShift", back_populates="classes")
    students = relationship("Student", back_populates="classroom")
    assignments = relationship("TeacherAssignment", back_populates="classroom", cascade="all,delete-orphan")

class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("school_id", "student_code", name="uq_student_school_code"),
        Index("ix_students_school_class", "school_id", "classroom_id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="RESTRICT"), index=True)
    student_code: Mapped[str] = mapped_column(String(50))
    full_name: Mapped[str] = mapped_column(String(150), index=True)
    guardian_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    guardian_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    classroom = relationship("Classroom", back_populates="students")

class TeacherAssignment(Base):
    __tablename__ = "teacher_assignments"
    __table_args__ = (
        UniqueConstraint("teacher_id", "classroom_id", "subject", name="uq_teacher_class_subject"),
        Index("ix_assignment_school_teacher", "school_id", "teacher_id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    subject: Mapped[str] = mapped_column(String(100), default="عمومی")
    teacher = relationship("User", back_populates="assignments")
    classroom = relationship("Classroom", back_populates="assignments")

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"
    __table_args__ = (
        UniqueConstraint("school_id", "classroom_id", "attendance_date", "period_number", name="uq_attendance_session"),
        Index("ix_sessions_school_date", "school_id", "attendance_date"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    attendance_date: Mapped[date] = mapped_column(Date, index=True)
    period_number: Mapped[int] = mapped_column(Integer)
    subject: Mapped[str | None] = mapped_column(String(100), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    records = relationship("AttendanceRecord", back_populates="session", cascade="all,delete-orphan")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("session_id", "student_id", name="uq_session_student"),
        Index("ix_records_school_student", "school_id", "student_id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("attendance_sessions.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    status: Mapped[AttendanceStatus] = mapped_column(SAEnum(AttendanceStatus), default=AttendanceStatus.ABSENT)
    reason: Mapped[str | None] = mapped_column(String(250), nullable=True)
    parent_sms_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    session = relationship("AttendanceSession", back_populates="records")
    student = relationship("Student")

class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_recipient_read", "recipient_id", "read_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(150))
    message: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(50), default="info")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class SubscriptionRequest(Base):
    __tablename__ = "subscription_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    requested_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    months: Mapped[int] = mapped_column(Integer, default=1)
    amount_toman: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_school_created", "school_id", "created_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int | None] = mapped_column(ForeignKey("schools.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    entity: Mapped[str | None] = mapped_column(String(80), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

class UsageEvent(Base):
    __tablename__ = "usage_events"
    __table_args__ = (
        Index("ix_usage_created_at", "created_at"),
        Index("ix_usage_school_created", "school_id", "created_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(30))
    event: Mapped[str] = mapped_column(String(40))
    page: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)
