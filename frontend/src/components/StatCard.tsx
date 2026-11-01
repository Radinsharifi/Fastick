import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Props = {
  title: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  icon: LucideIcon
  tone?: 'brand' | 'danger' | 'warning' | 'success'
  progress?: number
}

export default function StatCard({ title, value, unit, sub, icon: Icon, tone = 'brand', progress }: Props) {
  return (
    <div className={`kpi tone-${tone}`}>
      <div className="kpi-top">
        <span className="kpi-label">{title}</span>
        <span className="kpi-icon"><Icon size={20} aria-hidden /></span>
      </div>
      <div className="kpi-value">{value}{unit && <small>{unit}</small>}</div>
      {progress !== undefined && (
        <div className="meter" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={title}>
          <i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}
