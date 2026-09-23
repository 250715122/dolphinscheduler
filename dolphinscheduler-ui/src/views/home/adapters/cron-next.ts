/**
 * Compute next Quartz cron fire time for homepage "upcoming schedules".
 * Supports common DS patterns (6/7-field Quartz). Falls back to null if too complex.
 */

const isNum = (s: string) => /^\d+$/.test(s)

function parseQuartz(crontab: string): string[] | null {
  const parts = crontab.trim().split(/\s+/)
  if (parts.length < 6) return null
  return parts
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Convert DOW quartz (1=SUN..7=SAT or names) to JS getDay() (0=SUN..6=SAT). */
function quartzDowToJs(dow: string): number | null {
  const map: Record<string, number> = {
    '1': 0,
    SUN: 0,
    '2': 1,
    MON: 1,
    '3': 2,
    TUE: 2,
    '4': 3,
    WED: 3,
    '5': 4,
    THU: 4,
    '6': 5,
    FRI: 5,
    '7': 6,
    SAT: 6
  }
  return map[dow.toUpperCase()] ?? (isNum(dow) ? null : null)
}

function atLocal(
  base: Date,
  hour: number,
  minute: number,
  second = 0
): Date {
  const d = new Date(base.getTime())
  d.setHours(hour, minute, second, 0)
  return d
}

/**
 * @returns epoch ms of next fire, or null if cannot determine
 */
export function nextCronFireMs(
  crontab: string | undefined | null,
  fromMs: number = Date.now()
): number | null {
  if (!crontab || !crontab.trim()) return null
  const parts = parseQuartz(crontab)
  if (!parts) return null
  const [, min, hour, dom, month, dow] = parts
  const from = new Date(fromMs)

  // every N minutes: 0 0/N * * * ?  or 0 */N * * * ?
  if (
    (min.startsWith('0/') || min.startsWith('*/')) &&
    (hour === '*' || hour === '?') &&
    (dom === '*' || dom === '?') &&
    month === '*'
  ) {
    const n = Number(min.split('/')[1])
    if (!n || n <= 0) return null
    const d = new Date(from.getTime())
    d.setSeconds(0, 0)
    const m = d.getMinutes()
    const nextMin = Math.floor(m / n) * n + n
    if (nextMin >= 60) {
      d.setHours(d.getHours() + 1, nextMin - 60, 0, 0)
    } else {
      d.setMinutes(nextMin, 0, 0)
    }
    return d.getTime()
  }

  // hourly at minute M: 0 M * * * ?
  if (
    isNum(min) &&
    (hour === '*' || hour === '?') &&
    (dom === '*' || dom === '?') &&
    month === '*'
  ) {
    const m = Number(min)
    let d = atLocal(from, from.getHours(), m, 0)
    if (d.getTime() <= fromMs) {
      d = atLocal(from, from.getHours() + 1, m, 0)
    }
    return d.getTime()
  }

  // daily at H:M (dom * or ?, dow ? or *)
  if (
    isNum(min) &&
    isNum(hour) &&
    month === '*' &&
    (dom === '*' || dom === '?') &&
    (dow === '?' || dow === '*')
  ) {
    const h = Number(hour)
    const m = Number(min)
    let d = atLocal(from, h, m, 0)
    if (d.getTime() <= fromMs) {
      d = new Date(d.getTime())
      d.setDate(d.getDate() + 1)
    }
    return d.getTime()
  }

  // weekly: 0 M H ? * DOW  or 0 M H * * DOW
  if (isNum(min) && isNum(hour) && month === '*' && (dom === '?' || dom === '*')) {
    const h = Number(hour)
    const m = Number(min)
    const dayTokens = dow.split(',').map((x) => x.trim()).filter(Boolean)
    const jsDays = dayTokens
      .map(quartzDowToJs)
      .filter((x): x is number => x !== null)
    if (jsDays.length === 0) return null
    for (let add = 0; add <= 7; add++) {
      const d = new Date(from.getTime())
      d.setDate(from.getDate() + add)
      d.setHours(h, m, 0, 0)
      if (jsDays.includes(d.getDay()) && d.getTime() > fromMs) {
        return d.getTime()
      }
    }
  }

  // monthly day D at H:M: 0 M H D * ?
  if (isNum(min) && isNum(hour) && isNum(dom) && month === '*') {
    const h = Number(hour)
    const m = Number(min)
    const day = Number(dom)
    let d = new Date(from.getFullYear(), from.getMonth(), day, h, m, 0, 0)
    if (d.getTime() <= fromMs) {
      d = new Date(from.getFullYear(), from.getMonth() + 1, day, h, m, 0, 0)
    }
    return d.getTime()
  }

  // fallback: if hour+min numeric, treat as daily
  if (isNum(min) && isNum(hour)) {
    const h = Number(hour)
    const m = Number(min)
    let d = atLocal(from, h, m, 0)
    if (d.getTime() <= fromMs) {
      d = new Date(d.getTime())
      d.setDate(d.getDate() + 1)
    }
    return d.getTime()
  }

  return null
}

/** Display like 09:30 or 09-24 09:30 when not today. */
export function formatNextFireDisplay(
  crontab: string | undefined | null,
  fromMs: number = Date.now()
): { display: string; sortMs: number } {
  const ms = nextCronFireMs(crontab, fromMs)
  if (ms == null) {
    return { display: '--:--', sortMs: Number.MAX_SAFE_INTEGER }
  }
  const d = new Date(ms)
  const now = new Date(fromMs)
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  if (sameDay) {
    return { display: hm, sortMs: ms }
  }
  return {
    display: `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${hm}`,
    sortMs: ms
  }
}
