export type Role='platform_admin'|'manager'|'deputy'|'teacher';
export type CurrentUser={id:number;full_name:string;phone?:string;role:Role;school?:{id:number;name:string;code:string;subscription_status:string;trial_ends_at?:string;subscription_ends_at?:string};unread_notifications?:number}

export type DashboardPeriod = { period: number; submitted: boolean }
export type DashboardClass = { classroom_id: number; class_name: string; grade?: string | null; field?: string | null; shift: string; periods: DashboardPeriod[] }
export type DashboardData = {
  total_students: number
  absent_records: number
  late_records: number
  completion_percent: number
  expected_sessions: number
  classes: DashboardClass[]
  weekly: { date: string; absences: number }[]
}
export type ShiftPeriod = { period_number: number; starts_at: string | null; ends_at: string | null }
export type ClassRoom = { id: number; name: string; grade?: string | null; field?: string | null; shift_id?: number; shift_name: string; periods_count: number; periods?: ShiftPeriod[]; class_name?: string }
export type Assignment = { assignment_id?: number; classroom_id: number; class_name: string; subject: string; shift: string; periods_count: number; periods?: ShiftPeriod[] }
export type StaffUser = { id: number; full_name: string; phone: string; role: Role; personnel_code?: string | null; is_active?: boolean; assignments?: { id?: number; classroom_id: number; class_name: string; subject: string }[] }
export type Shift = { id: number; name: string; starts_at?: string | null; periods_count: number; periods?: ShiftPeriod[] }
export type Student = { id: number; student_code: string; full_name: string; classroom_id: number; class_name: string; grade?: string | null; field?: string | null; guardian_name?: string | null; guardian_phone?: string | null; is_active?: boolean }
export type AppNotification = { id: number; title: string; message: string; created_at: string; read_at?: string | null }
