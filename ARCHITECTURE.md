# Architecture

## Request flow

```text
Mobile/Desktop Browser
        │
        ▼
React SPA / PWA
        │ REST + JWT
        ▼
FastAPI
  ├─ Auth/RBAC
  ├─ Tenant Guard
  ├─ Attendance
  ├─ Excel/PDF
  ├─ Notifications
  └─ Subscription
        │
        ▼
PostgreSQL
```

## Tenant rule
Every school-owned row contains `school_id`. Never query a school-owned entity by primary key alone in a user-facing endpoint; pair it with `school_id == current_user.school_id`.

## Core relationships

```text
School 1─N SchoolShift
School 1─N User
School 1─N Classroom
Classroom 1─N Student
User(Teacher) N─N Classroom through TeacherAssignment
Classroom 1─N AttendanceSession
AttendanceSession 1─N AttendanceRecord
Student 1─N AttendanceRecord
```

## Attendance invariant
Unique session:

```text
(school_id, classroom_id, attendance_date, period_number)
```

A submitted session with zero attendance records means **all students present**.

## Scaling path
Phase 1: single VPS / Docker Compose.
Phase 2: PostgreSQL separate + Redis queue.
Phase 3: multiple API replicas + load balancer + managed DB/object storage.
