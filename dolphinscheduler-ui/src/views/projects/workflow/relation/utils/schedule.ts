/** Parse Quartz/unix crontabs into same-day fire points for the relation timeline. */

export type ScheduleCycle = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'unknown'

export interface DayFire {
  /** minutes from 00:00, 0–1439 */
  startMin: number
  label: string
}

export interface DaySchedule {
  fires: DayFire[]
  cycle: ScheduleCycle
  /** short human summary, e.g. 每天 09:30 / 每小时 :00 / 08:00,14:00,20:00 */
  summary: string
}

/** @deprecated kept for TopologyGraph / DetailDrawer label */
export interface DayWindow {
  startMin: number
  durationMin: number
  label: string
  cycle: ScheduleCycle
}

const isNum = (s: string) => /^\d+$/.test(s)

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function range(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let i = lo; i <= hi; i++) out.push(i)
  return out
}

/** Expand a cron field to concrete integers within [min,max]. */
export function expandCronField(field: string, min: number, max: number): number[] {
  if (!field || field === '*' || field === '?') {
    return range(min, max)
  }
  const out = new Set<number>()
  for (const raw of field.split(',')) {
    const part = raw.trim()
    if (!part) continue
    if (part.includes('/')) {
      const [base, stepStr] = part.split('/')
      const step = Number(stepStr)
      if (!Number.isFinite(step) || step <= 0) continue
      let start = min
      let end = max
      if (base && base !== '*' && base !== '?') {
        if (base.includes('-')) {
          const [a, b] = base.split('-').map(Number)
          if (Number.isFinite(a) && Number.isFinite(b)) {
            start = a
            end = b
          }
        } else if (isNum(base)) {
          start = Number(base)
        }
      }
      for (let i = start; i <= end; i += step) {
        if (i >= min && i <= max) out.add(i)
      }
      continue
    }
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number)
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue
      for (let i = a; i <= b; i++) {
        if (i >= min && i <= max) out.add(i)
      }
      continue
    }
    if (isNum(part)) {
      const n = Number(part)
      if (n >= min && n <= max) out.add(n)
    }
  }
  return [...out].sort((a, b) => a - b)
}

function detectCycle(
  minuteField: string,
  hourField: string,
  domField: string,
  dowField: string
): ScheduleCycle {
  if (minuteField.includes('/')) return 'minute'
  if (hourField === '*' || hourField === '?' || hourField.includes('/')) return 'hour'
  if (dowField !== '?' && dowField !== '*') return 'week'
  if (domField !== '*' && domField !== '?') return 'month'
  return 'day'
}

function buildSummary(
  cycle: ScheduleCycle,
  fires: DayFire[],
  minutes: number[],
  hours: number[]
): string {
  if (fires.length === 0) return '—'
  if (cycle === 'minute') {
    const stepMatch = fires.length >= 2 ? Math.round(24 * 60 / fires.length) : 0
    return stepMatch > 0 ? `每${stepMatch}分钟 (${fires.length}次/日)` : `${fires.length}次/日`
  }
  if (cycle === 'hour') {
    const m = minutes.length === 1 ? pad2(minutes[0]) : minutes.map(pad2).join(',')
    return `每小时 :${m} (${fires.length}次/日)`
  }
  if (fires.length <= 6) {
    return fires.map((f) => f.label).join(', ')
  }
  return `${fires[0].label} … ${fires[fires.length - 1].label} (${fires.length}次/日)`
}

/**
 * Expand crontab to all fire times within a representative day (00:00–23:59).
 * Quartz: sec min hour dom month dow [year]
 * Unix:   min hour dom month dow
 */
export function crontabToDaySchedule(crontab?: string | null): DaySchedule | null {
  if (!crontab || !String(crontab).trim()) return null
  const parts = String(crontab).trim().split(/\s+/)
  let minuteField: string
  let hourField: string
  let domField: string
  let dowField: string

  if (parts.length >= 6) {
    minuteField = parts[1]
    hourField = parts[2]
    domField = parts[3]
    dowField = parts[5]
  } else if (parts.length >= 5) {
    minuteField = parts[0]
    hourField = parts[1]
    domField = parts[2]
    dowField = parts[4]
  } else {
    return null
  }

  const minutes = expandCronField(minuteField, 0, 59)
  const hours = expandCronField(hourField, 0, 23)
  if (minutes.length === 0 || hours.length === 0) return null

  const cycle = detectCycle(minuteField, hourField, domField, dowField)
  const fires: DayFire[] = []
  for (const h of hours) {
    for (const m of minutes) {
      const startMin = h * 60 + m
      fires.push({
        startMin,
        label: `${pad2(h)}:${pad2(m)}`
      })
    }
  }
  // unique + sort (cartesian can duplicate on weird fields)
  const uniq = new Map<number, DayFire>()
  fires.forEach((f) => uniq.set(f.startMin, f))
  const sorted = [...uniq.values()].sort((a, b) => a.startMin - b.startMin)

  return {
    fires: sorted,
    cycle,
    summary: buildSummary(cycle, sorted, minutes, hours)
  }
}

/** Compat wrapper: first fire + summary label for non-timeline consumers. */
export function crontabToDayWindow(crontab?: string | null): DayWindow | null {
  const s = crontabToDaySchedule(crontab)
  if (!s || s.fires.length === 0) return null
  return {
    startMin: s.fires[0].startMin,
    durationMin: s.cycle === 'week' ? 180 : s.cycle === 'hour' || s.cycle === 'minute' ? 20 : 90,
    label: s.summary,
    cycle: s.cycle
  }
}

export function minutesToPct(min: number): number {
  return Math.max(0, Math.min(100, (min / (24 * 60)) * 100))
}
