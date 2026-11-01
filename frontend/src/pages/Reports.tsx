import { useEffect, useMemo, useState } from 'react'
import { BarChart3, FileSpreadsheet, FileText, MessageSquareText, Search } from 'lucide-react'
import { api, getError } from '../api'
import type { ClassRoom } from '../types'
import { Alert, Button, Card, Dialog, EmptyState, Field, PageHeader, SectionHeader, TableSkeleton } from '../components/ui'
import JalaliDatePicker from '../components/JalaliDatePicker'
import { dateFa, num, saveBlob, tehranISODate } from '../lib/format'

type Row = { classroom_id: number; student_code: string; student_name: string; class_name: string; shift_name: string; absent: number; excused: number; late: number }
type ReportClass = { classroom_id: number; class_name: string; shift_name: string; sessions: number; periods: { date: string; period: number }[]; absent: number; excused: number; late: number; sms_pending: number }
type ReportData = { students: Row[]; classes: ReportClass[]; sms_pending: number }
type AppliedFilters = { start: string; end: string; classId: string }

const pill = (n: number, kind: 'absent' | 'excused' | 'late') => <span className={`count-pill num ${n ? kind : 'zero'}`}>{num(n)}</span>

export default function Reports() {
  const today = tehranISODate()
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  const [classId, setClassId] = useState('')
  const [expandedClassId, setExpandedClassId] = useState<number | null>(null)
  const [classes, setClasses] = useState<ClassRoom[] | null>(null)
  const [query, setQuery] = useState('')
  const [data, setData] = useState<ReportData | null>(null)
  const [applied, setApplied] = useState<AppliedFilters | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [confirmSms, setConfirmSms] = useState(false)
  const [busy, setBusy] = useState<'' | 'load' | 'excel' | 'pdf' | 'sms'>('')

  useEffect(() => {
    api.get('/setup/classes')
      .then(r => setClasses(r.data))
      .catch(e => { setErr(getError(e)); setClasses([]) })
    load(today, today, '')
  }, [])

  async function load(from = start, to = end, selectedClass = classId) {
    setBusy('load'); setErr(''); setMsg(''); setData(null); setApplied(null)
    try {
      const filters = { start: from, end: to, classroom_id: selectedClass ? Number(selectedClass) : undefined }
      const r = await api.get('/reports/summary', { params: filters })
      setData(r.data)
      setApplied({ start: from, end: to, classId: selectedClass })
    } catch (e) { setErr(getError(e)) } finally { setBusy('') }
  }

  async function download(kind: 'excel' | 'pdf') {
    setBusy(kind); setErr('')
    try {
      const params = { start, end, classroom_id: classId ? Number(classId) : undefined }
      const r = await api.get(`/reports/${kind}`, { params, responseType: 'blob' })
      saveBlob(r.data, `attendance-${start}-${end}.${kind === 'excel' ? 'xlsx' : 'pdf'}`)
    } catch (e) { setErr(getError(e)) } finally { setBusy('') }
  }

  async function sendSms() {
    if (!data || expandedClassId === null || start !== end || !filtersMatch) return
    setBusy('sms'); setErr(''); setMsg('')
    try {
      const params = { start, end, classroom_id: expandedClassId }
      const r = await api.post('/reports/sms', null, { params })
      setConfirmSms(false)
      await load(start, end, classId)
      const result = r.data as { sent: number; failed: number; skipped_no_phone: number; provider: string }
      const sentText = result.provider === 'console'
        ? `${num(result.sent)} پیام در لاگ سرور ثبت شد؛ در حالت console پیامک واقعی ارسال نمی‌شود.`
        : `${num(result.sent)} پیام به سرویس پیامکی ارسال شد.`
      setMsg(`${sentText}${result.skipped_no_phone ? ` ${num(result.skipped_no_phone)} دانش‌آموز شماره ولی ندارد.` : ''}`)
      if (result.failed) setErr(`ارسال پیام برای ${num(result.failed)} دانش‌آموز ناموفق بود؛ پس از بررسی سرویس پیامکی گزارش را دوباره بررسی کنید.`)
    } catch (e) {
      setConfirmSms(false)
      setErr(getError(e))
    } finally { setBusy('') }
  }

  const invalid = !start || !end || start > end
  const filtersMatch = !!data && !!applied && applied.start === start && applied.end === end && applied.classId === classId
  const rows = useMemo(() => (data?.students || []).filter(s => {
    const q = query.trim()
    return !q || s.student_name.includes(q) || s.student_code.includes(q)
  }), [data, query])
  const sum = (data?.students || []).reduce((a, s) => ({ absent: a.absent + s.absent, excused: a.excused + s.excused, late: a.late + s.late }), { absent: 0, excused: 0, late: 0 })
  const selectedClass = data?.classes.find(c => c.classroom_id === expandedClassId)

  function invalidateReport() {
    setData(null)
    setApplied(null)
    setQuery('')
    setExpandedClassId(null)
  }

  return (
    <>
      <PageHeader title="گزارش‌ها" description="گزارش روزانه، ماهانه یا هر بازه دلخواه؛ با فیلتر کلاس و امکان دریافت خروجی Excel و PDF." />
      {err && <Alert tone="error" onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert tone="success" onClose={() => setMsg('')}>{msg}</Alert>}
      <Card className="card-flush">
        <div className="report-bar">
          <Field label="از تاریخ شمسی"><JalaliDatePicker value={start} ariaLabel="از تاریخ شمسی" onChange={value => { setStart(value); invalidateReport() }} /></Field>
          <Field label="تا تاریخ شمسی"><JalaliDatePicker value={end} ariaLabel="تا تاریخ شمسی" onChange={value => { setEnd(value); invalidateReport() }} /></Field>
          <Field label="کلاس">
            <select value={classId} onChange={e => { setClassId(e.target.value); invalidateReport() }} disabled={classes === null}>
              <option value="">همه کلاس‌ها</option>
              {(classes || []).map(c => <option value={c.id} key={c.id}>{c.name} — {c.shift_name}</option>)}
            </select>
          </Field>
          <Button variant="primary" icon={Search} loading={busy === 'load'} disabled={invalid || classes === null || busy !== ''} onClick={() => load()}>نمایش گزارش</Button>
          <div className="export">
            <Button size="md" icon={FileSpreadsheet} loading={busy === 'excel'} disabled={invalid || !filtersMatch || busy !== ''} onClick={() => download('excel')}>Excel</Button>
            <Button size="md" icon={FileText} loading={busy === 'pdf'} disabled={invalid || !filtersMatch || busy !== ''} onClick={() => download('pdf')}>PDF</Button>
          </div>
        </div>
        {invalid && <div style={{ padding: '12px 24px 0' }}><Alert tone="warning">تاریخ شروع باید قبل از تاریخ پایان باشد.</Alert></div>}

        {busy === 'load' && !data ? <TableSkeleton rows={6} cols={5} />
          : !data ? <EmptyState icon={BarChart3} title="گزارشی نمایش داده نشده" text="بازه تاریخ و کلاس را انتخاب و روی «نمایش گزارش» بزنید." />
          : data.classes.length === 0 ? <EmptyState icon={BarChart3} title="در این بازه حضوری ثبت نشده" text={query ? 'جستجوی دیگری را امتحان کنید.' : 'بازه یا کلاس دیگری را انتخاب کنید؛ فقط کلاس‌های دارای ثبت حضور و غیاب نمایش داده می‌شوند.'} />
          : (
            <>
              <SectionHeader title={start === end ? 'وضعیت کلاس‌ها برای روز انتخابی' : 'وضعیت کلاس‌ها در بازه انتخابی'} description={start === end ? `فقط حضور و غیاب ثبت‌شده در ${dateFa(start)} نمایش داده می‌شود.` : 'کلاس‌ها و شمارش‌ها مربوط به بازه انتخابی هستند؛ برای پیامک، یک روز مشخص انتخاب کنید.'} />
              <div className="report-sum">
                <div><b className="num">{num(data.classes.length)}</b><small>کلاس ثبت‌شده</small></div>
                <div><b className="num" style={{ color: 'var(--c-danger-700)' }}>{num(sum.absent)}</b><small>غیبت</small></div>
                <div><b className="num" style={{ color: 'var(--c-info-700)' }}>{num(sum.excused)}</b><small>غیبت موجه</small></div>
                <div><b className="num" style={{ color: 'var(--c-warn-700)' }}>{num(sum.late)}</b><small>دیرآمده</small></div>
                <div><b className="num">{num(data.sms_pending)}</b><small>اولیای قابل اطلاع‌رسانی</small></div>
              </div>
              <div className="report-bar report-search-bar">
                <Field label="جستجوی دانش‌آموز">
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="نام یا کد دانش‌آموز" />
                </Field>
              </div>
              <div className="report-class-list">
                {data.classes.map(item => {
                  const expanded = item.classroom_id === expandedClassId
                  const classRows = rows.filter(row => row.classroom_id === item.classroom_id)
                  const periods = Array.from(new Set(item.periods.map(period => period.period)))
                  return (
                    <section className={`report-class${expanded ? ' expanded' : ''}`} key={item.classroom_id}>
                      <button type="button" className="report-class-toggle" aria-expanded={expanded} onClick={() => setExpandedClassId(expanded ? null : item.classroom_id)}>
                        <span className="report-class-title">
                          <b>کلاس {item.class_name}</b>
                          <small>{item.shift_name} · {num(item.sessions)} ثبت حضور و غیاب{periods.length ? ` · زنگ ${periods.map(num).join('، ')}` : ''}</small>
                        </span>
                        <span className="report-class-counts">
                          <span className="count-pill absent">{num(item.absent)} غیبت</span>
                          <span className="count-pill excused">{num(item.excused)} موجه</span>
                          <span className="count-pill late">{num(item.late)} تاخیر</span>
                        </span>
                        <span className="report-class-open">{expanded ? 'بستن فهرست' : 'بررسی فهرست'}</span>
                      </button>
                      {expanded && (
                        <div className="report-class-detail">
                          <div className="report-detail-head">
                            <p>{start === end ? 'فهرست مربوط به همین روز است؛ سابقه روزهای دیگر در این شمارش وارد نمی‌شود.' : 'این فهرست مجموع روزهای بازه انتخابی است. برای بررسی مستقل روز و ارسال پیامک، بازه را روی همان یک روز بگذارید.'}</p>
                            <Button
                              variant="primary"
                              icon={MessageSquareText}
                              disabled={!filtersMatch || start !== end || !item.sms_pending || busy !== ''}
                              onClick={() => setConfirmSms(true)}
                            >ارسال پیامک ({num(item.sms_pending)})</Button>
                          </div>
                          {classRows.length === 0
                            ? <EmptyState icon={BarChart3} title={query ? 'دانش‌آموزی با این جستجو پیدا نشد' : 'همه دانش‌آموزان حاضر ثبت شده‌اند'} text={query ? 'نام یا کد دیگری را جستجو کنید.' : 'حضور و غیاب این کلاس ثبت شده و مورد غیبت یا تاخیر در این بازه ثبت نشده است.'} />
                            : <div className="table-wrap">
                              <table className="table table-stack">
                                <thead><tr><th>دانش‌آموز</th><th className="cell-num">غیبت</th><th className="cell-num">موجه</th><th className="cell-num">دیرآمده</th></tr></thead>
                                <tbody>
                                  {classRows.map(student => (
                                    <tr key={student.student_code}>
                                      <td className="cell-first"><span className="cell-primary">{student.student_name}</span><span className="cell-sub num">کد: {num(student.student_code)}</span></td>
                                      <td data-label="غیبت" className="cell-num">{pill(student.absent, 'absent')}</td>
                                      <td data-label="موجه" className="cell-num">{pill(student.excused, 'excused')}</td>
                                      <td data-label="دیرآمده" className="cell-num">{pill(student.late, 'late')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            </>
          )}
      </Card>

      <Dialog
        open={confirmSms}
        title="ارسال پیامک به اولیای غایبان"
        description={`کلاس ${selectedClass?.class_name || ''}؛ ${dateFa(start)}`}
        onClose={() => setConfirmSms(false)}
        footer={
          <>
            <Button onClick={() => setConfirmSms(false)}>انصراف</Button>
            <Button variant="primary" icon={MessageSquareText} loading={busy === 'sms'} onClick={sendSms}>تایید و ارسال</Button>
          </>
        }
      >
        <p>برای {num(selectedClass?.sms_pending || 0)} دانش‌آموزی که در این روز غیبت یا غیبت موجه ثبت کرده‌اند و شماره ولی دارند، یک پیام خلاصه ارسال می‌شود.</p>
        <p className="muted" style={{ marginTop: 12 }}>ارسال برای کل کلاس و روز انتخاب‌شده انجام می‌شود، نه فقط نتایج جستجو. غیبت‌های روزهای دیگر در این پیامک حساب نمی‌شوند. در حالت console پیامک واقعی ارسال نمی‌شود و متن در لاگ سرور ثبت می‌شود.</p>
      </Dialog>
    </>
  )
}
