const nf = new Intl.NumberFormat('fa-IR')

/** Persian-digit number, e.g. 1250 -> ۱٬۲۵۰ */
export function num(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '—'
  const v = Number(n)
  return Number.isFinite(v) ? nf.format(v) : String(n)
}

/** Convert Latin digits inside an arbitrary string to Persian digits. */
export function faDigits(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return ''
  return String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
}

function parse(d: string | number | Date | null | undefined): Date | null {
  if (!d) return null
  const value = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z`
    : typeof d === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(d) && !/(Z|[+-]\d{2}:\d{2})$/.test(d) ? `${d}Z`
      : d
  const x = value instanceof Date ? value : new Date(value)
  return isNaN(x.getTime()) ? null : x
}

export function dateFa(d: string | number | Date | null | undefined, style: 'full' | 'long' | 'medium' | 'short' = 'medium'): string {
  const x = parse(d)
  return x ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: style, timeZone: 'Asia/Tehran' }).format(x) : '—'
}

export function dateTimeFa(d: string | number | Date | null | undefined): string {
  const x = parse(d)
  return x ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(x) : '—'
}

export function tehranClockFa(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('fa-IR', { timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(d)
}

export function shortDayFa(d: string | number | Date | null | undefined): string {
  const x = parse(d)
  return x ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tehran' }).format(x) : ''
}

export function weekdayFa(d: string | number | Date | null | undefined): string {
  const x = parse(d)
  return x ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'short', timeZone: 'Asia/Tehran' }).format(x) : ''
}

export function tehranISODate(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const value = (type: string) => parts.find(part => part.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

type PersianDateParts = { year: number; month: number; day: number }
const persianPartsFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
})

function persianParts(d: Date): PersianDateParts {
  const parts = persianPartsFormatter.formatToParts(d)
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value)
  return { year: value('year'), month: value('month'), day: value('day') }
}

export function jalaliDateParts(isoDate: string): PersianDateParts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return persianParts(date)
}

export function jalaliDateLabel(isoDate: string): string {
  const parts = jalaliDateParts(isoDate)
  return parts ? `${faDigits(parts.year)}/${faDigits(String(parts.month).padStart(2, '0'))}/${faDigits(String(parts.day).padStart(2, '0'))}` : ''
}

export function jalaliToGregorian(value: string): string | null {
  const latin = value
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .trim()
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(latin)
  if (!match) return null
  const target = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  if (target.month < 1 || target.month > 12 || target.day < 1 || target.day > 31) return null

  let low = Date.UTC(target.year + 621, 0, 1, 12)
  let high = Date.UTC(target.year + 623, 0, 1, 12)
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2 / 86400000) * 86400000
    const found = persianParts(new Date(middle))
    const before = found.year < target.year
      || (found.year === target.year && found.month < target.month)
      || (found.year === target.year && found.month === target.month && found.day < target.day)
    if (before) low = middle + 86400000
    else high = middle
  }
  const result = new Date(low)
  const found = persianParts(result)
  if (found.year !== target.year || found.month !== target.month || found.day !== target.day) return null
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`
}

export function tehranDateDaysAgo(days: number, now: Date = new Date()): string {
  const today = tehranISODate(now)
  const date = new Date(`${today}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function tehranTimeMinutes(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value)
  return value('hour') * 60 + value('minute')
}

export function daysUntil(d: string | null | undefined): number | null {
  const x = parse(d)
  if (!x) return null
  return Math.ceil((x.getTime() - Date.now()) / 86400000)
}

export const ROLE_LABEL: Record<string, string> = {
  platform_admin: 'مدیر پلتفرم',
  manager: 'مدیر مدرسه',
  deputy: 'معاون',
  teacher: 'معلم',
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] || '') + (parts.length > 1 ? '\u200c' + parts[parts.length - 1][0] : '')
}

export function saveBlob(blob: Blob, filename: string) {
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u
  a.download = filename
  a.click()
  URL.revokeObjectURL(u)
}
