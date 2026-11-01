import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, BellRing, CalendarCheck, CalendarOff, CheckCircle2, ClipboardList, Clock, GraduationCap, Send, UserX, Users } from 'lucide-react'
import { api, getError } from '../api'
import type { Assignment, ClassRoom, CurrentUser, DashboardData, StaffUser } from '../types'
import StatCard from '../components/StatCard'
import { Alert, Badge, Button, Card, EmptyState, Field, PageHeader, SectionHeader, Skeleton, useToast } from '../components/ui'
import { dateFa, num, shortDayFa, tehranTimeMinutes, weekdayFa } from '../lib/format'

export default function Dashboard({ user }: { user: CurrentUser }) {
  if (user.role === 'teacher') return <TeacherHome user={user} />
  return <ManagerHome user={user} />
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'صبح بخیر' : h < 17 ? 'روز بخیر' : 'عصر بخیر'
}

function ManagerHome({ user }: { user: CurrentUser }) {
  const [d, setD] = useState<DashboardData | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.get('/dashboard/today').then(r => setD(r.data)).catch(e => setErr(getError(e))) }, [])

  const submitted = useMemo(() => d ? d.classes.reduce((a, c) => a + c.periods.filter(p => p.submitted).length, 0) : 0, [d])
  const firstName = user.full_name.split(' ')[0]
  const header = (
    <PageHeader
      eyebrow={<><CalendarCheck size={15} />{dateFa(new Date(), 'full')}</>}
      title={`${greeting()}، ${firstName}`}
      description="وضعیت ثبت حضور و غیاب مدرسه در امروز"
      actions={<Link className="btn btn-primary btn-md" to="/attendance"><ClipboardList size={17} />ثبت حضور و غیاب</Link>}
    />
  )

  if (err) return <>{header}<Alert tone="error" action={<Link className="btn btn-secondary btn-sm" to="/subscription">وضعیت اشتراک</Link>}>{err}</Alert></>
  if (!d) return <>{header}<DashboardSkeleton /></>

  const pending = d.expected_sessions - submitted
  return (
    <>
      {header}
      <div className="kpi-grid">
        <StatCard title="کل دانش‌آموزان" value={num(d.total_students)} icon={GraduationCap} tone="brand" sub="دانش‌آموزان ثبت‌شده در مدرسه" />
        <StatCard title="غیبت ثبت‌شده امروز" value={num(d.absent_records)} icon={UserX} tone="danger" sub="مجموع موارد غیبت امروز" />
        <StatCard title="دیرآمده امروز" value={num(d.late_records)} icon={Clock} tone="warning" sub="مجموع موارد تاخیر امروز" />
        <StatCard title="تکمیل حضور و غیاب" value={num(d.completion_percent)} unit="٪" icon={CheckCircle2} tone="success" progress={d.completion_percent}
          sub={`${num(submitted)} از ${num(d.expected_sessions)} کلاس/زنگ ثبت شده`} />
      </div>

      <div className="dash-grid">
        <Card className="card-flush">
          <SectionHeader icon={ClipboardList} title="وضعیت ثبت کلاس‌ها" description="هر زنگ یا ثبت شده است یا هنوز منتظر ثبت است"
            action={pending > 0 ? <Badge tone="warning" dot>{num(pending)} زنگ ثبت‌نشده</Badge> : <Badge tone="success" dot>همه ثبت شده‌اند</Badge>} />
          <div className="legend">
            <span><i style={{ background: 'var(--c-accent-500)' }} />ثبت‌شده</span>
            <span><i style={{ border: '1.5px dashed var(--c-border-strong)' }} />در انتظار ثبت</span>
          </div>
          {d.classes.length === 0
            ? <EmptyState icon={ClipboardList} title="هنوز کلاسی تعریف نشده" text="برای شروع، از بخش تنظیمات مدرسه کلاس‌ها را اضافه کنید." action={<Link className="btn btn-secondary btn-sm" to="/settings">تنظیمات مدرسه</Link>} />
            : d.classes.map(c => {
              const left = c.periods.filter(p => !p.submitted).length
              return (
                <div key={c.classroom_id} className={'class-row' + (left ? ' incomplete' : '')}>
                  <div>
                    <span className="class-name">{c.class_name}</span>
                    <span className="class-meta">{[c.grade, c.field, c.shift].filter(Boolean).join(' • ')}</span>
                  </div>
                  <div className="period-chips">
                    {c.periods.map(p => (
                      <span key={p.period} className={'chip ' + (p.submitted ? 'done' : 'pending')} title={p.submitted ? 'ثبت شده' : 'ثبت نشده'}>
                        {p.submitted ? <CheckCircle2 size={13} aria-hidden /> : <Clock size={13} aria-hidden />}
                        زنگ {num(p.period)}
                        <span className="sr-only">{p.submitted ? ' ثبت شده' : ' ثبت نشده'}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
        </Card>

        <div className="col">
          <Card>
            <SectionHeader icon={UserX} title="غیبت‌های ۷ روز اخیر" description="تعداد موارد غیبت ثبت‌شده در هر روز" />
            <WeeklyChart data={d.weekly} />
          </Card>
          <ReminderPanel />
        </div>
      </div>
    </>
  )
}

function WeeklyChart({ data }: { data: DashboardData['weekly'] }) {
  if (!data || data.length === 0) return <EmptyState icon={CalendarOff} title="داده‌ای برای نمایش نیست" text="پس از ثبت حضور و غیاب، روند غیبت‌ها اینجا نمایش داده می‌شود." />
  const total = data.reduce((a, x) => a + x.absences, 0)
  const max = Math.max(...data.map(x => x.absences))
  return (
    <>
      <div className="chart-box" role="img" aria-label={`نمودار غیبت ${num(data.length)} روز اخیر؛ مجموع ${num(total)} مورد`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#e6e2d8" strokeDasharray="3 4" />
            <XAxis dataKey="date" reversed axisLine={false} tickLine={false} tickMargin={8}
              tick={{ fill: '#76808f', fontSize: 12, fontFamily: 'inherit' }} tickFormatter={(v: string) => weekdayFa(v) || v} />
            <YAxis orientation="right" width={30} axisLine={false} tickLine={false} allowDecimals={false}
              tick={{ fill: '#76808f', fontSize: 12, fontFamily: 'inherit' }} tickFormatter={(v: number) => num(v)} />
            <Tooltip cursor={{ fill: 'rgba(19,32,58,.05)' }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as { date: string; absences: number }
              return <div className="chart-tip"><b>{dateFa(p.date, 'medium')}</b>{num(p.absences)} غیبت</div>
            }} />
            <Bar dataKey="absences" name="غیبت" radius={[6, 6, 2, 2]} maxBarSize={36}>
              {data.map((_, i) => <Cell key={i} fill={i === data.length - 1 ? '#c0463f' : '#e3a9a4'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="field-hint" style={{ marginTop: 8 }}>
        {total === 0 ? 'در این بازه غیبتی ثبت نشده است.' : `مجموع ${num(total)} غیبت؛ بیشترین در یک روز ${num(max)} مورد. ستون پررنگ مربوط به امروز است (${shortDayFa(data[data.length - 1].date)}).`}
      </p>
    </>
  )
}

function ReminderPanel() {
  const toast = useToast()
  const [users, setUsers] = useState<StaffUser[]>([])
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [teacher, setTeacher] = useState(0)
  const [classroom, setClassroom] = useState(0)
  const [period, setPeriod] = useState(1)
  const [sms, setSms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    Promise.all([api.get('/setup/users'), api.get('/setup/classes')]).then(([u, c]) => {
      const ts: StaffUser[] = u.data.filter((x: StaffUser) => x.role === 'teacher')
      setUsers(ts); setClasses(c.data)
      if (ts[0]) setTeacher(ts[0].id)
      if (c.data[0]) setClassroom(c.data[0].id)
    }).catch(e => setErr(getError(e))).finally(() => setLoading(false))
  }, [])

  const cls = classes.find(c => c.id === classroom)
  const periods = Math.max(1, cls?.periods_count || 8)

  async function send() {
    if (!teacher) return
    setBusy(true); setErr('')
    try {
      const r = await api.post('/notifications/reminder', { teacher_id: teacher, classroom_id: classroom || null, period_number: period, send_sms: sms })
      toast('success', r.data.sms_sent ? 'یادآوری داخل سامانه و پیامک ارسال شد.' : 'یادآوری داخل سامانه ثبت شد.')
    } catch (e) { setErr(getError(e)) } finally { setBusy(false) }
  }

  return (
    <Card>
      <SectionHeader icon={BellRing} title="یادآوری به معلم" description="برای کلاسی که هنوز ثبت نشده" />
      {err && <Alert tone="error" onClose={() => setErr('')}>{err}</Alert>}
      {loading ? <div className="stack"><Skeleton h={44} /><Skeleton h={44} /><Skeleton h={44} /></div>
        : users.length === 0 ? <EmptyState icon={Users} title="معلمی تعریف نشده" text="ابتدا از بخش «کاربران و معلمان» معلم اضافه کنید." />
        : (
          <div className="stack">
            <Field label="معلم">
              <select value={teacher} onChange={e => setTeacher(+e.target.value)}>{users.map(u => <option value={u.id} key={u.id}>{u.full_name}</option>)}</select>
            </Field>
            <div className="form-grid">
              <Field label="کلاس">
                <select value={classroom} onChange={e => { setClassroom(+e.target.value); setPeriod(1) }}>{classes.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
              </Field>
              <Field label="زنگ">
                <select value={period} onChange={e => setPeriod(+e.target.value)}>{Array.from({ length: periods }, (_, i) => <option value={i + 1} key={i}>زنگ {num(i + 1)}</option>)}</select>
              </Field>
            </div>
            <label className="switch-row">
              <input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} />
              <span><b>ارسال همزمان پیامک</b><small>علاوه بر اعلان داخل سامانه، پیامک هم ارسال می‌شود</small></span>
            </label>
            <Button variant="primary" icon={Send} loading={busy} onClick={send}>ارسال یادآوری</Button>
          </div>
        )}
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="kpi-grid">{[0, 1, 2, 3].map(i => <div className="kpi" key={i}><Skeleton h={14} w="50%" /><div style={{ height: 22 }} /><Skeleton h={34} w="40%" /><div style={{ height: 14 }} /><Skeleton h={10} w="70%" /></div>)}</div>
      <div className="dash-grid">
        <Card><div className="stack">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={36} />)}</div></Card>
        <Card><Skeleton h={240} /></Card>
      </div>
    </>
  )
}

function TeacherHome({ user }: { user: CurrentUser }) {
  const [a, setA] = useState<Assignment[] | null>(null)
  const [err, setErr] = useState('')
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { api.get('/me/assignments').then(r => setA(r.data)).catch(e => setErr(getError(e))) }, [])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const currentMinute = tehranTimeMinutes(now)
  const suggested = useMemo(() => (a || []).map(assignment => {
    const period = assignment.periods?.find(item => {
      if (!item.starts_at || !item.ends_at) return false
      const [startHour, startMinute] = item.starts_at.split(':').map(Number)
      const [endHour, endMinute] = item.ends_at.split(':').map(Number)
      const start = startHour * 60 + startMinute
      const end = endHour * 60 + endMinute
      return currentMinute >= start && currentMinute < end
    })
    return { ...assignment, currentPeriod: period?.period_number ?? null }
  }).sort((left, right) => Number(right.currentPeriod !== null) - Number(left.currentPeriod !== null)), [a, currentMinute])

  return (
    <>
      <PageHeader
        eyebrow={<><CalendarCheck size={15} />{dateFa(new Date(), 'full')}</>}
        title={`${greeting()}، ${user.full_name.split(' ')[0]}`}
        description="کلاس را انتخاب کنید، غایبین و دیرآمده‌ها را علامت بزنید و ثبت کنید."
      />
      {err && <Alert tone="error">{err}</Alert>}
      {!a && !err && <div className="class-tiles">{[0, 1, 2].map(i => <div className="class-tile" key={i}><Skeleton h={42} w={42} r={11} /><Skeleton h={22} w="50%" /><Skeleton h={14} w="70%" /></div>)}</div>}
      {a && a.length === 0 && <Card><EmptyState icon={ClipboardList} title="هنوز کلاسی به شما اختصاص داده نشده" text="از مدیر مدرسه بخواهید کلاس‌های شما را در بخش «کاربران و معلمان» تعریف کند." /></Card>}
      {a && a.length > 0 && (
        <>
        {suggested.some(item => item.currentPeriod !== null) && <div className="current-class-hint"><Clock size={17} />کلاس‌های دارای برنامه‌ی زمانی فعال در این لحظه، ابتدا نمایش داده شده‌اند.</div>}
        <div className="class-tiles">
          {suggested.map(x => (
            <Link className={`class-tile${x.currentPeriod !== null ? ' class-tile-current' : ''}`} key={x.assignment_id ?? `${x.classroom_id}-${x.subject}`} to={`/attendance?classroom_id=${x.classroom_id}`}>
              <div className="class-tile-top">
                <span className="tile-icon"><GraduationCap size={22} aria-hidden /></span>
                <span className="row">
                  <Badge tone="brand">{x.shift}</Badge>
                  {x.currentPeriod !== null && <Badge tone="success">اکنون · زنگ {num(x.currentPeriod)}</Badge>}
                </span>
              </div>
              <div><h3>{x.class_name}</h3><div className="subject">{x.subject || 'بدون عنوان درس'}</div></div>
              <div className="class-tile-foot">
                <span>{num(x.periods_count)} زنگ</span>
                <span className="class-tile-go">ثبت حضور و غیاب<ArrowLeft size={16} aria-hidden /></span>
              </div>
            </Link>
          ))}
        </div>
        </>
      )}
    </>
  )
}
