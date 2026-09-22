/** Parse common Quartz/unix crontabs into a day-of window for timeline. */
export interface DayWindow {
  startMin: number
  durationMin: number
  label: string
  cycle: 'hour' | 'day' | 'week' | 'month' | 'unknown'
}

function parseField(field: string): number | null {
  if (field === '*' || field.includes('/') || field.includes(',') || field.includes('-') || field === '?') {
    if (field.includes('/')) {
      const base = field.split('/')[0]
      if (base === '*' || base === '0') return 0
      const n = Number(base)
      return Number.isFinite(n) ? n : null
    }
    return null
  }
  const n = Number(field)
  return Number.isFinite(n) ? n : null
}

/** Quartz: sec min hour ... ; unix: min hour ... */
export function crontabToDayWindow(crontab?: string | null): DayWindow | null {
  if (!crontab || !String(crontab).trim()) return null
  const parts = String(crontab).trim().split(/\s+/)
  let minute = 0
  let hour: number | null = 0
  let cycle: DayWindow['cycle'] = 'unknown'

  if (parts.length >= 6) {
    // quartz
    minute = parseField(parts[1]) ?? 0
    const h = parseField(parts[2])
    hour = h
    if (parts[2] === '*' || (parts[2] || '').includes('/')) cycle = 'hour'
    else if (parts[3] === '*' || parts[3] === '?') cycle = 'day'
    else if ((parts[5] || '') !== '?' && (parts[5] || '') !== '*') cycle = 'week'
    else cycle = 'day'
  } else if (parts.length >= 5) {
    minute = parseField(parts[0]) ?? 0
    const h = parseField(parts[1])
    hour = h
    if (parts[1] === '*' || (parts[1] || '').includes('/')) cycle = 'hour'
    else cycle = 'day'
  } else {
    return null
  }

  if (cycle === 'hour') {
    // show a representative slot in the current visual day: :MM each hour -> use 10:MM as sample
    const startMin = 10 * 60 + Math.min(59, Math.max(0, minute))
    return { startMin, durationMin: 35, label: `*:${String(minute).padStart(2, '0')}`, cycle }
  }

  const h = hour == null ? 0 : Math.min(23, Math.max(0, hour))
  const startMin = h * 60 + Math.min(59, Math.max(0, minute))
  const durationMin = cycle === 'week' ? 180 : 90
  return {
    startMin,
    durationMin,
    label: `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    cycle
  }
}

export function minutesToPct(min: number): number {
  return Math.max(0, Math.min(100, (min / (24 * 60)) * 100))
}
