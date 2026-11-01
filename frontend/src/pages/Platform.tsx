import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Building2, CheckCircle2, GraduationCap, LogOut, ShieldCheck, Zap } from 'lucide-react'
import { api, getError } from '../api'
import { Alert, Badge, BrandMark, Button, Card, Dialog, EmptyState, Field, SectionHeader, TableSkeleton, useToast } from '../components/ui'
import type { Tone } from '../components/ui'
import StatCard from '../components/StatCard'
import { dateFa, num } from '../lib/format'

type School = { id: number; name: string; code: string; status: string; trial_ends_at?: string | null; subscription_ends_at?: string | null }
type Stats = { schools?: number; active_schools?: number; students?: number }
const STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'فعال', tone: 'success' },
  trial: { label: 'دوره آزمایشی', tone: 'info' },
  expired: { label: 'منقضی', tone: 'danger' },
}

export default function Platform() {
  const toast = useToast()
  const [schools, setSchools] = useState<School[] | null>(null)
  const [stats, setStats] = useState<Stats>({})
  const [err, setErr] = useState('')
  const [target, setTarget] = useState<School | null>(null)
  const [days, setDays] = useState('30')
  const [busy, setBusy] = useState(false)
  const [dErr, setDErr] = useState('')

  function load() {
    Promise.all([api.get('/subscription/admin/schools'), api.get('/platform/stats')])
      .then(([s, t]) => { setSchools(s.data); setStats(t.data); setErr('') })
      .catch(e => { setErr(getError(e)); setSchools(x => x ?? []) })
  }
  useEffect(load, [])

  async function activate(e: FormEvent) {
    e.preventDefault()
    if (!target) return
    const n = Number(days || 30)
    if (!Number.isInteger(n) || n < 1) return setDErr('تعداد روز باید عدد صحیح مثبت باشد.')
    setBusy(true); setDErr('')
    try {
      await api.post(`/subscription/admin/schools/${target.id}/activate`, { days: n })
      toast('success', `اشتراک «${target.name}» برای ${num(n)} روز فعال شد.`)
      setTarget(null); load()
    } catch (e) { setDErr(getError(e)) } finally { setBusy(false) }
  }
  function logout() { localStorage.clear(); location.href = '/login' }

  return (
    <div className="platform-shell">
      <div className="platform-top">
        <BrandMark size={32} /><b>FASTICK</b><span className="tagp"><ShieldCheck size={12} style={{ verticalAlign: -2 }} /> مدیریت پلتفرم</span>
        <Link className="btn btn-secondary btn-sm" to="/owner/insights"><Activity size={16} />آمار استفاده</Link>
        <Button variant="ghost" icon={LogOut} onClick={logout}>خروج</Button>
      </div>
      <div className="page">
        <header className="page-header"><div className="page-header-text"><h1>مدیریت پلتفرم فستیک</h1><p>مدارس، تست رایگان و تمدید دستی اشتراک.</p></div></header>
        {err && <Alert tone="error" onClose={() => setErr('')}>{err}</Alert>}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <StatCard title="مدارس" value={num(stats.schools || 0)} icon={Building2} tone="brand" />
          <StatCard title="مدارس فعال" value={num(stats.active_schools || 0)} icon={CheckCircle2} tone="success"
            progress={stats.schools ? ((stats.active_schools || 0) / stats.schools) * 100 : undefined} sub={stats.schools ? `از ${num(stats.schools)} مدرسه` : undefined} />
          <StatCard title="دانش‌آموزان" value={num(stats.students || 0)} icon={GraduationCap} tone="warning" />
        </div>
        <Card className="card-flush">
          <SectionHeader icon={Building2} title="مدارس" description="فعال‌سازی دستی اشتراک پس از دریافت پرداخت" />
          {schools === null ? <TableSkeleton rows={5} cols={5} />
            : schools.length === 0 ? <EmptyState icon={Building2} title="هنوز مدرسه‌ای ثبت‌نام نکرده" />
            : (
              <div className="table-wrap">
                <table className="table table-stack">
                  <thead><tr><th>مدرسه</th><th>کد</th><th>وضعیت</th><th>پایان تست</th><th>پایان اشتراک</th><th><span className="sr-only">عملیات</span></th></tr></thead>
                  <tbody>{schools.map(s => {
                    const st = STATUS[s.status] || { label: s.status, tone: 'neutral' as Tone }
                    return (
                      <tr key={s.id}>
                        <td className="cell-first"><span className="cell-primary">{s.name}</span></td>
                        <td data-label="کد"><span className="ltr">{s.code}</span></td>
                        <td data-label="وضعیت"><Badge tone={st.tone} dot>{st.label}</Badge></td>
                        <td data-label="پایان تست">{dateFa(s.trial_ends_at)}</td>
                        <td data-label="پایان اشتراک">{dateFa(s.subscription_ends_at)}</td>
                        <td><Button size="sm" variant="primary" icon={Zap} onClick={() => { setTarget(s); setDays('30'); setDErr('') }}>فعال‌سازی</Button></td>
                      </tr>)
                  })}</tbody>
                </table>
              </div>
            )}
        </Card>
      </div>

      <Dialog open={!!target} onClose={() => setTarget(null)} size="sm" title="فعال‌سازی اشتراک" description={target ? `مدرسه: ${target.name}` : undefined}
        footer={<><Button variant="ghost" onClick={() => setTarget(null)}>انصراف</Button><Button variant="primary" type="submit" form="activate-form" loading={busy}>تأیید و فعال‌سازی</Button></>}>
        <form id="activate-form" className="stack" onSubmit={activate}>
          {dErr && <Alert tone="error">{dErr}</Alert>}
          <Field label="تعداد روز فعال‌سازی" hint="مثلاً ۳۰ روز برای یک ماه"><input type="number" min={1} inputMode="numeric" required value={days} onChange={e => setDays(e.target.value)} /></Field>
        </form>
      </Dialog>
    </div>
  )
}
