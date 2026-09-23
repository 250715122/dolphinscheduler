import { extractPrefix } from './group'

export interface RelationNode {
  id: string | number
  name: string
  prefix?: string
  topoLevel?: number
  workFlowPublishStatus?: string | number
  schedulePublishStatus?: string | number
  crontab?: string
  scheduleStartTime?: string
  scheduleEndTime?: string
  lastRunStatus?: string
  lastStartTime?: string
  lastEndTime?: string
  duration?: string
  [key: string]: any
}

export interface RelationLink {
  source: string
  target: string
  /** edge crosses project boundary */
  external?: boolean
  /** short label e.g. other project name */
  label?: string
}

const COL_GAP = 310
const ROW_GAP = 140
const X0 = 40
const Y0 = 40

/** Topological levels from dependency roots (sources with no inbound edges). */
export function assignTopoLevels(
  nodes: RelationNode[],
  links: RelationLink[]
): Map<string, number> {
  const ids = new Set(nodes.map((n) => String(n.id)))
  const inbound = new Map<string, Set<string>>()
  const outbound = new Map<string, Set<string>>()
  ids.forEach((id) => {
    inbound.set(id, new Set())
    outbound.set(id, new Set())
  })
  links.forEach((l) => {
    const s = String(l.source)
    const t = String(l.target)
    if (!ids.has(s) || !ids.has(t) || s === t) return
    inbound.get(t)!.add(s)
    outbound.get(s)!.add(t)
  })

  const level = new Map<string, number>()
  const roots = [...ids].filter((id) => inbound.get(id)!.size === 0)
  const queue = [...(roots.length ? roots : [...ids])]
  queue.forEach((id) => level.set(id, 0))

  // Kahn-like longest-path level
  const indeg = new Map<string, number>()
  ids.forEach((id) => indeg.set(id, inbound.get(id)!.size))
  const q = [...ids].filter((id) => indeg.get(id) === 0)
  const order: string[] = []
  while (q.length) {
    const u = q.shift()!
    order.push(u)
    outbound.get(u)!.forEach((v) => {
      indeg.set(v, (indeg.get(v) || 0) - 1)
      if (indeg.get(v) === 0) q.push(v)
    })
  }
  // cycles / leftovers
  ids.forEach((id) => {
    if (!order.includes(id)) order.push(id)
  })

  order.forEach((id) => {
    if (!level.has(id)) level.set(id, 0)
    const parents = inbound.get(id)!
    if (parents.size) {
      let maxP = 0
      parents.forEach((p) => {
        maxP = Math.max(maxP, level.get(p) ?? 0)
      })
      level.set(id, maxP + 1)
    }
  })
  return level
}

export function buildTopoPositions(nodes: RelationNode[], links: RelationLink[]) {
  const levels = assignTopoLevels(nodes, links)
  const buckets = new Map<number, RelationNode[]>()
  nodes.forEach((n) => {
    const id = String(n.id)
    const lv = levels.get(id) ?? 0
    n.topoLevel = lv
    n.prefix = n.prefix || extractPrefix(n.name)
    if (!buckets.has(lv)) buckets.set(lv, [])
    buckets.get(lv)!.push(n)
  })

  const positioned: Array<RelationNode & { x: number; y: number }> = []
  ;[...buckets.keys()]
    .sort((a, b) => a - b)
    .forEach((lv) => {
      const list = buckets.get(lv)!
      list.sort((a, b) => {
        const ga = String((a as any).bizGroup || a.prefix || '')
        const gb = String((b as any).bizGroup || b.prefix || '')
        if (ga !== gb) return ga.localeCompare(gb)
        return String(a.name).localeCompare(String(b.name))
      })
      list.forEach((n, idx) => {
        positioned.push({
          ...n,
          x: X0 + lv * COL_GAP,
          y: Y0 + idx * ROW_GAP
        })
      })
    })
  return positioned
}

export function neighbors(
  id: string,
  links: RelationLink[],
  depth: number
): { upstream: Set<string>; downstream: Set<string> } {
  const up = new Set<string>()
  const down = new Set<string>()
  if (depth <= 0) return { upstream: up, downstream: down }

  let frontierUp = new Set<string>([id])
  let frontierDown = new Set<string>([id])
  for (let d = 0; d < depth; d++) {
    const nextUp = new Set<string>()
    const nextDown = new Set<string>()
    links.forEach((l) => {
      if (frontierUp.has(l.target) && l.source !== id) {
        if (!up.has(l.source)) {
          up.add(l.source)
          nextUp.add(l.source)
        }
      }
      if (frontierDown.has(l.source) && l.target !== id) {
        if (!down.has(l.target)) {
          down.add(l.target)
          nextDown.add(l.target)
        }
      }
    })
    frontierUp = nextUp
    frontierDown = nextDown
  }
  return { upstream: up, downstream: down }
}

export function computeSummary(nodes: RelationNode[], links: RelationLink[]) {
  const connected = new Set<string>()
  links.forEach((l) => {
    connected.add(String(l.source))
    connected.add(String(l.target))
  })
  let offline = 0
  let scheduleOffline = 0
  let online = 0
  nodes.forEach((n) => {
    const wp = Number(n.workFlowPublishStatus)
    const sp = Number(n.schedulePublishStatus)
    if (wp === 0) offline++
    else if (sp === 0) scheduleOffline++
    else online++
  })
  const maxLevel = nodes.reduce((m, n) => Math.max(m, n.topoLevel ?? 0), 0)
  return {
    totalNodes: nodes.length,
    totalEdges: links.length,
    isolated: nodes.filter((n) => !connected.has(String(n.id))).length,
    online,
    offline,
    scheduleOffline,
    maxLevel
  }
}
