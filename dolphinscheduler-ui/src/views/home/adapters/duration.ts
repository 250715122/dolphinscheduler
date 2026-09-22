/** Parse DS duration strings into seconds for ranking */
export function durationToSeconds(raw?: string | null): number {
  if (!raw) return 0
  const d = String(raw).trim()
  if (!d || d === '-') return 0
  // HH:MM:SS or H:MM:SS
  const hms = d.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (hms) {
    return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3])
  }
  // MM:SS
  const ms = d.match(/^(\d+):(\d{2})$/)
  if (ms) return Number(ms[1]) * 60 + Number(ms[2])
  let sec = 0
  const day = d.match(/(\d+)\s*d/i)
  const hour = d.match(/(\d+)\s*h/i)
  const min = d.match(/(\d+)\s*m(?!s)/i)
  const second = d.match(/(\d+)\s*s/i)
  if (day) sec += Number(day[1]) * 86400
  if (hour) sec += Number(hour[1]) * 3600
  if (min) sec += Number(min[1]) * 60
  if (second) sec += Number(second[1])
  if (sec > 0) return sec
  const n = Number(d)
  return Number.isFinite(n) ? n : 0
}

export function formatDurationSec(sec: number): string {
  if (!sec || sec < 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (s || !parts.length) parts.push(`${s}s`)
  return parts.join(' ')
}
