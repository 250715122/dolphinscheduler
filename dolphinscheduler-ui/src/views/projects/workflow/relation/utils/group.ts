/** Soft name-prefix tag (first token). Not a fixed domain model. */
export function extractPrefix(name: string): string {
  const n = (name || '').trim()
  if (!n) return 'other'
  const m = n.match(/^([A-Za-z][A-Za-z0-9]*)/)
  return (m ? m[1] : n.split(/[_\-./]/)[0] || 'other').toLowerCase()
}

const PALETTE = [
  '#2563eb',
  '#0d9488',
  '#ea580c',
  '#7c3aed',
  '#db2777',
  '#0891b2',
  '#65a30d',
  '#ca8a04',
  '#4f46e5',
  '#dc2626'
]

export function prefixColor(prefix: string): string {
  const s = (prefix || 'other').toLowerCase()
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function collectPrefixes(names: string[]): string[] {
  const set = new Set<string>()
  names.forEach((n) => set.add(extractPrefix(n)))
  return Array.from(set).sort()
}


/** Soft fill for node cards; keep group hue without loud saturation. */
export function pastelOf(hex: string): string {
  const h = (hex || '#64748b').replace('#', '')
  if (h.length !== 6) return 'rgba(100,116,139,0.12)'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},0.14)`
}

export type RunPublishCategory = 0 | 1 | 2

/** 0 online, 1 workflow offline, 2 schedule offline */
export function statusAccent(cat: RunPublishCategory): string {
  if (cat === 1) return '#dc2626'
  if (cat === 2) return '#ea580c'
  return '#16a34a'
}
