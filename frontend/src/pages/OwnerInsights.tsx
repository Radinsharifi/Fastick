import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, BarChart3, Building2, CalendarCheck, Eye, RefreshCw, Users } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, getError } from '../api'
import { Alert, Badge, Button, Card, EmptyState, SectionHeader, TableSkeleton } from '../components/ui'
import StatCard from '../components/StatCard'
import { dateFa, num } from '../lib/format'

type DailyMetric = {
  date: string
  active_schools: number
  active_users: number
  page_views: number
  attendance_submissions: number
  successful_logins: number
  sms_class_attempts: number
  new_schools: number
}

type SchoolActivity = {
  school_id: number
  name: string
  code: string
  page_views: number
  active_users: number
  last_activity: string | null
  logins: number
  attendance_submissions: number
  sms_class_attempts: number
  imports: number
}

type Insights = {
  period_days: number
  totals: {
    schools: number
    new_schools_30d: number
    active_schools_7d: number
    active_users_7d: number
    page_views_30d: number
    attendance_submissions_30d: number
    successful_logins_30d: number
  }
  daily: DailyMetric[]
  pages: { page: string; views: number }[]
  schools_activity: SchoolActivity[]
  note: string
}

export default function OwnerInsights() {
  const [data, setData] = useState<Insights | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(true)

  async function load() {
    setBusy(true)
    setErr('')
    try {
      const response = await api.get('/platform/analytics')
      setData(response.data)
    } catch (error) {
      setErr(getError(error))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <div className="platform-shell">
      <div className="platform-top">
        <Link className="btn btn-ghost btn-sm" to="/platform"><ArrowRight size={17} />بازگشت به مدیریت</Link>
        <b>FASTICK</b>
        <Badge tone="info">آمار خصوصی مالک</Badge>
        <Button className="owner-refresh" variant="ghost" icon={RefreshCw} loading={busy} onClick={load}>به‌روزرسانی</Button>
      </div>
      <div className="page owner-insights">
        <header className="page-header">
          <div className="page-header-text">
            <div className="eyebrow"><Activity size={15} />دید کلی محصول</div>
            <h1>آمار استفاده مدارس</h1>
            <p>فعالیت روزانه، استفاده از صفحه‌ها و میزان استفاده از فرایند حضور و غیاب در ۳۰ روز اخیر.</p>
          </div>
        </header>
        {err && <Alert tone="error" onClose={() => setErr('')}>{err}</Alert>}
        {!data && busy ? <TableSkeleton rows={5} cols={4} />
          : !data ? <EmptyState icon={BarChart3} title="آمار در دسترس نیست" text="اتصال را بررسی و دوباره تلاش کنید." action={<Button icon={RefreshCw} onClick={load}>تلاش دوباره</Button>} />
            : (
              <>
                <Alert tone="info">{data.note} بازدید صفحه‌ها به حساب کاربر و مدرسه مربوط می‌شود؛ نام دانش‌آموزان و جزئیات حضور و غیاب در آمار بازدید ثبت نمی‌شود.</Alert>
                <div className="kpi-grid owner-kpi-grid">
                  <StatCard title="مدارس ثبت‌شده" value={num(data.totals.schools)} icon={Building2} tone="brand" sub={`${num(data.totals.new_schools_30d)} مدرسه جدید در ۳۰ روز`} />
                  <StatCard title="مدارس فعال در ۷ روز" value={num(data.totals.active_schools_7d)} icon={Activity} tone="success" />
                  <StatCard title="کاربران فعال در ۷ روز" value={num(data.totals.active_users_7d)} icon={Users} tone="success" />
                  <StatCard title="ثبت‌های حضور در ۳۰ روز" value={num(data.totals.attendance_submissions_30d)} icon={CalendarCheck} tone="warning" />
                  <StatCard title="بازدید صفحه‌ها" value={num(data.totals.page_views_30d)} icon={Eye} tone="brand" sub={`${num(data.totals.successful_logins_30d)} ورود موفق`} />
                </div>

                <Card>
                  <SectionHeader icon={Activity} title="روند روزانه" description="آمار به تفکیک روز؛ تاریخ‌ها بر اساس تقویم شمسی نمایش داده می‌شوند." />
                  <div className="owner-chart" role="img" aria-label="نمودار فعالیت مدارس و ثبت حضور">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#e6e2d8" strokeDasharray="3 4" />
                        <XAxis dataKey="date" reversed axisLine={false} tickLine={false} tickMargin={8} interval="preserveStartEnd"
                          tick={{ fill: '#76808f', fontSize: 11, fontFamily: 'inherit' }} tickFormatter={(value: string) => dateFa(value, 'short')} />
                        <YAxis orientation="right" width={34} axisLine={false} tickLine={false} allowDecimals={false}
                          tick={{ fill: '#76808f', fontSize: 11, fontFamily: 'inherit' }} tickFormatter={(value: number) => num(value)} />
                        <Tooltip labelFormatter={(value: string) => dateFa(value)} formatter={(value: number, name: string) => [num(value), name]} />
                        <Area type="monotone" dataKey="active_schools" name="مدرسه فعال" stroke="#12a08b" fill="#12a08b" fillOpacity={0.12} />
                        <Area type="monotone" dataKey="attendance_submissions" name="ثبت حضور" stroke="#335f94" fill="#335f94" fillOpacity={0.08} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <div className="owner-insights-grid">
                  <Card className="card-flush">
                    <SectionHeader icon={Eye} title="صفحه‌های پربازدید" description="بازدیدهای ثبت‌شده در ۳۰ روز اخیر" />
                    {data.pages.length === 0 ? <EmptyState icon={Eye} title="هنوز بازدیدی ثبت نشده" text="با استفاده کاربران از صفحه‌های مدرسه، آمار این بخش نمایش داده می‌شود." />
                      : <div className="table-wrap"><table className="table table-stack">
                        <thead><tr><th>مسیر</th><th className="cell-num">بازدید</th></tr></thead>
                        <tbody>{data.pages.map(row => <tr key={row.page}><td className="cell-first"><code dir="ltr">{row.page}</code></td><td className="cell-num">{num(row.views)}</td></tr>)}</tbody>
                      </table></div>}
                  </Card>
                  <Card className="card-flush">
                    <SectionHeader icon={Building2} title="فعالیت مدارس" description="خلاصه ۳۰ روز اخیر؛ حداکثر ۵۰ مدرسه" />
                    {data.schools_activity.length === 0 ? <EmptyState icon={Building2} title="مدرسه‌ای برای نمایش نیست" />
                      : <div className="table-wrap"><table className="table table-stack">
                        <thead><tr><th>مدرسه</th><th>فعالیت</th><th>آخرین فعالیت</th></tr></thead>
                        <tbody>{data.schools_activity.map(school => (
                          <tr key={school.school_id}>
                            <td className="cell-first"><span className="cell-primary">{school.name}</span><span className="cell-sub ltr">{school.code}</span></td>
                            <td data-label="فعالیت"><span className="cell-sub">{num(school.active_users)} کاربر · {num(school.logins)} ورود · {num(school.attendance_submissions)} ثبت حضور</span><span className="cell-sub">{num(school.page_views)} بازدید صفحه</span></td>
                            <td data-label="آخرین فعالیت">{school.last_activity ? dateFa(school.last_activity) : 'بدون فعالیت اخیر'}</td>
                          </tr>
                        ))}</tbody>
                      </table></div>}
                  </Card>
                </div>
              </>
            )}
      </div>
    </div>
  )
}
