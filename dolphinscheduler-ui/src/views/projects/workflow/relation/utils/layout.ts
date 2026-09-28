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

const X0 = 48
const Y0 = 48

/** Layout rank direction (dagre-style). */
export type TopoLayoutDir = 'TB' | 'LR' | 'BT' | 'RL'

/**
 * How to arrange nodes beyond mere direction:
 * - layered: barycenter-ordered hierarchy (default, fewer crossings)
 * - compact: same as layered with tighter gaps
 * - swimlane: hierarchy + business-group lanes on the cross axis
 * - radial: levels as concentric rings (good for hub/spoke)
 */
export type TopoLayoutStyle = 'layered' | 'compact' | 'swimlane' | 'radial'

export const TOPO_LAYOUT_OPTIONS: Array<{ value: TopoLayoutDir; labelKey: string }> = [
  { value: 'LR', labelKey: 'project.workflow.relation_layout_lr' },
  { value: 'TB', labelKey: 'project.workflow.relation_layout_tb' },
  { value: 'RL', labelKey: 'project.workflow.relation_layout_rl' },
  { value: 'BT', labelKey: 'project.workflow.relation_layout_bt' }
]

export const TOPO_STYLE_OPTIONS: Array<{ value: TopoLayoutStyle; labelKey: string }> = [
  { value: 'layered', labelKey: 'project.workflow.relation_style_layered' },
  { value: 'compact', labelKey: 'project.workflow.relation_style_compact' },
  { value: 'swimlane', labelKey: 'project.workflow.relation_style_swimlane' },
  { value: 'radial', labelKey: 'project.workflow.relation_style_radial' }
]

export interface TopoLaneBand {
  key: string
  label: string
  color?: string
  x: number
  y: number
  width: number
  height: number
}

export interface TopoLayoutResult {
  nodes: Array<RelationNode & { x: number; y: number }>
  bands: TopoLaneBand[]
  style: TopoLayoutStyle
  dir: TopoLayoutDir
}

function groupKey(n: RelationNode): string {
  return String((n as any).bizGroup || n.prefix || '—')
}

function gapsFor(style: TopoLayoutStyle) {
  // col = gap along rank axis (between levels); row = gap on cross axis (between siblings).
  // Sized so NODE_W/H (228x96) leave a readable corridor for straight edges.
  if (style === 'compact') {
    return { col: 340, row: 148, groupPad: 36 }
  }
  if (style === 'swimlane') {
    return { col: 440, row: 180, groupPad: 96 }
  }
  return { col: 440, row: 180, groupPad: 56 }
}

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

function buildAdjacency(links: RelationLink[], ids: Set<string>) {
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
  return { inbound, outbound }
}

/** Median barycenter order within levels to reduce edge crossings. */
function orderByBarycenter(
  buckets: Map<number, RelationNode[]>,
  levelKeys: number[],
  inbound: Map<string, Set<string>>,
  outbound: Map<string, Set<string>>,
  indexOf: Map<string, number>,
  passes = 4
) {
  const setIndex = (lv: number) => {
    const list = buckets.get(lv)!
    list.forEach((n, i) => indexOf.set(String(n.id), i))
  }
  levelKeys.forEach(setIndex)

  const median = (vals: number[]) => {
    if (!vals.length) return Number.POSITIVE_INFINITY
    const s = [...vals].sort((a, b) => a - b)
    const mid = Math.floor(s.length / 2)
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
  }

  for (let p = 0; p < passes; p++) {
    // downward pass: order by parents
    for (let i = 1; i < levelKeys.length; i++) {
      const lv = levelKeys[i]
      const list = buckets.get(lv)!
      list.sort((a, b) => {
        const ia = String(a.id)
        const ib = String(b.id)
        const pa = [...(inbound.get(ia) || [])].map((x) => indexOf.get(x) ?? 0)
        const pb = [...(inbound.get(ib) || [])].map((x) => indexOf.get(x) ?? 0)
        const ma = median(pa)
        const mb = median(pb)
        if (ma !== mb) return ma - mb
        return String(a.name).localeCompare(String(b.name))
      })
      setIndex(lv)
    }
    // upward pass: order by children
    for (let i = levelKeys.length - 2; i >= 0; i--) {
      const lv = levelKeys[i]
      const list = buckets.get(lv)!
      list.sort((a, b) => {
        const ia = String(a.id)
        const ib = String(b.id)
        const ca = [...(outbound.get(ia) || [])].map((x) => indexOf.get(x) ?? 0)
        const cb = [...(outbound.get(ib) || [])].map((x) => indexOf.get(x) ?? 0)
        const ma = median(ca)
        const mb = median(cb)
        if (ma !== mb) return ma - mb
        return String(a.name).localeCompare(String(b.name))
      })
      setIndex(lv)
    }
  }
}

