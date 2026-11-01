import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, CheckCheck, ClipboardList, History, Search, Send, UserRoundX, Users } from 'lucide-react'
import { api, getError } from '../api'
import type { Assignment, ClassRoom, CurrentUser } from '../types'
import { Alert, Badge, Button, Card, EmptyState, Field, PageHeader, Skeleton } from '../components/ui'
import { dateFa, faDigits, num, tehranISODate } from '../lib/format'

type Status = 'absent' | 'excused' | 'late'
type Mark = { status: Status; reason?: string }
type Stu = { id: number; full_name: string; student_code: string }
type SessionRecord = { student_id: number; status: Status; reason?: string }

const STATUS_LABEL: Record<Status, string> = { absent: 'غایب', excused: 'غیبت موجه', late: 'دیرآمده' }

export default function Attendance({ user }: { user: CurrentUser }) {
  const [params] = useSearchParams()
  const [classes, setClasses] = useState<Assignment[] | null>(null)
  const [classId, setClassId] = useState<number>(Number(params.get('classroom_id')) || 0)
  const [period, setPeriod] = useState(1)
  const [students, setStudents] = useState<Stu[] | null>(null)
  const [marked, setMarked] = useState<Record<number, Mark>>({})
  const [existing, setExisting] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const date = tehranISODate()

  useEffect(() => {
    (user.role === 'teacher' ? api.get('/me/assignments') : api.get('/setup/classes')).then(r => {
      const rows: Assignment[] = user.role === 'teacher' ? r.data : r.data.map((c: ClassRoom) => ({ classroom_id: c.id, class_name: c.name, subject: '', shift: c.shift_name, periods_count: c.periods_count, periods: c.periods }))
      setClasses(rows)
      if (!classId && rows[0]) setClassId(rows[0].classroom_id)
    }).catch(e => { setErr(getError(e)); setClasses([]) })
  }, [])

  const active = classes?.find(c => c.classroom_id === classId)

  useEffect(() => {
    if (!classId) return
    let cancelled = false
    setMarked({}); setMsg(''); setErr(''); setStudents(null); setExisting(false); setQ('')
    Promise.all([
      api.get(`/attendance/class/${classId}/students`),
      api.get('/attendance/session', { params: { classroom_id: classId, attendance_date: date, period_number: period } }),
    ]).then(([s, session]) => {
      if (cancelled) return
      setStudents(s.data.students)
      if (session.data.exists) {
        const m: Record<number, Mark> = {}
        session.data.records.forEach((r: SessionRecord) => { m[r.student_id] = { status: r.status, reason: r.reason } })
        setMarked(m); setExisting(true)
      }
    }).catch(e => { if (!cancelled) { setErr(getError(e)); setStudents([]) } })
    return () => { cancelled = true }
  }, [classId, period])

  function toggle(id: number) {
    setMsg('')
    setMarked(m => { const n = { ...m }; if (n[id]) delete n[id]; else n[id] = { status: 'absent' }; return n })
  }
  function setStatus(id: number, status: Status) { setMarked(m => ({ ...m, [id]: { ...m[id], status } })) }

  async function submit() {
    setErr(''); setMsg(''); setBusy(true)
    try {
      await api.post('/attendance/submit', {
        classroom_id: classId, attendance_date: date, period_number: period, subject: active?.subject || null,
        records: Object.entries(marked).map(([student_id, v]) => ({ student_id: +student_id, ...v })),
      })
      setMsg(`ثبت شد؛ ${num(Object.keys(marked).length)} مورد غیبت/تاخیر ثبت شد.`)
      setExisting(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { setErr(getError(e)) } finally { setBusy(false) }
  }

  const counts = useMemo(() => {
    const c = { absent: 0, excused: 0, late: 0 }
    Object.values(marked).forEach(m => { c[m.status]++ })
    return c
  }, [marked])
  const total = Object.keys(marked).length
  const visible = useMemo(() => (students || []).filter(s => !q.trim() || s.full_name.includes(q.trim()) || s.student_code.includes(q.trim())), [students, q])

  const steps = [
    { label: 'انتخاب کلاس', ok: !!classId },
    { label: 'انتخاب زنگ', ok: !!classId },
    { label: 'بررسی لیست', ok: !!students && students.length > 0 },
    { label: 'ثبت نهایی', ok: !!msg },
  ]
  const current = msg ? 4 : students && students.length ? 3 : 1

  return (
    <>
      <PageHeader title="ثبت حضور و غیاب" description="همه حاضر فرض می‌شوند؛ فقط غایب‌ها و دیرآمده‌ها را انتخاب کنید."
        eyebrow={dateFa(new Date(), 'full')} />

      <ol className="steps" style={{ padding: 0, listStyle: 'none' }} aria-label="مراحل ثبت">
        {steps.map((s, i) => (
          <li key={s.label} className={'step' + (s.ok && i + 1 < current ? ' ok' : '') + (i + 1 === current ? ' on' : '')} aria-current={i + 1 === current ? 'step' : undefined}>
            <i>{s.ok && i + 1 < current ? <Check size={13} /> : num(i + 1)}</i><span>{s.label}</span>
          </li>
        ))}
      </ol>

      {err && <Alert tone="error" onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert tone="success" onClose={() => setMsg('')}>{msg}</Alert>}

      {classes === null ? <Card><div className="stack"><Skeleton h={44} /><Skeleton h={44} /></div></Card>
        : classes.length === 0 ? <Card><EmptyState icon={ClipboardList} title="کلاسی برای ثبت وجود ندارد" text={user.role === 'teacher' ? 'هنوز کلاسی به شما اختصاص داده نشده است. از مدیر مدرسه بخواهید کلاس‌های شما را تعریف کند.' : 'ابتدا از بخش تنظیمات مدرسه کلاس تعریف کنید.'} /></Card>
        : (
          <>
            <Card className="att-picker">
              <Field label="کلاس">
                <select value={classId} onChange={e => { setClassId(+e.target.value); setPeriod(1) }}>
                  {classes.map(c => <option value={c.classroom_id} key={`${c.classroom_id}-${c.subject}`}>{c.class_name}{c.subject ? ` — ${c.subject}` : ''}</option>)}
                </select>
              </Field>
              <div className="field">
                <span className="field-label">زنگ</span>
                <div className="seg" role="group" aria-label="انتخاب زنگ">
                  {Array.from({ length: active?.periods_count || 4 }, (_, i) => (
                    <button key={i} type="button" aria-pressed={period === i + 1} onClick={() => setPeriod(i + 1)}>
                      {num(i + 1)}
                      {active?.periods?.[i]?.starts_at && active.periods[i].ends_at && <small className="period-time">{faDigits(active.periods[i].starts_at.slice(0, 5))}–{faDigits(active.periods[i].ends_at.slice(0, 5))}</small>}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {existing && !msg && (
              <div className="session-banner"><History size={18} />برای این کلاس و زنگ قبلاً حضور و غیاب ثبت شده است. می‌توانید آن را ویرایش و دوباره ثبت کنید.</div>
            )}

            <Card className="card-flush">
              <div className="list-head">
                <div className="row">
                  <b>{active?.class_name}</b>
                  {students && <Badge tone="neutral" icon={Users}>{num(students.length)} دانش‌آموز</Badge>}
                </div>
                <div className="input-wrap" style={{ minWidth: 220, flex: '0 1 280px' }}>
                  <Search size={17} aria-hidden />
                  <input className="input" placeholder="جستجوی نام یا کد" value={q} onChange={e => setQ(e.target.value)} aria-label="جستجوی دانش‌آموز" />
                </div>
              </div>

              {students === null ? (
                <div className="student-list" role="status" aria-label="در حال دریافت لیست دانش‌آموزان">{Array.from({ length: 8 }, (_, i) => <div key={i} className="s-row"><div className="s-main"><Skeleton h={26} w={26} r={8} /><div style={{ flex: 1 }}><Skeleton h={14} w="60%" /></div></div></div>)}</div>
              ) : students.length === 0 ? (
                <EmptyState icon={Users} title="دانش‌آموزی در این کلاس نیست" text="دانش‌آموزان را از بخش «دانش‌آموزان» با فایل Excel وارد کنید." />
              ) : visible.length === 0 ? (
                <EmptyState icon={Search} title="موردی پیدا نشد" text="عبارت جستجو را تغییر دهید." />
              ) : (
                <div className="student-list">
                  {visible.map(s => {
                    const val = marked[s.id]
                    return (
                      <div key={s.id} className={'s-row' + (val ? ` on st-${val.status}` : '')}>
                        <button type="button" className="s-main" onClick={() => toggle(s.id)} aria-pressed={!!val}>
                          <span className="s-box">{val && <Check size={16} strokeWidth={3} />}</span>
                          <span><span className="s-name">{s.full_name}</span><span className="s-code num">{num(s.student_code)}</span></span>
                        </button>
                        {val && (
                          <div className="s-status" role="group" aria-label={`وضعیت ${s.full_name}`}>
                            {(Object.keys(STATUS_LABEL) as Status[]).map(k => (
                              <button key={k} type="button" aria-pressed={val.status === k} onClick={() => setStatus(s.id, k)}>{STATUS_LABEL[k]}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {students && students.length > 0 && (
              <div className="action-bar">
                <div className="tally" aria-live="polite">
                  <div><span className="tally-big">{num(total)}</span> <small className="muted">نفر انتخاب‌شده</small></div>
                  <div className="tally-parts">
                    {counts.absent > 0 && <Badge tone="danger">{num(counts.absent)} غایب</Badge>}
                    {counts.excused > 0 && <Badge tone="info">{num(counts.excused)} موجه</Badge>}
                    {counts.late > 0 && <Badge tone="warning">{num(counts.late)} دیرآمده</Badge>}
                    {total === 0 && <Badge tone="success" icon={CheckCheck}>همه حاضر</Badge>}
                  </div>
                </div>
                <div className="row">
                  <Button variant="ghost" icon={UserRoundX} onClick={() => setMarked({})} disabled={total === 0} title="همه انتخاب‌ها پاک می‌شود؛ سپس با «ثبت نهایی» حضور کامل ثبت می‌شود">هیچ غایبی ندارد</Button>
                  <Button variant="primary" size="lg" icon={Send} loading={busy} onClick={submit}>{total === 0 ? 'ثبت (بدون غایب)' : 'ثبت نهایی'}</Button>
                </div>
              </div>
            )}
          </>
        )}
    </>
  )
}
