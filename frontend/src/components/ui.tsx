import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/* ───────── Buttons ───────── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: LucideIcon
}
export function Button({ variant = 'secondary', size = 'md', loading, icon: Icon, children, className = '', disabled, type = 'button', ...rest }: BtnProps) {
  return (
    <button type={type} className={`btn btn-${variant} btn-${size} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 size={17} className="spin" aria-hidden /> : Icon ? <Icon size={17} aria-hidden /> : null}
      {children}
    </button>
  )
}

/* ───────── Page header ───────── */
export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}

export function Card({ children, className = '', as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={`card ${className}`}>{children}</Tag>
}

export function SectionHeader({ title, description, action, icon: Icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="section-header">
      <div className="section-header-main">
        {Icon && <span className="section-icon"><Icon size={18} aria-hidden /></span>}
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

/* ───────── Badges ───────── */
export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'
export function Badge({ tone = 'neutral', children, dot, icon: Icon }: { tone?: Tone; children: ReactNode; dot?: boolean; icon?: LucideIcon }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <i className="badge-dot" aria-hidden />}
      {Icon && <Icon size={13} aria-hidden />}
      {children}
    </span>
  )
}

/* ───────── Alerts ───────── */
const alertIcon = { success: CheckCircle2, error: AlertCircle, warning: TriangleAlert, info: Info }
export function Alert({ tone = 'info', children, onClose, action }: { tone?: 'success' | 'error' | 'warning' | 'info'; children: ReactNode; onClose?: () => void; action?: ReactNode }) {
  const Icon = alertIcon[tone]
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={19} aria-hidden />
      <div className="alert-body">{children}</div>
      {action}
      {onClose && <button type="button" className="icon-btn" onClick={onClose} aria-label="بستن"><X size={16} /></button>}
    </div>
  )
}

/* ───────── Form field ───────── */
export function Field({ label, hint, error, children, className = '' }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

/* ───────── Empty & skeleton ───────── */
export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={26} aria-hidden /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function Skeleton({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <span className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden />
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-skeleton" role="status" aria-label="در حال بارگذاری">
      {Array.from({ length: rows }, (_, i) => (
        <div className="table-skeleton-row" key={i}>
          {Array.from({ length: cols }, (_, j) => <Skeleton key={j} h={14} w={j === 0 ? '60%' : '80%'} />)}
        </div>
      ))}
    </div>
  )
}

/* ───────── Dialog ───────── */
export function Dialog({ open, title, description, onClose, children, footer, size = 'md' }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    const first = el?.querySelector<HTMLElement>('input,select,textarea,button:not(.dialog-close)')
    first?.focus()
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab' || !el) return
      const f = Array.from(el.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'))
      if (!f.length) return
      const a = f[0], z = f[f.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus() }
  }, [open])
  if (!open) return null
  return (
    <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`dialog dialog-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="dialog-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-btn dialog-close" onClick={onClose} aria-label="بستن"><X size={18} /></button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  )
}

/* ───────── Toasts ───────── */
type ToastItem = { id: number; tone: 'success' | 'error' | 'info'; text: string }
const ToastCtx = createContext<(tone: ToastItem['tone'], text: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((tone: ToastItem['tone'], text: string) => {
    const id = Date.now() + Math.random()
    setItems(x => [...x, { id, tone, text }])
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 5000)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-region" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.tone === 'success' ? <CheckCircle2 size={18} /> : t.tone === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
            <span>{t.text}</span>
            <button type="button" className="icon-btn" aria-label="بستن" onClick={() => setItems(x => x.filter(i => i.id !== t.id))}><X size={15} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/* ───────── Brand mark ───────── */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="48" height="48" rx="13" fill="#fff" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="var(--c-accent-500)" strokeWidth="2.5" />
      <path d="m18.5 24 3.8 3.8 7.5-8" fill="none" stroke="var(--c-accent-600)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
