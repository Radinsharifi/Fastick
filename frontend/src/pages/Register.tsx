import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Gift, Plus, Trash2 } from 'lucide-react'
import { api, getError } from '../api'
import AuthShell from '../components/AuthShell'
import { Alert, BrandMark, Button, Field } from '../components/ui'
import { num } from '../lib/format'

type Period = { starts_at: string; ends_at: string }
type Shift = { name: string; periods: Period[] }
const STEPS = ['اطلاعات مدرسه', 'اطلاعات مدیر', 'شیفت‌ها', 'بازبینی']
const blankPeriods = (count: number): Period[] => Array.from({ length: count }, () => ({ starts_at: '', ends_at: '' }))

export default function Register({ onLogin }: { onLogin: () => Promise<void> }) {
  const [f, setF] = useState({ school_name: '', school_code: '', city: '', school_phone: '', manager_name: '', manager_phone: '', password: '' })
  const [shifts, setShifts] = useState<Shift[]>([{ name: 'صبح', periods: blankPeriods(4) }])
  const [step, setStep] = useState(0)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const nav = useNavigate()

  async function register() {
    setErr(''); setBusy(true)
    try {
      const r = await api.post('/auth/register-school', { ...f, shifts: shifts.map(s => ({ name: s.name, periods_count: s.periods.length, periods: s.periods })) })
      localStorage.setItem('token', r.data.access_token)
      await onLogin()
      nav('/')
    } catch (e) { setErr(getError(e)) } finally { setBusy(false) }
  }
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!e.currentTarget.checkValidity()) { e.currentTarget.reportValidity(); return }
    if (step === 2) {
      for (const shift of shifts) {
        for (let i = 0; i < shift.periods.length; i++) {
          const current = shift.periods[i]
          if (current.starts_at >= current.ends_at) {
            setErr(`زمان پایان زنگ ${num(i + 1)} شیفت «${shift.name}» باید بعد از زمان شروع آن باشد.`)
            return
          }
          const previous = shift.periods[i - 1]
          if (previous && (previous.starts_at >= current.starts_at || previous.ends_at > current.starts_at)) {
            setErr(`زنگ‌های شیفت «${shift.name}» باید به ترتیب زمانی باشند و تداخل نداشته باشند.`)
            return
          }
        }
      }
    }
    if (step < STEPS.length - 1) { setStep(step + 1); setErr(''); window.scrollTo({ top: 0 }) } else register()
  }
  const addShift = () => setShifts([...shifts, { name: 'عصر', periods: blankPeriods(4) }])
  const upd = (i: number, patch: Partial<Shift>) => setShifts(shifts.map((s, k) => k === i ? { ...s, ...patch } : s))
  const resizePeriods = (i: number, count: number) => setShifts(shifts.map((s, k) => k === i
    ? { ...s, periods: Array.from({ length: count }, (_, n) => s.periods[n] || { starts_at: '', ends_at: '' }) }
    : s))
  const goTo = (i: number) => { if (i < step) setStep(i) }

  return (
    <AuthShell wide>
      <form className="auth-form wide" onSubmit={onSubmit}>
        <div className="auth-mobile-brand"><BrandMark size={40} />FASTICK</div>
        <div><h1>راه‌اندازی مدرسه</h1></div>
        <div className="trial-note"><Gift size={18} aria-hidden /><span>۱۴ روز تست رایگان؛ بدون نیاز به پرداخت یا کارت بانکی. پس از پایان تست، تمدید اشتراک دستی انجام می‌شود.</span></div>
        <div className="reg-steps" role="list" aria-label="مراحل ثبت‌نام">
          {STEPS.map((s, i) => <button type="button" role="listitem" key={s} className={i === step ? 'on' : i < step ? 'ok' : ''} onClick={() => goTo(i)} aria-current={i === step ? 'step' : undefined} disabled={i > step}>{num(i + 1)}. {s}</button>)}
        </div>
        {err && <Alert tone="error">{err}</Alert>}

        {step === 0 && (
          <div className="form-grid">
            <Field label="نام مدرسه"><input required value={f.school_name} onChange={e => setF({ ...f, school_name: e.target.value })} /></Field>
            <Field label="کد مدرسه" hint="کد کوتاه انگلیسی برای ورود؛ مثلاً omid01"><input required dir="ltr" autoCapitalize="none" value={f.school_code} onChange={e => setF({ ...f, school_code: e.target.value.replace(/\s/g, '').toLowerCase() })} placeholder="omid01" /></Field>
            <Field label="شهر"><input value={f.city} onChange={e => setF({ ...f, city: e.target.value })} /></Field>
            <Field label="تلفن مدرسه"><input dir="ltr" inputMode="tel" value={f.school_phone} onChange={e => setF({ ...f, school_phone: e.target.value })} /></Field>
          </div>
        )}
        {step === 1 && (
          <div className="form-grid">
            <Field label="نام مدیر" className="full"><input required value={f.manager_name} onChange={e => setF({ ...f, manager_name: e.target.value })} /></Field>
            <Field label="موبایل مدیر" hint="نام کاربری ورود شما"><input required dir="ltr" inputMode="tel" value={f.manager_phone} onChange={e => setF({ ...f, manager_phone: e.target.value })} placeholder="09xxxxxxxxx" /></Field>
            <Field label="رمز عبور" hint="حداقل ۸ کاراکتر">
              <div className="input-wrap"><input required minLength={8} dir="ltr" type={show ? 'text' : 'password'} autoComplete="new-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
                <button type="button" className="icon-btn input-end" onClick={() => setShow(s => !s)} aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            </Field>
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>اگر مدرسه شما چند شیفت دارد (مثلاً صبح و عصر)، هرکدام را جداگانه اضافه کنید.</p>
            {shifts.map((s, i) => (
              <div className="shift-edit" key={i}>
                <Field label="نام شیفت"><input required value={s.name} onChange={e => upd(i, { name: e.target.value })} /></Field>
                <Field label="تعداد زنگ"><input type="number" min={1} max={12} required value={s.periods.length} onChange={e => { const count = +e.target.value; if (count >= 1 && count <= 12) resizePeriods(i, count) }} /></Field>
                <button type="button" className="icon-btn" style={{ marginBottom: 5 }} disabled={shifts.length === 1} onClick={() => setShifts(shifts.filter((_, k) => k !== i))} aria-label={`حذف شیفت ${s.name}`}><Trash2 size={17} /></button>
                <div className="period-grid full">
                  {s.periods.map((p, n) => (
                    <div className="period-row" key={n}>
                      <b>زنگ {num(n + 1)}</b>
                      <Field label="شروع"><input type="time" dir="ltr" required value={p.starts_at} onChange={e => setShifts(shifts.map((x, k) => k === i ? { ...x, periods: x.periods.map((v, j) => j === n ? { ...v, starts_at: e.target.value } : v) } : x))} /></Field>
                      <Field label="پایان"><input type="time" dir="ltr" required value={p.ends_at} onChange={e => setShifts(shifts.map((x, k) => k === i ? { ...x, periods: x.periods.map((v, j) => j === n ? { ...v, ends_at: e.target.value } : v) } : x))} /></Field>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Button icon={Plus} onClick={addShift}>افزودن شیفت</Button>
          </div>
        )}
        {step === 3 && (
          <dl className="review-list">
            <div><dt>مدرسه</dt><dd>{f.school_name}</dd></div>
            <div><dt>کد مدرسه</dt><dd className="ltr">{f.school_code}</dd></div>
            {f.city && <div><dt>شهر</dt><dd>{f.city}</dd></div>}
            {f.school_phone && <div><dt>تلفن مدرسه</dt><dd className="ltr">{f.school_phone}</dd></div>}
            <div><dt>مدیر</dt><dd>{f.manager_name}</dd></div>
            <div><dt>موبایل مدیر</dt><dd className="ltr">{f.manager_phone}</dd></div>
            <div><dt>شیفت‌ها</dt><dd>{shifts.map(s => `${s.name} (${num(s.periods.length)} زنگ)`).join('، ')}</dd></div>
          </dl>
        )}

        <div className="form-nav">
          {step > 0 ? <Button variant="ghost" icon={ArrowRight} onClick={() => setStep(step - 1)}>قبلی</Button> : <span />}
          {step < STEPS.length - 1
            ? <Button type="submit" variant="primary">ادامه<ArrowLeft size={17} /></Button>
            : <Button type="submit" variant="primary" icon={Check} loading={busy}>ثبت مدرسه و شروع تست</Button>}
        </div>
        <div className="auth-foot">قبلاً ثبت‌نام کرده‌اید؟ <Link to="/login">ورود به سامانه</Link></div>
      </form>
    </AuthShell>
  )
}
