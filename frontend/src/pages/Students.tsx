import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Download, FileSpreadsheet, GraduationCap, Pencil, Search, Upload, UserRoundPlus } from 'lucide-react'
import { api, getError } from '../api'
import type { ClassRoom, Student } from '../types'
import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, PageHeader, TableSkeleton, useToast } from '../components/ui'
import { initials, num, saveBlob } from '../lib/format'

type StudentForm = { student_code: string; full_name: string; classroom_id: string; guardian_name: string; guardian_phone: string; is_active: boolean }
const blank = (classroomId = ''): StudentForm => ({ student_code: '', full_name: '', classroom_id: classroomId, guardian_name: '', guardian_phone: '', is_active: true })

export default function Students() {
  const toast = useToast()
  const [rows, setRows] = useState<Student[] | null>(null)
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [classId, setClassId] = useState('')
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<'' | 'upload' | 'template' | 'search' | 'save'>('')
  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState<StudentForm>(blank())
  const [formErr, setFormErr] = useState('')
  const file = useRef<HTMLInputElement>(null)

  async function load(cid = classId, query = q) {
    setBusy('search')
    try {
      const r = await api.get('/setup/students', { params: { classroom_id: cid || undefined, q: query || undefined } })
      setRows(r.data); setErr('')
    } catch (e) { setErr(getError(e)); setRows(r => r ?? []) } finally { setBusy('') }
  }
  useEffect(() => { api.get('/setup/classes').then(r => setClasses(r.data)).catch(e => setErr(getError(e))); load() }, [])

  async function upload(f: File) {
    setBusy('upload'); setMsg(''); setErr('')
    const fd = new FormData(); fd.append('file', f)
    try {
      const r = await api.post('/setup/students/import', fd)
      setMsg(`${num(r.data.created)} دانش‌آموز ایجاد و ${num(r.data.updated)} مورد به‌روزرسانی شد.`)
      await load()
    } catch (e) { setErr(getError(e)) } finally { setBusy(''); if (file.current) file.current.value = '' }
  }
  async function template() {
    setBusy('template')
    try { const r = await api.get('/setup/student-template', { responseType: 'blob' }); saveBlob(r.data, 'students-template.xlsx') }
    catch (e) { setErr(getError(e)) } finally { setBusy('') }
  }
  function submit(e: FormEvent) { e.preventDefault(); load() }

  function openCreate() {
    setEditing(null); setForm(blank(classId || (classes[0] ? String(classes[0].id) : ''))); setFormErr(''); setShow(true)
  }
  function openEdit(student: Student) {
    setEditing(student)
    setForm({
      student_code: student.student_code,
      full_name: student.full_name,
      classroom_id: String(student.classroom_id),
      guardian_name: student.guardian_name || '',
      guardian_phone: student.guardian_phone || '',
      is_active: student.is_active !== false,
    })
    setFormErr(''); setShow(true)
  }
  async function saveStudent(e: FormEvent) {
    e.preventDefault(); setBusy('save'); setFormErr('')
    const payload = {
      student_code: form.student_code.trim(),
      full_name: form.full_name.trim(),
      classroom_id: Number(form.classroom_id),
      guardian_name: form.guardian_name.trim() || null,
      guardian_phone: form.guardian_phone.trim() || null,
      is_active: form.is_active,
    }
    try {
      if (editing) await api.patch(`/setup/students/${editing.id}`, payload)
      else await api.post('/setup/students', payload)
      setShow(false)
      toast('success', editing ? 'اطلاعات دانش‌آموز به‌روزرسانی شد.' : 'دانش‌آموز اضافه شد.')
      await load()
    } catch (e) { setFormErr(getError(e)) } finally { setBusy('') }
  }

  return (
    <>
      <PageHeader title="دانش‌آموزان" description="لیست دانش‌آموزان مدرسه و ورود گروهی اطلاعات با فایل Excel."
        actions={<>
          {rows && <Badge tone="brand" icon={GraduationCap}>{num(rows.length)} دانش‌آموز{q || classId ? ' (طبق فیلتر)' : ''}</Badge>}
          <Button variant="primary" icon={UserRoundPlus} onClick={openCreate}>افزودن دانش‌آموز</Button>
        </>} />

      {msg && <Alert tone="success" onClose={() => setMsg('')}>{msg}</Alert>}
      {err && <Alert tone="error" onClose={() => setErr('')}>{err}</Alert>}

      <div className="import-panel">
        <div className="import-step">
          <span className="n">۱</span>
          <div><b>دانلود فایل نمونه</b><p>فایل Excel نمونه را دانلود و اطلاعات دانش‌آموزان را در همان قالب پر کنید.</p>
            <Button icon={Download} loading={busy === 'template'} onClick={template}>دانلود نمونه Excel</Button></div>
        </div>
        <div className="import-step">
          <span className="n">۲</span>
          <div><b>بارگذاری فایل تکمیل‌شده</b><p>فایل با فرمت xlsx. را انتخاب کنید؛ دانش‌آموزان جدید ساخته و موارد موجود به‌روزرسانی می‌شوند.</p>
            <Button variant="primary" icon={Upload} loading={busy === 'upload'} onClick={() => file.current?.click()}>انتخاب و آپلود Excel</Button>
            <input ref={file} hidden type="file" accept=".xlsx" aria-label="فایل Excel دانش‌آموزان" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} /></div>
        </div>
      </div>

      <Card className="card-flush">
        <form className="toolbar" onSubmit={submit} role="search">
          <div className="input-wrap">
            <Search size={17} aria-hidden />
            <input className="input" placeholder="جستجوی نام دانش‌آموز" value={q} onChange={e => setQ(e.target.value)} aria-label="جستجوی نام دانش‌آموز" />
          </div>
          <select className="select" value={classId} onChange={e => { setClassId(e.target.value); load(e.target.value, q) }} aria-label="فیلتر کلاس">
            <option value="">همه کلاس‌ها</option>
            {classes.map(c => <option value={c.id} key={c.id}>{c.class_name || c.name}</option>)}
          </select>
          <Button type="submit" variant="primary" icon={Search} loading={busy === 'search'}>جستجو</Button>
        </form>

        {rows === null ? <TableSkeleton rows={7} cols={5} />
          : rows.length === 0 ? <EmptyState icon={FileSpreadsheet} title={q || classId ? 'دانش‌آموزی با این فیلتر پیدا نشد' : 'هنوز دانش‌آموزی ثبت نشده'} text={q || classId ? 'جستجو یا کلاس را تغییر دهید.' : 'می‌توانید دانش‌آموز را دستی اضافه کنید یا از فایل Excel استفاده کنید.'} action={<Button variant="primary" icon={UserRoundPlus} onClick={openCreate}>افزودن دانش‌آموز</Button>} />
          : (
            <div className="table-wrap">
              <table className="table table-stack">
                <thead><tr><th>دانش‌آموز</th><th>کلاس</th><th>پایه / رشته</th><th>ولی</th><th>موبایل ولی</th><th>وضعیت</th><th>ویرایش</th></tr></thead>
                <tbody>
                  {rows.map(s => (
                    <tr key={s.id}>
                      <td className="cell-first"><div className="cell-person"><span className="avatar" aria-hidden>{initials(s.full_name)}</span><span><span className="cell-primary">{s.full_name}</span><span className="cell-sub num">کد: {num(s.student_code)}</span></span></div></td>
                      <td data-label="کلاس"><Badge tone="neutral">{s.class_name}</Badge></td>
                      <td data-label="پایه / رشته">{[s.grade, s.field].filter(Boolean).join(' / ') || '-'}</td>
                      <td data-label="ولی">{s.guardian_name || '-'}</td>
                      <td data-label="موبایل ولی"><span className="ltr num">{s.guardian_phone || '-'}</span></td>
                      <td data-label="وضعیت"><Badge tone={s.is_active === false ? 'neutral' : 'success'}>{s.is_active === false ? 'غیرفعال' : 'فعال'}</Badge></td>
                      <td data-label="ویرایش"><Button size="sm" icon={Pencil} onClick={() => openEdit(s)}>ویرایش</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
      <Dialog
          open={show}
          onClose={() => setShow(false)}
          title={editing ? 'ویرایش دانش‌آموز' : 'افزودن دانش‌آموز'}
          description="اطلاعات دانش‌آموز و راه ارتباط با ولی را وارد کنید."
          footer={<>
            <Button variant="ghost" onClick={() => setShow(false)}>انصراف</Button>
            <Button variant="primary" type="submit" form="student-form" loading={busy === 'save'}>ذخیره</Button>
          </>}
      >
          <form id="student-form" className="stack" onSubmit={saveStudent}>
            {formErr && <Alert tone="error">{formErr}</Alert>}
            <div className="form-grid">
              <Field label="نام و نام خانوادگی"><input required maxLength={150} value={form.full_name} onChange={e => setForm(v => ({ ...v, full_name: e.target.value }))} /></Field>
              <Field label="کد دانش‌آموزی"><input required maxLength={50} dir="ltr" value={form.student_code} onChange={e => setForm(v => ({ ...v, student_code: e.target.value }))} /></Field>
              <Field label="کلاس">
                <select required value={form.classroom_id} onChange={e => setForm(v => ({ ...v, classroom_id: e.target.value }))}>
                  <option value="" disabled>انتخاب کلاس</option>
                  {classes.map(c => <option value={c.id} key={c.id}>{c.name} — {c.shift_name}</option>)}
                </select>
              </Field>
              <Field label="نام ولی"><input maxLength={150} value={form.guardian_name} onChange={e => setForm(v => ({ ...v, guardian_name: e.target.value }))} /></Field>
              <Field label="موبایل ولی"><input dir="ltr" inputMode="tel" maxLength={30} value={form.guardian_phone} onChange={e => setForm(v => ({ ...v, guardian_phone: e.target.value }))} /></Field>
              <label className="check"><input type="checkbox" checked={form.is_active} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))} />دانش‌آموز فعال است</label>
            </div>
          </form>
      </Dialog>
    </>
  )
}
