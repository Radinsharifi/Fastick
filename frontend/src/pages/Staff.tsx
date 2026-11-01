import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Download, Pencil, Plus, Trash2, Upload, UserPlus, Users } from 'lucide-react'
import { api, getError } from '../api'
import type { ClassRoom, Role, StaffUser } from '../types'
import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, PageHeader, TableSkeleton, useToast } from '../components/ui'
import type { Tone } from '../components/ui'
import { initials, num, ROLE_LABEL, saveBlob } from '../lib/format'

type Assign = { classroom_id: number; subject: string }
type Form = { full_name: string; phone: string; personnel_code: string; role: Role; password: string; is_active: boolean; assignments: Assign[] }
const blank = (): Form => ({ full_name: '', phone: '', personnel_code: '', role: 'teacher', password: '', is_active: true, assignments: [] })
const ROLE_TONE: Record<string, Tone> = { teacher: 'success', deputy: 'info', manager: 'brand' }

export default function Staff() {
  const toast = useToast()
  const file = useRef<HTMLInputElement>(null)
  const [users, setUsers] = useState<StaffUser[] | null>(null)
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState<StaffUser | null>(null)
  const [err, setErr] = useState('')
  const [formErr, setFormErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState<'' | 'save' | 'upload' | 'template'>('')
  const [f, setF] = useState<Form>(blank())

  async function load() {
    try {
      const [u, c] = await Promise.all([api.get('/setup/users'), api.get('/setup/classes')])
      setUsers(u.data); setClasses(c.data); setErr('')
    } catch (e) { setErr(getError(e)); setUsers(x => x ?? []) }
  }
  useEffect(() => { load() }, [])

  function openDialog() { setEditing(null); setF(blank()); setFormErr(''); setShow(true) }
  function openEdit(user: StaffUser) {
    setEditing(user)
    setF({
      full_name: user.full_name,
      phone: user.phone,
      personnel_code: user.personnel_code || '',
      role: user.role,
      password: '',
      is_active: user.is_active !== false,
      assignments: user.assignments?.map(a => ({ classroom_id: a.classroom_id, subject: a.subject })) || [],
    })
    setFormErr(''); setShow(true)
  }
  function toggleClass(id: number) {
    setF(p => p.assignments.some(a => a.classroom_id === id)
      ? { ...p, assignments: p.assignments.filter(a => a.classroom_id !== id) }
      : { ...p, assignments: [...p.assignments, { classroom_id: id, subject: 'عمومی' }] })
  }
  async function saveUser(e: FormEvent) {
    e.preventDefault(); setFormErr(''); setBusy('save')
    if (f.role !== 'manager' && !f.personnel_code.trim()) {
      setFormErr('کد پرسنلی برای معلم و معاون الزامی است و همان کد، رمز اولیه خواهد بود.')
      setBusy('')
      return
    }
    if (!editing && f.role === 'manager' && f.password.length < 8) {
      setFormErr('رمز مدیر مدرسه باید دست‌کم ۸ کاراکتر باشد.')
      setBusy('')
      return
    }
    try {
      if (editing) {
        const payload = {
          full_name: f.full_name.trim(),
          phone: f.phone.trim(),
          personnel_code: f.role === 'manager' ? (f.personnel_code.trim() || null) : f.personnel_code.trim(),
          is_active: f.is_active,
        }
        await api.patch(`/setup/users/${editing.id}`, payload)
        if (f.role === 'teacher') {
          await api.post(`/setup/users/${editing.id}/assignments`, f.assignments)
        }
      } else {
        const payload = { ...f, password: f.role === 'manager' ? f.password : undefined }
        await api.post('/setup/users', payload)
      }
      setShow(false); toast('success', editing ? `اطلاعات «${f.full_name}» به‌روزرسانی شد.` : `«${f.full_name}» اضافه شد.`); await load()
    } catch (e) { setFormErr(getError(e)) } finally { setBusy('') }
  }
  async function template() {
    setBusy('template')
    try { const r = await api.get('/setup/staff-template', { responseType: 'blob' }); saveBlob(r.data, 'staff-template.xlsx') }
    catch (e) { setErr(getError(e)) } finally { setBusy('') }
  }
  async function upload(fx: File) {
    setBusy('upload'); setMsg(''); setErr('')
    const fd = new FormData(); fd.append('file', fx)
    try {
      const r = await api.post('/setup/staff/import', fd)
      setMsg(`${num(r.data.created)} کاربر و ${num(r.data.assignments)} اتصال کلاس ایجاد شد.`); await load()
    } catch (e) { setErr(getError(e)) } finally { setBusy(''); if (file.current) file.current.value = '' }
  }

  return (
    <>
      <PageHeader title="کاربران و معلمان" description="هر معلم یک بار ساخته می‌شود و می‌تواند به چند کلاس و درس متصل باشد."
        actions={<>
          <Button icon={Download} loading={busy === 'template'} onClick={template}>نمونه Excel</Button>
          <Button icon={Upload} loading={busy === 'upload'} onClick={() => file.current?.click()}>ورود از Excel</Button>
          <input ref={file} hidden type="file" accept=".xlsx" aria-label="فایل Excel کاربران" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button variant="primary" icon={UserPlus} onClick={openDialog}>افزودن کاربر</Button>
        </>} />
      {msg && <Alert tone="success" onClose={() => setMsg('')}>{msg}</Alert>}
      {err && <Alert tone="error" onClose={() => setErr('')}>{err}</Alert>}

      <Card className="card-flush">
        {users === null ? <TableSkeleton rows={6} cols={5} />
          : users.length === 0 ? <EmptyState icon={Users} title="هنوز کاربری اضافه نشده" text="معلم‌ها و معاون‌ها را یکی‌یکی یا با فایل Excel اضافه کنید." action={<Button variant="primary" icon={UserPlus} onClick={openDialog}>افزودن کاربر</Button>} />
          : (
            <div className="table-wrap">
              <table className="table table-stack">
                <thead><tr><th>کاربر</th><th>نقش</th><th>موبایل</th><th>کد پرسنلی</th><th>کلاس‌ها</th><th>وضعیت</th><th>ویرایش</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="cell-first"><div className="cell-person"><span className="avatar" aria-hidden>{initials(u.full_name)}</span><span className="cell-primary">{u.full_name}</span></div></td>
                      <td data-label="نقش"><Badge tone={ROLE_TONE[u.role] || 'neutral'}>{ROLE_LABEL[u.role] || u.role}</Badge></td>
                      <td data-label="موبایل"><span className="ltr num">{u.phone}</span></td>
                      <td data-label="کد پرسنلی"><span className="num">{u.personnel_code || '-'}</span></td>
                      <td data-label="کلاس‌ها">
                        {u.assignments?.length
                          ? <div className="tag-list">{u.assignments.map((a, i) => <span className="tag" key={i}><b>{a.class_name}</b>{a.subject}</span>)}</div>
                          : <span className="muted">—</span>}
                      </td>
                      <td data-label="وضعیت"><Badge tone={u.is_active === false ? 'neutral' : 'success'}>{u.is_active === false ? 'غیرفعال' : 'فعال'}</Badge></td>
                      <td data-label="ویرایش"><Button size="sm" icon={Pencil} onClick={() => openEdit(u)}>ویرایش</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      <Dialog open={show} onClose={() => setShow(false)} size="lg" title={editing ? 'ویرایش کاربر' : 'افزودن کاربر'} description={editing ? 'اطلاعات کاربر و کلاس‌های متصل را ویرایش کنید.' : 'اطلاعات ورود و نقش کاربر را وارد کنید.'}
        footer={<>
          <Button variant="ghost" onClick={() => setShow(false)}>انصراف</Button>
          <Button variant="primary" type="submit" form="staff-form" loading={busy === 'save'}>ذخیره کاربر</Button>
        </>}>
        <form id="staff-form" className="stack" onSubmit={saveUser}>
          {formErr && <Alert tone="error">{formErr}</Alert>}
          <div className="form-section">
            <h3>اطلاعات شخصی</h3>
            <div className="form-grid">
              <Field label="نام کامل" className="full"><input required value={f.full_name} onChange={e => setF(v => ({ ...v, full_name: e.target.value }))} /></Field>
              <Field label="موبایل" hint="به‌عنوان نام کاربری ورود استفاده می‌شود"><input required dir="ltr" inputMode="tel" value={f.phone} onChange={e => setF(v => ({ ...v, phone: e.target.value }))} placeholder="09xxxxxxxxx" /></Field>
              <Field label="کد پرسنلی"><input dir="ltr" value={f.personnel_code} onChange={e => setF(v => ({ ...v, personnel_code: e.target.value }))} /></Field>
            </div>
          </div>
          <div className="form-section">
            <h3>نقش و دسترسی</h3>
            <div className="form-grid">
              <Field label="نقش">
                <select value={f.role} disabled={!!editing} onChange={e => setF(v => ({ ...v, role: e.target.value as Role, assignments: [] }))}>
                  <option value="teacher">معلم</option><option value="deputy">معاون</option><option value="manager">مدیر</option>
                </select>
              </Field>
              {f.role === 'manager'
                ? editing
                  ? <div className="staff-password-note"><b>رمز عبور</b><span>رمز فعلی مدیر بدون تغییر باقی می‌ماند.</span></div>
                  : <Field label="رمز عبور مدیر" hint="برای مدیر مدرسه از کد پرسنلی استفاده نمی‌شود."><input required minLength={8} dir="ltr" type="password" autoComplete="new-password" value={f.password} onChange={e => setF(v => ({ ...v, password: e.target.value }))} /></Field>
                : <div className="staff-password-note"><b>رمز اولیه</b><span>کد پرسنلی همین کاربر است: <strong className="ltr">{f.personnel_code || '—'}</strong></span></div>}
              {editing && <label className="check"><input type="checkbox" checked={f.is_active} onChange={e => setF(v => ({ ...v, is_active: e.target.checked }))} />حساب کاربر فعال است</label>}
            </div>
          </div>
          {f.role === 'teacher' && (
            <div className="form-section">
              <h3>کلاس‌ها و دروس</h3>
              {classes.length === 0
                ? <Alert tone="warning">هنوز کلاسی تعریف نشده است. ابتدا از «تنظیمات مدرسه» کلاس اضافه کنید.</Alert>
                : <div className="chip-select" role="group" aria-label="انتخاب کلاس‌ها">
                  {classes.map(c => <button type="button" key={c.id} aria-pressed={f.assignments.some(a => a.classroom_id === c.id)} onClick={() => toggleClass(c.id)}><Plus size={14} aria-hidden />{c.name}</button>)}
                </div>}
              {f.assignments.length > 0 && (
                <div className="assign-list">
                  {f.assignments.map((a, i) => (
                    <div className="assign-row" key={a.classroom_id}>
                      <span>{classes.find(c => c.id === a.classroom_id)?.name}</span>
                      <input className="input" aria-label="نام درس" value={a.subject} placeholder="نام درس" onChange={e => { const arr = [...f.assignments]; arr[i] = { ...a, subject: e.target.value }; setF(v => ({ ...v, assignments: arr })) }} />
                      <button type="button" className="icon-btn" aria-label="حذف این کلاس" onClick={() => toggleClass(a.classroom_id)}><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      </Dialog>
    </>
  )
}
