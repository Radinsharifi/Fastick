import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Layers, Pencil, Plus, School, Sun } from 'lucide-react'
import { api, getError } from '../api'
import type { ClassRoom, Shift } from '../types'
import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, PageHeader, SectionHeader, TableSkeleton, useToast } from '../components/ui'
import { faDigits, num } from '../lib/format'

type PeriodDraft = { starts_at: string; ends_at: string }
type ShiftForm = { id?: number; name: string; periods: PeriodDraft[] }
type ClassForm = { name: string; grade: string; field: string; shift_id: string }

const blankPeriods = (count: number): PeriodDraft[] => Array.from({ length: count }, () => ({ starts_at: '', ends_at: '' }))
const inputTime = (time?: string | null) => time?.slice(0, 5) || ''

export default function Settings() {
  const toast = useToast()
  const [shifts, setShifts] = useState<Shift[] | null>(null)
  const [classes, setClasses] = useState<ClassRoom[] | null>(null)
  const [err, setErr] = useState('')
  const [newClass, setNewClass] = useState({ name: '', grade: '', field: '', shift_id: 0 })
  const [busyClass, setBusyClass] = useState(false)
  const [dlg, setDlg] = useState(false)
  const [shiftForm, setShiftForm] = useState<ShiftForm>({ name: 'عصر', periods: blankPeriods(4) })
  const [countText, setCountText] = useState('4')
  const [shiftErr, setShiftErr] = useState('')
  const [busyShift, setBusyShift] = useState(false)
  const [classDlg, setClassDlg] = useState(false)
  const [editClass, setEditClass] = useState<ClassRoom | null>(null)
  const [classForm, setClassForm] = useState<ClassForm>({ name: '', grade: '', field: '', shift_id: '' })
  const [classErr, setClassErr] = useState('')
  const [busyEditClass, setBusyEditClass] = useState(false)

  async function load() {
    try {
      const [s, c] = await Promise.all([api.get('/setup/shifts'), api.get('/setup/classes')])
      setShifts(s.data); setClasses(c.data); setErr('')
      if (s.data[0]) setNewClass(x => x.shift_id ? x : { ...x, shift_id: s.data[0].id })
    } catch (e) { setErr(getError(e)); setShifts(x => x ?? []); setClasses(x => x ?? []) }
  }
  useEffect(() => { load() }, [])

  async function addClass(e: FormEvent) {
    e.preventDefault(); setBusyClass(true); setErr('')
    try {
      await api.post('/setup/classes', newClass)
      toast('success', `کلاس «${newClass.name}» اضافه شد.`)
      setNewClass({ ...newClass, name: '', grade: '', field: '' }); load()
    } catch (e) { setErr(getError(e)) } finally { setBusyClass(false) }
  }

  function openEditClass(row: ClassRoom) {
    setEditClass(row)
    setClassForm({
      name: row.name,
      grade: row.grade || '',
      field: row.field || '',
      shift_id: String(row.shift_id || shifts?.[0]?.id || ''),
    })
    setClassErr('')
    setClassDlg(true)
  }

  async function saveClass(e: FormEvent) {
    e.preventDefault(); setClassErr(''); setBusyEditClass(true)
    const payload = {
      name: classForm.name.trim(),
      grade: classForm.grade.trim() || null,
      field: classForm.field.trim() || null,
      shift_id: Number(classForm.shift_id),
    }
    try {
      if (editClass) await api.patch(`/setup/classes/${editClass.id}`, payload)
      setClassDlg(false)
      toast('success', `کلاس «${payload.name}» به‌روزرسانی شد.`)
      await load()
    } catch (e) { setClassErr(getError(e)) } finally { setBusyEditClass(false) }
  }

  function openNewShift() {
    setShiftForm({ name: 'عصر', periods: blankPeriods(4) })
    setCountText('4')
    setShiftErr('')
    setDlg(true)
  }

  function openEditShift(shift: Shift) {
    setShiftForm({
      id: shift.id,
      name: shift.name,
      periods: Array.from({ length: shift.periods_count }, (_, i) => ({
        starts_at: inputTime(shift.periods?.[i]?.starts_at || (i === 0 ? shift.starts_at : null)),
        ends_at: inputTime(shift.periods?.[i]?.ends_at),
      })),
    })
    setCountText(String(shift.periods_count))
    setShiftErr('')
    setDlg(true)
  }

  // تعداد زنگ را فقط زمانی اعمال می‌کنیم که مقدار وارد شده معتبر باشد؛
  // این‌گونه می‌توان مقدار قبلی را پاک کرد و عدد جدید را تایپ کرد.
  function commitPeriodCount(): number {
    const count = Number(countText)
    if (!Number.isInteger(count) || count < 1 || count > 12) {
      setCountText(String(shiftForm.periods.length))
      return shiftForm.periods.length
    }
    if (count !== shiftForm.periods.length) resizePeriods(count)
    setCountText(String(count))
    return count
  }

  function stepPeriodCount(delta: number) {
    const current = Number(countText)
    const base = Number.isInteger(current) && current >= 1 && current <= 12 ? current : shiftForm.periods.length
    const next = Math.min(12, Math.max(1, base + delta))
    setCountText(String(next))
    if (next !== shiftForm.periods.length) resizePeriods(next)
  }

  async function saveShift(e: FormEvent) {
    e.preventDefault(); setShiftErr('')
    const count = Number(countText)
    if (!Number.isInteger(count) || count < 1 || count > 12) {
      setShiftErr('تعداد زنگ باید بین ۱ تا ۱۲ باشد.')
      return
    }
    const periods = Array.from({ length: count }, (_, i) => ({
      starts_at: shiftForm.periods[i]?.starts_at || '',
      ends_at: shiftForm.periods[i]?.ends_at || '',
    }))
    for (let i = 0; i < periods.length; i++) {
      if (!periods[i].starts_at || !periods[i].ends_at) {
        setShiftErr(`برای زنگ ${num(i + 1)} زمان شروع و پایان را وارد کنید.`)
        return
      }
      if (periods[i].starts_at >= periods[i].ends_at) {
        setShiftErr(`زمان پایان زنگ ${num(i + 1)} باید بعد از زمان شروع آن باشد.`)
        return
      }
      if (i > 0 && (periods[i - 1].starts_at >= periods[i].starts_at || periods[i - 1].ends_at > periods[i].starts_at)) {
        setShiftErr('زنگ‌ها باید به ترتیب زمانی باشند و با هم تداخل نداشته باشند.')
        return
      }
    }
    setBusyShift(true)
    try {
      if (shiftForm.id) {
        await api.patch(`/setup/shifts/${shiftForm.id}`, { name: shiftForm.name, periods })
        toast('success', `زمان‌بندی شیفت «${shiftForm.name}» ذخیره شد.`)
      } else {
        await api.post('/setup/shifts', { name: shiftForm.name, periods_count: periods.length, periods })
        toast('success', `شیفت «${shiftForm.name}» اضافه شد.`)
      }
      setDlg(false); await load()
    } catch (e) { setShiftErr(getError(e)) } finally { setBusyShift(false) }
  }

  function resizePeriods(count: number) {
    setShiftForm(current => ({
      ...current,
      periods: Array.from({ length: count }, (_, i) => current.periods[i] || { starts_at: '', ends_at: '' }),
    }))
  }

  return (
    <>
      <PageHeader title="تنظیمات مدرسه" description="زمان شروع و پایان هر زنگ را برای هر شیفت جداگانه تنظیم کنید، سپس کلاس‌ها را به شیفت‌ها اضافه کنید." />
      {err && <Alert tone="error" onClose={() => setErr('')}>{err}</Alert>}
      <div className="settings-grid">
        <Card>
          <SectionHeader icon={Sun} title="۱. شیفت‌ها و زنگ‌ها" description="بازه زمانی مستقل برای هر زنگ"
            action={<Button size="sm" icon={Plus} onClick={openNewShift}>شیفت جدید</Button>} />
          {shifts === null ? <TableSkeleton rows={2} cols={2} />
            : shifts.length === 0 ? <EmptyState icon={Sun} title="شیفتی تعریف نشده" text="برای شروع یک شیفت اضافه کنید." />
            : shifts.map(s => {
              const scheduled = s.periods?.every(p => p.starts_at && p.ends_at)
              return (
                <div className="shift-card" key={s.id}>
                  <span className="shift-icon"><Sun size={19} aria-hidden /></span>
                  <div className="shift-card-info">
                    <b>{s.name}</b>
                    <small>{scheduled
                      ? s.periods?.map(p => `زنگ ${num(p.period_number)}: ${faDigits(inputTime(p.starts_at))}–${faDigits(inputTime(p.ends_at))}`).join(' · ')
                      : 'زمان زنگ‌ها تنظیم نشده است'}</small>
                  </div>
                  <Badge tone="brand">{num(s.periods_count)} زنگ</Badge>
                  <Button size="sm" icon={Pencil} onClick={() => openEditShift(s)}>تنظیم ساعت‌ها</Button>
                </div>
              )
            })}
        </Card>

        <Card>
          <SectionHeader icon={School} title="۲. افزودن کلاس" description="کلاس جدید به یکی از شیفت‌ها متصل می‌شود" />
          <form onSubmit={addClass} className="stack">
            <div className="form-grid">
              <Field label="نام کلاس"><input required value={newClass.name} onChange={e => setNewClass({ ...newClass, name: e.target.value })} placeholder="مثلاً 7/1" /></Field>
              <Field label="شیفت">
                <select value={newClass.shift_id} onChange={e => setNewClass({ ...newClass, shift_id: +e.target.value })}>
                  {(shifts || []).map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="پایه"><input value={newClass.grade} onChange={e => setNewClass({ ...newClass, grade: e.target.value })} /></Field>
              <Field label="رشته"><input value={newClass.field} onChange={e => setNewClass({ ...newClass, field: e.target.value })} /></Field>
            </div>
            <Button type="submit" variant="primary" icon={Plus} loading={busyClass} disabled={!shifts?.length}>افزودن کلاس</Button>
            {shifts && !shifts.length && <small className="field-hint">برای افزودن کلاس ابتدا یک شیفت تعریف کنید.</small>}
          </form>
        </Card>

        <Card className="card-flush span2">
          <SectionHeader icon={Layers} title="کلاس‌های تعریف‌شده" description={classes ? `${num(classes.length)} کلاس` : undefined} />
          {classes === null ? <TableSkeleton rows={4} cols={6} />
            : classes.length === 0 ? <EmptyState icon={Layers} title="هنوز کلاسی تعریف نشده" text="از فرم بالا اولین کلاس را اضافه کنید." />
            : (
              <div className="table-wrap">
                <table className="table table-stack">
                  <thead><tr><th>کلاس</th><th>پایه</th><th>رشته</th><th>شیفت</th><th>زنگ</th><th>ویرایش</th></tr></thead>
                  <tbody>{classes.map(c => (
                    <tr key={c.id}>
                      <td className="cell-first"><span className="cell-primary">{c.name}</span></td>
                      <td data-label="پایه">{c.grade || '-'}</td><td data-label="رشته">{c.field || '-'}</td>
                      <td data-label="شیفت"><Badge tone="neutral">{c.shift_name}</Badge></td>
                      <td data-label="زنگ" className="num">{num(c.periods_count)}</td>
                      <td data-label="ویرایش"><Button size="sm" icon={Pencil} onClick={() => openEditClass(c)}>ویرایش</Button></td>
                    </tr>))}</tbody>
                </table>
              </div>
            )}
        </Card>
      </div>

      <Dialog open={dlg} onClose={() => setDlg(false)} size="lg" title={shiftForm.id ? 'تنظیم زمان‌بندی شیفت' : 'شیفت جدید'}
        description="برای هر زنگ زمان شروع و پایان وارد کنید. فاصله بین زنگ‌ها به‌عنوان زنگ تفریح در نظر گرفته می‌شود."
        footer={<><Button variant="ghost" onClick={() => setDlg(false)}>انصراف</Button><Button variant="primary" type="submit" form="shift-form" loading={busyShift}>ذخیره</Button></>}>
        <form id="shift-form" className="stack" onSubmit={saveShift}>
          {shiftErr && <Alert tone="error">{shiftErr}</Alert>}
          <Field label="نام شیفت"><input required value={shiftForm.name} onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })} /></Field>
          <Field label="تعداد زنگ" hint="بین ۱ تا ۱۲">
            <div className="count-stepper">
              <button type="button" className="icon-btn" onClick={() => stepPeriodCount(-1)} disabled={shiftForm.periods.length <= 1} aria-label="کاهش تعداد زنگ">−</button>
              <input type="text" inputMode="numeric" autoComplete="off" maxLength={2} value={countText}
                onFocus={e => e.currentTarget.select()}
                onChange={e => setCountText(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={commitPeriodCount}
                aria-label="تعداد زنگ" />
              <button type="button" className="icon-btn" onClick={() => stepPeriodCount(1)} disabled={shiftForm.periods.length >= 12} aria-label="افزایش تعداد زنگ">+</button>
            </div>
          </Field>
          <div className="period-grid">
            {shiftForm.periods.map((period, i) => (
              <div className="period-row" key={i}>
                <b>زنگ {num(i + 1)}</b>
                <Field label="شروع"><input type="time" dir="ltr" required value={period.starts_at} onChange={e => setShiftForm(f => ({ ...f, periods: f.periods.map((p, index) => index === i ? { ...p, starts_at: e.target.value } : p) }))} /></Field>
                <Field label="پایان"><input type="time" dir="ltr" required value={period.ends_at} onChange={e => setShiftForm(f => ({ ...f, periods: f.periods.map((p, index) => index === i ? { ...p, ends_at: e.target.value } : p) }))} /></Field>
              </div>
            ))}
          </div>
        </form>
      </Dialog>

      <Dialog open={classDlg} onClose={() => setClassDlg(false)} title={editClass ? `ویرایش کلاس «${editClass.name}»` : 'ویرایش کلاس'}
        description="نام، پایه، رشته و شیفت کلاس را تغییر دهید. با تغییر شیفت، تعداد زنگ‌های کلاس هم عوض می‌شود."
        footer={<><Button variant="ghost" onClick={() => setClassDlg(false)}>انصراف</Button><Button variant="primary" type="submit" form="class-form" loading={busyEditClass}>ذخیره کلاس</Button></>}>
        <form id="class-form" className="stack" onSubmit={saveClass}>
          {classErr && <Alert tone="error">{classErr}</Alert>}
          <div className="form-grid">
            <Field label="نام کلاس"><input required maxLength={80} value={classForm.name} onChange={e => setClassForm({ ...classForm, name: e.target.value })} placeholder="مثلاً 7/1" /></Field>
            <Field label="شیفت">
              <select value={classForm.shift_id} onChange={e => setClassForm({ ...classForm, shift_id: e.target.value })}>
                {(shifts || []).map(s => <option value={s.id} key={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="پایه"><input maxLength={50} value={classForm.grade} onChange={e => setClassForm({ ...classForm, grade: e.target.value })} /></Field>
            <Field label="رشته"><input maxLength={80} value={classForm.field} onChange={e => setClassForm({ ...classForm, field: e.target.value })} /></Field>
          </div>
        </form>
      </Dialog>
    </>
  )
}
