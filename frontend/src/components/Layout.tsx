import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CalendarCheck, ChevronDown, FileBarChart2, GraduationCap, LayoutDashboard, LogOut, Menu, Settings, Users, WalletCards, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '../api'
import type { CurrentUser, Role } from '../types'
import { BrandMark } from './ui'
import InstallReminder from './InstallReminder'
import { dateFa, initials, num, ROLE_LABEL, tehranClockFa } from '../lib/format'

type Item = { to: string; label: string; icon: LucideIcon; roles: readonly Role[] }
// Same routes and role permissions as before, grouped for a clearer hierarchy.
const groups: { title: string; items: Item[] }[] = [
  { title: 'کار روزانه', items: [
    { to: '/', label: 'داشبورد', icon: LayoutDashboard, roles: ['manager', 'deputy', 'teacher'] },
    { to: '/attendance', label: 'ثبت حضور و غیاب', icon: CalendarCheck, roles: ['manager', 'deputy', 'teacher'] },
    { to: '/notifications', label: 'اعلان‌ها', icon: Bell, roles: ['manager', 'deputy', 'teacher'] },
  ] },
  { title: 'مدیریت و گزارش', items: [
    { to: '/reports', label: 'گزارش‌ها', icon: FileBarChart2, roles: ['manager', 'deputy'] },
    { to: '/students', label: 'دانش‌آموزان', icon: GraduationCap, roles: ['manager', 'deputy'] },
    { to: '/staff', label: 'کاربران و معلمان', icon: Users, roles: ['manager'] },
  ] },
  { title: 'مدرسه', items: [
    { to: '/settings', label: 'تنظیمات مدرسه', icon: Settings, roles: ['manager'] },
    { to: '/subscription', label: 'اشتراک', icon: WalletCards, roles: ['manager'] },
  ] },
]
const titles: Record<string, string> = Object.fromEntries(groups.flatMap(g => g.items.map(i => [i.to, i.label])))

function TehranClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <time className="top-date-time" dateTime={now.toISOString()}>
      <span>{dateFa(now, 'short')}</span><span>{tehranClockFa(now)}</span>
    </time>
  )
}

export default function Layout({ user }: { user: CurrentUser }) {
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [unread, setUnread] = useState(user.unread_notifications || 0)
  const menuRef = useRef<HTMLDivElement>(null)
  const recordedPageViews = useRef(new Set<string>())

  useEffect(() => { setOpen(false); setMenu(false) }, [loc.pathname])
  useEffect(() => { setUnread(user.unread_notifications || 0) }, [user.unread_notifications])
  useEffect(() => {
    const refresh = () => api.get('/me').then(r => setUnread(r.data.unread_notifications || 0)).catch(() => {})
    window.addEventListener('fastick:notifications', refresh)
    return () => window.removeEventListener('fastick:notifications', refresh)
  }, [])
  useEffect(() => {
    const key = `${user.id}:${loc.key}:${loc.pathname}`
    if (recordedPageViews.current.has(key)) return
    recordedPageViews.current.add(key)
    api.post('/analytics/page-view', { event: 'page_view', page: loc.pathname })
      .catch(error => console.warn('FASTICK page-view analytics could not be recorded.', error))
  }, [user.id, loc.key, loc.pathname])
  useEffect(() => {
    if (!menu) return
    const onDoc = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [menu])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    nav('/login')
  }
  const visible = groups.map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(user.role)) })).filter(g => g.items.length)
  const page = titles[loc.pathname] || ''

  return (
    <div className="app-shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden />}
      <aside className={'sidebar' + (open ? ' open' : '')} aria-label="منوی اصلی">
        <div className="sb-brand">
          <BrandMark size={42} />
          <div><b>فستیک</b><small>سامانه هوشمند حضور و غیاب مدارس</small></div>
        </div>
        <div className="sb-school">
          <small>مدرسه</small>
          <b>{user.school?.name || 'مدیریت پلتفرم'}</b>
          {user.school?.code && <code>{user.school.code}</code>}
        </div>
        <nav>
          {visible.map(g => (
            <div key={g.title}>
              <div className="sb-group">{g.title}</div>
              <div className="sb-nav">
                {g.items.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} end={to === '/'} className="sb-link">
                    <Icon size={19} aria-hidden /><span>{label}</span>
                    {to === '/notifications' && unread > 0 && <span className="sb-badge">{num(unread)}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="sb-foot">
          <button className="sb-logout" onClick={logout}><LogOut size={19} aria-hidden />خروج از حساب</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(o => !o)} aria-label={open ? 'بستن منو' : 'باز کردن منو'} aria-expanded={open}>
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
          <div className="crumbs"><span>فستیک</span><span aria-hidden>/</span><b>{page}</b></div>
          <div className="top-spacer" />
          <TehranClock />
          {user.school?.code && <span className="top-chip">کد مدرسه: <span className="ltr">{user.school.code}</span></span>}
          <NavLink to="/notifications" className="icon-btn bell" aria-label={unread ? `اعلان‌ها، ${num(unread)} خوانده‌نشده` : 'اعلان‌ها'}>
            <Bell size={20} />{unread > 0 && <span className="bell-dot">{num(unread)}</span>}
          </NavLink>
          <div className="profile" ref={menuRef}>
            <button className="profile-btn" onClick={() => setMenu(m => !m)} aria-haspopup="menu" aria-expanded={menu}>
              <span className="profile-meta"><b>{user.full_name}</b><small>{ROLE_LABEL[user.role]}</small></span>
              <span className="avatar">{initials(user.full_name)}</span>
              <ChevronDown size={14} className="muted" aria-hidden />
            </button>
            {menu && (
              <div className="profile-menu" role="menu">
                <div className="profile-menu-head"><b>{user.full_name}</b><small>{ROLE_LABEL[user.role]}{user.phone && <> · <span className="ltr">{user.phone}</span></>}</small></div>
                {user.role === 'manager' && <button className="menu-item" role="menuitem" onClick={() => nav('/subscription')}><WalletCards size={16} />اشتراک</button>}
                <button className="menu-item danger" role="menuitem" onClick={logout}><LogOut size={16} />خروج از حساب</button>
              </div>
            )}
          </div>
        </header>
        <div className="page"><Outlet /></div>
      </div>
      <InstallReminder />
    </div>
  )
}
