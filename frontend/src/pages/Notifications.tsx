import { useEffect, useState } from 'react'
import { Bell, BellRing, CheckCheck } from 'lucide-react'
import { api, getError } from '../api'
import type { AppNotification } from '../types'
import { Alert, Badge, Card, EmptyState, PageHeader, TableSkeleton } from '../components/ui'
import { dateTimeFa, num } from '../lib/format'

export default function Notifications() {
  const [rows, setRows] = useState<AppNotification[] | null>(null)
  const [err, setErr] = useState('')

  function load() { return api.get('/notifications').then(r => { setRows(r.data); setErr('') }).catch(e => { setErr(getError(e)); setRows(x => x ?? []) }) }
  useEffect(() => { load() }, [])

  async function read(n: AppNotification) {
    if (n.read_at) return
    try {
      await api.post(`/notifications/${n.id}/read`)
      await load()
      window.dispatchEvent(new Event('fastick:notifications'))
    } catch (e) { setErr(getError(e)) }
  }
  const unread = rows?.filter(n => !n.read_at).length || 0

  return (
    <>
      <PageHeader title="اعلان‌ها" description="یادآوری‌های حضور و غیاب و پیام‌های سامانه. برای علامت‌گذاری به‌عنوان خوانده‌شده روی اعلان بزنید."
        actions={rows && (unread > 0 ? <Badge tone="success" dot>{num(unread)} خوانده‌نشده</Badge> : rows.length > 0 ? <Badge tone="neutral" icon={CheckCheck}>همه خوانده شده</Badge> : null)} />
      {err && <Alert tone="error" onClose={() => setErr('')}>{err}</Alert>}
      <Card className="card-flush">
        {rows === null ? <TableSkeleton rows={4} cols={2} />
          : rows.length === 0 ? <EmptyState icon={Bell} title="اعلانی ندارید" text="وقتی یادآوری یا پیام جدیدی برسد اینجا نمایش داده می‌شود." />
          : rows.map(n => {
            const body = (
              <>
                <span className="notif-ic">{n.read_at ? <Bell size={18} aria-hidden /> : <BellRing size={18} aria-hidden />}</span>
                <span className="notif-body"><b>{!n.read_at && <i className="unread-dot" aria-label="خوانده‌نشده" />}{n.title}</b><p>{n.message}</p></span>
                <time dateTime={n.created_at}>{dateTimeFa(n.created_at)}</time>
              </>
            )
            return n.read_at
              ? <div key={n.id} className="notif read">{body}</div>
              : <button key={n.id} type="button" className="notif unread" onClick={() => read(n)}>{body}</button>
          })}
      </Card>
    </>
  )
}
