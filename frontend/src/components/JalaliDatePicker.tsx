import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { faDigits, jalaliDateParts, jalaliDateLabel, jalaliToGregorian, tehranISODate } from '../lib/format'

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

type Props = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}

function gregorianWeekOffset(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  return (new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay() + 1) % 7
}

function monthDays(year: number, month: number): number {
  for (let day = 31; day >= 29; day--) {
    if (jalaliToGregorian(`${year}/${month}/${day}`)) return day
  }
  return 28
}

export default function JalaliDatePicker({ value, onChange, ariaLabel }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 12, top: 12 })
  const [draft, setDraft] = useState(jalaliDateLabel(value))
  const current = jalaliDateParts(value || tehranISODate()) || { year: 1405, month: 1, day: 1 }
  const [visible, setVisible] = useState({ year: current.year, month: current.month })

  useEffect(() => {
    setDraft(jalaliDateLabel(value))
    if (!open && value) setVisible({ year: current.year, month: current.month })
  }, [value, open, current.year, current.month])

  useEffect(() => {
    if (!open) return
    const placeCalendar = () => {
      const rect = root.current?.getBoundingClientRect()
      if (!rect) return
      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = document.documentElement.clientHeight
      const width = Math.min(280, viewportWidth - 24)
      const height = 330
      const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12))
      const below = rect.bottom + 6
      const top = below + height <= viewportHeight - 12
        ? below
        : Math.max(12, rect.top - height - 6)
      setPosition({ left, top })
    }
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    placeCalendar()
    window.addEventListener('resize', placeCalendar)
    window.addEventListener('scroll', placeCalendar, true)
    document.addEventListener('mousedown', closeOutside)
    return () => {
      window.removeEventListener('resize', placeCalendar)
      window.removeEventListener('scroll', placeCalendar, true)
      document.removeEventListener('mousedown', closeOutside)
    }
  }, [open])

  function chooseMonth(delta: number) {
    const serial = visible.year * 12 + visible.month - 1 + delta
    setVisible({ year: Math.floor(serial / 12), month: serial % 12 + 1 })
  }

  function updateDraft(text: string) {
    setDraft(text)
    const iso = jalaliToGregorian(text)
    if (iso) {
      onChange(iso)
      const parts = jalaliDateParts(iso)
      if (parts) setVisible({ year: parts.year, month: parts.month })
    }
  }

  const monthStart = jalaliToGregorian(`${visible.year}/${visible.month}/1`)
  const offset = monthStart ? gregorianWeekOffset(monthStart) : 0
  const count = monthDays(visible.year, visible.month)
  const monthDate = jalaliToGregorian(`${visible.year}/${visible.month}/15`)
  const monthTitle = monthDate
    ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long', timeZone: 'UTC' }).format(new Date(`${monthDate}T12:00:00Z`))
    : ''

  return (
    <div className="jalali-picker" ref={root}>
      <div className="jalali-input-wrap">
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          aria-label={ariaLabel}
          placeholder="۱۴۰۵/۰۱/۰۱"
          value={draft}
          onChange={event => updateDraft(event.target.value)}
          onBlur={() => {
            if (draft && !jalaliToGregorian(draft)) setDraft(jalaliDateLabel(value))
          }}
        />
        <button type="button" className="icon-btn" aria-label="باز کردن تقویم" aria-expanded={open} onClick={() => setOpen(v => !v)}>
          <CalendarDays size={17} />
        </button>
      </div>
      {open && (
        <div className="jalali-calendar" style={position} role="dialog" aria-label={`تقویم ${monthTitle} ${faDigits(visible.year)}`}>
          <div className="jalali-calendar-head">
            <button type="button" className="icon-btn" aria-label="ماه قبل" onClick={() => chooseMonth(-1)}><ChevronRight size={17} /></button>
            <b>{monthTitle} {faDigits(visible.year)}</b>
            <button type="button" className="icon-btn" aria-label="ماه بعد" onClick={() => chooseMonth(1)}><ChevronLeft size={17} /></button>
          </div>
          <div className="jalali-calendar-grid" role="grid">
            {WEEKDAYS.map((day, index) => <span className="jalali-weekday" key={`${day}-${index}`} role="columnheader">{day}</span>)}
            {Array.from({ length: 42 }, (_, index) => {
              const day = index - offset + 1
              if (day < 1 || day > count) return <span className="jalali-day-empty" key={index} />
              const iso = jalaliToGregorian(`${visible.year}/${visible.month}/${day}`)
              const selected = iso === value
              return (
                <button
                  type="button"
                  className={`jalali-day${selected ? ' selected' : ''}`}
                  key={index}
                  role="gridcell"
                  aria-pressed={selected}
                  onClick={() => {
                    if (iso) onChange(iso)
                    setDraft(jalaliDateLabel(iso || ''))
                    setOpen(false)
                  }}
                >{faDigits(day)}</button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
