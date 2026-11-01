import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Hash, Lock, Smartphone } from 'lucide-react'
import { api, getError } from '../api'
import AuthShell from '../components/AuthShell'
import { Alert, BrandMark, Button, Field } from '../components/ui'

export default function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [f, setF] = useState({ school_code: localStorage.getItem('school_code') || '', phone: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const [saveSchoolCode, setSaveSchoolCode] = useState(true)
  const nav = useNavigate()

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    if (saveSchoolCode && f.school_code.trim()) localStorage.setItem('school_code', f.school_code.trim())
    try {
      const r = await api.post('/auth/login', f)
      localStorage.setItem('token', r.data.access_token)
      localStorage.setItem('user', JSON.stringify(r.data.user))
      await onLogin()
      nav(r.data.user.role === 'platform_admin' ? '/platform' : '/')
    } catch (e) { setErr(getError(e)) } finally { setBusy(false) }
  }

  return (
    <AuthShell>
      <form className="auth-form" onSubmit={submit} noValidate={false}>
        <div className="auth-mobile-brand"><BrandMark size={40} />FASTICK</div>
        <div><h1>خوش آمدید</h1></div>
        <p className="lead">برای ورود به سامانه مدرسه، اطلاعات حساب خود را وارد کنید.</p>
        {err && <Alert tone="error">{err}</Alert>}
        <Field label="کد مدرسه">
          <div className="input-wrap"><Hash size={17} aria-hidden />
            <input className="input" dir="ltr" autoComplete="organization" autoCapitalize="none" spellCheck={false} value={f.school_code} onChange={e => {
              const school_code = e.target.value
              setF(current => ({ ...current, school_code }))
              if (saveSchoolCode && school_code.trim()) localStorage.setItem('school_code', school_code.trim())
            }} placeholder="مثلاً omid01" /></div>
        </Field>
        <label className="switch-row">
          <input type="checkbox" checked={saveSchoolCode} onChange={e => {
            setSaveSchoolCode(e.target.checked)
            if (!e.target.checked) localStorage.removeItem('school_code')
            else if (f.school_code.trim()) localStorage.setItem('school_code', f.school_code.trim())
          }} />
          <span><b>ذخیره کد مدرسه روی این دستگاه</b><small>شماره موبایل و رمز را مرورگر مدیریت می‌کند.</small></span>
        </label>
        <Field label="شماره موبایل">
          <div className="input-wrap"><Smartphone size={17} aria-hidden />
            <input className="input" dir="ltr" inputMode="tel" autoComplete="username" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="09xxxxxxxxx" /></div>
        </Field>
        <Field label="رمز عبور">
          <div className="input-wrap"><Lock size={17} aria-hidden />
            <input className="input" dir="ltr" type={show ? 'text' : 'password'} autoComplete="current-password" style={{ paddingInlineEnd: 44 }} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
            <button type="button" className="icon-btn input-end" onClick={() => setShow(s => !s)} aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={busy}>{busy ? 'در حال ورود…' : 'ورود'}</Button>
        <div className="auth-foot">مدرسه جدید هستید؟ <Link to="/register">ثبت‌نام مدرسه <ArrowLeft size={13} style={{ verticalAlign: -2 }} /></Link></div>
      </form>
    </AuthShell>
  )
}
