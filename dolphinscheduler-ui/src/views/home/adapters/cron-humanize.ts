/** Soft humanize Quartz/crontab for homepage display; raw cron stays in tooltip. */
export function humanizeCrontab(
  crontab: string | undefined | null,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (!crontab || !crontab.trim()) return t('home.ops_cron_raw')
  const parts = crontab.trim().split(/\s+/)
  // quartz: sec min hour dom month dow [year]
  if (parts.length < 6) return crontab
  const [, min, hour, dom, month, dow] = parts

  const pad = (n: string) => n.padStart(2, '0')
  const isNum = (s: string) => /^\d+$/.test(s)

  if (min.startsWith('0/') || min.startsWith('*/')) {
    const n = min.split('/')[1]
    if (n && isNum(n)) return t('home.ops_cron_every_n_min', { n: Number(n) })
  }

  if (isNum(min) && isNum(hour) && (dom === '*' || dom === '?') && month === '*') {
    const time = `${pad(hour)}:${pad(min)}`
    if (dow === '?' || dow === '*') {
      return t('home.ops_cron_daily', { time })
    }
    const dayMap: Record<string, string> = {
      '1': 'SUN',
      '2': 'MON',
      '3': 'TUE',
      '4': 'WED',
      '5': 'THU',
      '6': 'FRI',
      '7': 'SAT',
      SUN: 'SUN',
      MON: 'MON',
      TUE: 'TUE',
      WED: 'WED',
      THU: 'THU',
      FRI: 'FRI',
      SAT: 'SAT'
    }
    const days = dow
      .split(',')
      .map((d) => dayMap[d.toUpperCase()] || d)
      .join(',')
    return t('home.ops_cron_weekly', { days, time })
  }

  if (isNum(min) && hour === '*' && (dom === '*' || dom === '?') && month === '*') {
    return t('home.ops_cron_hourly', { m: pad(min) })
  }

  if (isNum(min) && isNum(hour) && isNum(dom) && month === '*') {
    return t('home.ops_cron_monthly', {
      day: Number(dom),
      time: `${pad(hour)}:${pad(min)}`
    })
  }

  return t('home.ops_cron_raw')
}