function placeLayered(
  nodes: RelationNode[],
  links: RelationLink[],
  dir: TopoLayoutDir,
  style: TopoLayoutStyle
): TopoLayoutResult {
  const { col, row, groupPad } = gapsFor(style)
  const levels = assignTopoLevels(nodes, links)
  const ids = new Set(nodes.map((n) => String(n.id)))
  const { inbound, outbound } = buildAdjacency(links, ids)

  const buckets = new Map<number, RelationNode[]>()
  nodes.forEach((n) => {
    const id = String(n.id)
    const lv = levels.get(id) ?? 0
    n.topoLevel = lv
    n.prefix = n.prefix || extractPrefix(n.name)
    if (!buckets.has(lv)) buckets.set(lv, [])
    buckets.get(lv)!.push(n)
  })

  const levelKeys = [...buckets.keys()].sort((a, b) => a - b)

  // Initial order: group then name
  levelKeys.forEach((lv) => {
    buckets.get(lv)!.sort((a, b) => {
      const ga = groupKey(a)
      const gb = groupKey(b)
      if (ga !== gb) return ga.localeCompare(gb)
      return String(a.name).localeCompare(String(b.name))
    })
  })

  const indexOf = new Map<string, number>()
  orderByBarycenter(buckets, levelKeys, inbound, outbound, indexOf)

  // For swimlane: re-cluster cross-axis by group while keeping barycenter as secondary
  if (style === 'swimlane') {
    levelKeys.forEach((lv) => {
      const list = buckets.get(lv)!
      list.sort((a, b) => {
        const ga = groupKey(a)
        const gb = groupKey(b)
        if (ga !== gb) return ga.localeCompare(gb)
        return (indexOf.get(String(a.id)) ?? 0) - (indexOf.get(String(b.id)) ?? 0)
      })
      list.forEach((n, i) => indexOf.set(String(n.id), i))
    })
  }

  const maxLevel = levelKeys.length ? levelKeys[levelKeys.length - 1] : 0
  const vertical = dir === 'TB' || dir === 'BT'
  const primaryGap = vertical ? row : col
  const crossGap = vertical ? col : row

  /**
   * Cross-axis placement:
   * - Prefer the midpoint of already-placed parent nodes (user request).
   * - Keep barycenter order as a stable sort key when ideals collide.
   * - Resolve overlaps so consecutive nodes keep at least `crossGap`.
   */
  const crossPos = new Map<string, number>()

  const resolveCrossAxis = (
    list: RelationNode[],
    ideals: Map<string, number>
  ) => {
    const items = list.map((n, order) => {
      const id = String(n.id)
      return {
        id,
        n,
        order,
        ideal: ideals.get(id) ?? order * crossGap,
        group: groupKey(n)
      }
    })
    // Stable: ideal first, then prior barycenter order
    items.sort((a, b) => {
      if (a.ideal !== b.ideal) return a.ideal - b.ideal
      return a.order - b.order
    })

    const placed: number[] = []
    items.forEach((item, i) => {
      let y = item.ideal
      if (i > 0) {
        let minY = placed[i - 1] + crossGap
        if (style === 'swimlane' && item.group !== items[i - 1].group) {
          minY += groupPad
        }
        if (y < minY) y = minY
      }
      placed.push(y)
    })
    // Compact upward when later nodes leave slack above, without breaking min gaps
    for (let i = items.length - 2; i >= 0; i--) {
      let maxY = placed[i + 1] - crossGap
      if (style === 'swimlane' && items[i].group !== items[i + 1].group) {
        maxY -= groupPad
      }
      if (placed[i] > maxY) placed[i] = maxY
    }

    items.forEach((item, i) => {
      crossPos.set(item.id, placed[i])
    })
  }

  levelKeys.forEach((lv) => {
    const list = buckets.get(lv)!
    const ideals = new Map<string, number>()
    list.forEach((n, idx) => {
      const id = String(n.id)
      const parents = [...(inbound.get(id) || [])].filter((pid) =>
        crossPos.has(pid)
      )
      if (parents.length) {
        const sum = parents.reduce((s, pid) => s + (crossPos.get(pid) || 0), 0)
        ideals.set(id, sum / parents.length)
      } else {
        // Roots / no placed parent: keep barycenter slot
        ideals.set(id, idx * crossGap)
      }
    })
    resolveCrossAxis(list, ideals)
  })

  // Shift whole diagram so cross-axis starts near 0
  let minCross = Number.POSITIVE_INFINITY
  crossPos.forEach((v) => {
    if (v < minCross) minCross = v
  })
  if (!Number.isFinite(minCross)) minCross = 0
  crossPos.forEach((v, id) => crossPos.set(id, v - minCross))

  const positioned: Array<RelationNode & { x: number; y: number }> = []
  const bandAcc = new Map<string, { minX: number; minY: number; maxX: number; maxY: number; color?: string }>()

  levelKeys.forEach((lv) => {
    const list = buckets.get(lv)!
    list.forEach((n) => {
      const cross = crossPos.get(String(n.id)) || 0
      const primary =
        dir === 'LR' || dir === 'TB'
          ? lv * primaryGap
          : (maxLevel - lv) * primaryGap
      let x = 0
      let y = 0
      if (vertical) {
        x = X0 + cross
        y = Y0 + primary
      } else {
        x = X0 + primary
        y = Y0 + cross
      }
      positioned.push({ ...n, x, y })
      if (style === 'swimlane') {
        const g = groupKey(n)
        const b = bandAcc.get(g) || {
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
          color: (n as any).bizGroupColor
        }
        b.minX = Math.min(b.minX, x)
        b.minY = Math.min(b.minY, y)
        b.maxX = Math.max(b.maxX, x)
        b.maxY = Math.max(b.maxY, y)
        if ((n as any).bizGroupColor) b.color = (n as any).bizGroupColor
        bandAcc.set(g, b)
      }
    })
  })

  const NODE_W = 228
  const NODE_H = 96
  const bands: TopoLaneBand[] = []
  if (style === 'swimlane') {
    bandAcc.forEach((b, key) => {
      const pad = 18
      bands.push({
        key,
        label: key,
        color: b.color,
        x: b.minX - pad,
        y: b.minY - pad,
        width: b.maxX - b.minX + NODE_W + pad * 2,
        height: b.maxY - b.minY + NODE_H + pad * 2
      })
    })
  }

  return { nodes: positioned, bands, style, dir }
}

