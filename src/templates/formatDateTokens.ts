const TOKEN_RE = /YYYY|MM|DD|ddd|dddd|HH|mm|ss/g

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

/** Format a local date using a small Obsidian-compatible token subset. */
export function formatDateWithPattern(date: Date, pattern: string): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const h = date.getHours()
  const min = date.getMinutes()
  const sec = date.getSeconds()
  const wd = date.getDay()

  const map: Record<string, string> = {
    YYYY: String(y),
    MM: String(m).padStart(2, '0'),
    DD: String(d).padStart(2, '0'),
    ddd: WEEKDAY_SHORT[wd] ?? '',
    dddd: WEEKDAY_LONG[wd] ?? '',
    HH: String(h).padStart(2, '0'),
    mm: String(min).padStart(2, '0'),
    ss: String(sec).padStart(2, '0'),
  }

  return pattern.replace(TOKEN_RE, (token) => map[token] ?? token)
}
