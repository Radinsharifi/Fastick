import { useEffect, useState } from 'react'
import { BadgeCheck, CalendarClock, CircleAlert, FlaskConical, Send } from 'lucide-react'
import { api, getError } from '../api'
import { Alert, Button, Card, PageHeader, SectionHeader, Skeleton } from '../components/ui'
import { daysUntil, dateFa, num } from '../lib/format'

type Sub = { status: string; trial_ends_at?: string | null; subscription_ends_at?: string | null }

export default function Subscription() {
  const [s, setS] = useState<Sub | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  function load() { api.get('/subscription/status').then(r => setS(r.data)).catch(e => setErr(getError(e))) }
  useEffect(load, [])

  async function request() {
    setBusy(true); setErr(''); setMsg('')
    try {
      await api.post('/subscription/request', { months: 1, amount_toman: 990000, note: 'درخواست تمدید یک ماهه' })
      setMsg('درخواست ثبت شد. پس از بررسی و پرداخت دستی، ادمین پلتفرم اشتراک را فعال می‌کند.')
    } catch (e) { setErr(getError(e)) } finally { setBusy(false) }
  }

  const state = s?.status === 'trial' ? { label: 'دوره آزمایشی', icon: FlaskConical } : s?.status === 'active' ? { label: 'فعال', icon: BadgeCheck } : { label: 'نیاز به تمدید', icon: CircleAlert }
  const StateIcon = state.icon
  const rem = (d?: string | null) => { const n = daysUntil(d); return n === null ? null : n >= 0 ? `${num(n)} روز مانده` : 'منقضی شده' }

  return (
    <>
      <PageHeader title="اشتراک مدرسه" description="در نسخه اولیه، فعال‌سازی و پرداخت به‌صورت دستی انجام می‌شود." />
      {msg && <Alert tone="success" onClose={() => setMsg('')}>{msg}</Alert>}
      {err && <Alert tone="error" onClose={() => setErr('')}>{err}</Alert>}
      <div className="sub-grid">
        <Card className="sub-status">
          <div>
            <div className="label">وضعیت فعلی</div>
            {s ? <div className="state"><StateIcon size={32} aria-hidden style={{ color: s.status === 'trial' || s.status === 'active' ? 'var(--c-accent-400)' : '#f0b45c' }} />{state.label}</div> : <Skeleton h={38} w="50%" />}
          </div>
          <div className="sub-dates">
            <div><small>پایان دوره آزمایشی</small><b>{s?.trial_ends_at ? dateFa(s.trial_ends_at) : '—'}</b>{s?.status === 'trial' && <em>{rem(s.trial_ends_at)}</em>}</div>
            <div><small>پایان اشتراک</small><b>{s?.subscription_ends_at ? dateFa(s.subscription_ends_at) : '—'}</b>{s?.status === 'active' && <em>{rem(s.subscription_ends_at)}</em>}</div>
          </div>
        </Card>

        <Card>
          <SectionHeader icon={CalendarClock} title="پلن ماهانه" description="پلن پیشنهادی شروع" />
          <div className="price"><b>{num(990000)}</b><span>تومان / ماه</span></div>
          <p className="field-hint">هزینه راه‌اندازی و ورود اولیه اطلاعات می‌تواند جداگانه دریافت شود.</p>
          <ol className="timeline">
            <li><i>۱</i><span>درخواست تمدید را ثبت می‌کنید.</span></li>
            <li><i>۲</i><span>پس از هماهنگی، پرداخت به‌صورت دستی انجام می‌شود.</span></li>
            <li><i>۳</i><span>ادمین پلتفرم اشتراک مدرسه را فعال می‌کند. این فرایند خودکار نیست.</span></li>
          </ol>
          <Button variant="primary" size="lg" icon={Send} loading={busy} onClick={request} style={{ width: '100%' }}>ثبت درخواست تمدید</Button>
        </Card>
      </div>
    </>
  )
}