function placeRadial(
  nodes: RelationNode[],
  links: RelationLink[],
  style: TopoLayoutStyle
): TopoLayoutResult {
  const levels = assignTopoLevels(nodes, links)
  const ids = new Set(nodes.map((n) => String(n.id)))
  const { inbound, outbound } = buildAdjacency(links, ids)
  const buckets = new Map<number, RelationNode[]>()
  nodes.forEach((n) => {
    const lv = levels.get(String(n.id)) ?? 0
    n.topoLevel = lv
    n.prefix = n.prefix || extractPrefix(n.name)
    if (!buckets.has(lv)) buckets.set(lv, [])
    buckets.get(lv)!.push(n)
  })
  const levelKeys = [...buckets.keys()].sort((a, b) => a - b)
  levelKeys.forEach((lv) => {
    buckets.get(lv)!.sort((a, b) => {
      const ga = groupKey(a)
      const gb = groupKey(b)
      if (ga !== gb) return ga.localeCompare(gb)
      return String(a.name).localeCompare(String(b.name))
    })
  })
  const indexOf = new Map<string, number>()
  orderByBarycenter(buckets, levelKeys, inbound, outbound, indexOf)

  // Node card size used by TopologyGraph — keep in sync for non-overlap.
  const NODE_W = 228
  const NODE_H = 96
  const MIN_GAP = 48
  const MIN_CENTER_DIST = Math.max(NODE_W, NODE_H) + MIN_GAP
  const CX = 900
  const CY = 700

  const minRadiusForCount = (count: number, minDist: number) => {
    if (count <= 1) return 0
    const s = Math.sin(Math.PI / count)
    return s > 1e-6 ? minDist / (2 * s) : minDist * count
  }

  const angleOf = new Map<string, number>()
  const positioned: Array<RelationNode & { x: number; y: number }> = []
  let prevR = 0

  levelKeys.forEach((lv) => {
    const list = buckets.get(lv)!
    if (lv === 0 && list.length === 1) {
      const n = list[0]
      angleOf.set(String(n.id), 0)
      positioned.push({ ...n, x: CX - NODE_W / 2, y: CY - NODE_H / 2 })
      prevR = 0
      return
    }
    // Prefer parent average angle when available
    const withAngle = list.map((n, idx) => {
      const parents = [...(inbound.get(String(n.id)) || [])]
      let ang: number
      if (parents.length) {
        const sum = parents.reduce((s, p) => s + (angleOf.get(p) ?? 0), 0)
        ang = sum / parents.length
      } else {
        ang = (idx / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2
      }
      return { n, ang, idx }
    })
    withAngle.sort((a, b) => a.ang - b.ang || a.idx - b.idx)

    // Radius must fit all cards on this ring without overlap, and clear prior ring.
    const ringNeed = minRadiusForCount(withAngle.length, MIN_CENTER_DIST)
    const ringSep = Math.hypot(NODE_W, NODE_H) * 0.55 + MIN_GAP
    const r = Math.max(ringNeed, prevR + ringSep, 160)

    withAngle.forEach((item, i) => {
      const ang =
        (i / Math.max(withAngle.length, 1)) * Math.PI * 2 - Math.PI / 2
      angleOf.set(String(item.n.id), ang)
      const x = CX + Math.cos(ang) * r - NODE_W / 2
      const y = CY + Math.sin(ang) * r - NODE_H / 2
      positioned.push({ ...item.n, x, y })
    })
    prevR = r
  })

  return { nodes: positioned, bands: [], style: 'radial', dir: 'TB' }
}

export function buildTopoPositions(
  nodes: RelationNode[],
  links: RelationLink[],
  dir: TopoLayoutDir = 'LR',
  style: TopoLayoutStyle = 'layered'
): Array<RelationNode & { x: number; y: number }> {
  return buildTopoLayout(nodes, links, dir, style).nodes
}

export function buildTopoLayout(
  nodes: RelationNode[],
  links: RelationLink[],
  dir: TopoLayoutDir = 'LR',
  style: TopoLayoutStyle = 'layered'
): TopoLayoutResult {
  if (!nodes.length) {
    return { nodes: [], bands: [], style, dir }
  }
  if (style === 'radial') {
    return placeRadial(nodes, links, style)
  }
  return placeLayered(nodes, links, dir, style)
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
