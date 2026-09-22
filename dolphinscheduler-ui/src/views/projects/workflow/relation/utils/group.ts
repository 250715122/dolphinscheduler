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
