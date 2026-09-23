import { extractPrefix, prefixColor } from '../relation/utils/group'

export interface WorkflowBizGroup {
  /** stable id within project preference */
  id: string
  name: string
  color: string
  description?: string
}

export interface WorkflowGroupRule {
  /** references WorkflowBizGroup.name (or free text for legacy) */
  group: string
  /** RegExp source or plain prefix; matched against workflow name */
  pattern: string
}

export type GroupSource = 'manual' | 'rule' | 'none'

export interface ResolvedGroup {
  name: string
  color: string
  source: GroupSource
}

export type WorkflowGroupOverrides = Record<string, string>

const MANUAL_RE = /\[group:\s*([^\]]+)\]|#group:([^\s#]+)/i

/** Parse manual override from workflow description, e.g. [group:采集] or #group:运维 */
export function parseGroupFromDescription(
  description?: string | null
): string | null {
  if (!description) return null
  const m = String(description).match(MANUAL_RE)
  if (!m) return null
  const name = (m[1] || m[2] || '').trim()
  return name || null
}

/** Match first project rule whose pattern hits the workflow name */
export function matchGroupByRules(
  name: string,
  rules: WorkflowGroupRule[] | null | undefined
): string | null {
  if (!rules?.length || !name) return null
  for (const rule of rules) {
    const g = (rule.group || '').trim()
    const pat = (rule.pattern || '').trim()
    if (!g || !pat) continue
    try {
      // treat bare words as prefix; otherwise as RegExp
      const re =
        pat.startsWith('^') ||
        pat.includes('(') ||
        pat.includes('[') ||
        pat.includes('*') ||
        pat.includes('.')
          ? new RegExp(pat, 'i')
          : new RegExp('^' + pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      if (re.test(name)) return g
    } catch {
      if (name.toLowerCase().startsWith(pat.toLowerCase())) return g
    }
  }
  return null
}

export const UNGROUPED: ResolvedGroup = {
  name: '',
  color: '#94a3b8',
  source: 'none'
}

/**
 * Resolve group for a workflow.
 * Priority: manual/custom (preference override or [group:xx]) >
 *   auto-match rules (only when autoMatch=true) >
 *   ungrouped.
 */
export function resolveWorkflowGroup(
  workflow: {
    name?: string
    workFlowName?: string
    description?: string | null
    code?: string | number
  },
  rules?: WorkflowGroupRule[] | null,
  overrides?: WorkflowGroupOverrides | null,
  catalog?: WorkflowBizGroup[] | null,
  autoMatch: boolean = true
): ResolvedGroup {
  const codeKey = workflow.code != null ? String(workflow.code) : ''
  if (overrides && codeKey && overrides[codeKey]) {
    const ov = String(overrides[codeKey]).trim()
    if (ov) {
      return { name: ov, color: groupColor(ov, catalog), source: 'manual' }
    }
  }
  const name = String(workflow.name || workflow.workFlowName || '')
  const manual = parseGroupFromDescription(workflow.description)
  if (manual) {
    return {
      name: manual,
      color: groupColor(manual, catalog),
      source: 'manual'
    }
  }
  if (!autoMatch) {
    return { ...UNGROUPED }
  }
  const byRule = matchGroupByRules(name, rules)
  if (byRule) {
    return {
      name: byRule,
      color: groupColor(byRule, catalog),
      source: 'rule'
    }
  }
  return { ...UNGROUPED }
}


/** Remove existing [group:xx] / #group:xx markers from description */
export function stripGroupFromDescription(
  description?: string | null
): string {
  if (!description) return ''
  return String(description)
    .replace(MANUAL_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Upsert [group:name] into description; empty group clears the marker */
export function applyGroupToDescription(
  description: string | null | undefined,
  group: string | null | undefined
): string {
  const base = stripGroupFromDescription(description)
  const g = String(group || '').trim()
  if (!g) return base
  const tag = `[group:${g}]`
  return base ? `${base} ${tag}` : tag
}

export function collectGroups(
  items: Array<{
    name?: string
    workFlowName?: string
    description?: string | null
    code?: string | number
  }>,
  rules?: WorkflowGroupRule[] | null,
  overrides?: WorkflowGroupOverrides | null,
  catalog?: WorkflowBizGroup[] | null,
  autoMatch: boolean = true
): string[] {
  const set = new Set<string>()
  items.forEach((w) => {
    const n = resolveWorkflowGroup(w, rules, overrides, catalog, autoMatch).name
    if (n) set.add(n)
  })
  if (catalog?.length) {
    catalog.forEach((g) => {
      const n = String(g.name || '').trim()
      if (n) set.add(n)
    })
  }
  if (overrides) {
    Object.values(overrides).forEach((g) => {
      const n = String(g || '').trim()
      if (n) set.add(n)
    })
  }
  if (rules?.length) {
    rules.forEach((r) => {
      const n = String(r.group || '').trim()
      if (n) set.add(n)
    })
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

/** Fixed palette for biz-group picker (8 categories). */
export const BIZ_GROUP_COLORS = [
  '#2563eb', // 蓝
  '#0d9488', // 青
  '#ea580c', // 橙
  '#7c3aed', // 紫
  '#db2777', // 粉
  '#65a30d', // 绿
  '#ca8a04', // 黄
  '#dc2626' // 红
] as const

export function groupColor(
  groupName: string,
  catalog?: WorkflowBizGroup[] | null
): string {
  const n = String(groupName || '').trim()
  if (catalog?.length && n) {
    const hit = catalog.find((g) => String(g.name || '').trim() === n)
    if (hit?.color) return hit.color
  }
  return prefixColor(n || 'other')
}

export function newBizGroupId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}


/** Ensure a named group exists in catalog; returns updated list (new array). */
export function upsertBizGroup(
  catalog: WorkflowBizGroup[] | null | undefined,
  name: string,
  color?: string,
  description?: string
): WorkflowBizGroup[] {
  const n = String(name || '').trim()
  const list = [...(catalog || [])]
  if (!n) return list
  const idx = list.findIndex(
    (g) => String(g.name || '').trim().toLowerCase() === n.toLowerCase()
  )
  if (idx >= 0) {
    const prev = list[idx]
    list[idx] = {
      ...prev,
      name: n,
      color: color || prev.color || prefixColor(n),
      description:
        description !== undefined ? description : prev.description || ''
    }
    return list
  }
  list.push({
    id: newBizGroupId(),
    name: n,
    color: color || prefixColor(n),
    description: description || ''
  })
  return list
}

/** Merge many group names into catalog (keep existing colors/ids). */
export function mergeBizGroupNames(
  catalog: WorkflowBizGroup[] | null | undefined,
  names: Array<string | null | undefined>
): WorkflowBizGroup[] {
  let list = [...(catalog || [])]
  for (const raw of names) {
    const n = String(raw || '').trim()
    if (!n) continue
    list = upsertBizGroup(list, n)
  }
  return list
}

export const DEFAULT_GROUP_RULES: WorkflowGroupRule[] = [
  { group: '采集', pattern: '^collect_' },
  { group: '清洗', pattern: '^clean_' },
  { group: '汇总', pattern: '^merge_' },
  { group: '报表', pattern: '^report_' },
  { group: '旁路', pattern: '^(sync_|alert_|ods_|ads_)' },
  { group: '运维', pattern: '^(manual_|retired_|paused_|experiment_|orphan_|legacy_)' }
]

/** Seed catalog from default rule group names */
export function defaultBizGroups(): WorkflowBizGroup[] {
  const seen = new Set<string>()
  const out: WorkflowBizGroup[] = []
  for (const r of DEFAULT_GROUP_RULES) {
    const name = String(r.group || '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push({
      id: newBizGroupId(),
      name,
      color: prefixColor(name),
      description: ''
    })
  }
  return out
}

/** Persist / clear a code→group override in project preference JSON */
export async function syncWorkflowGroupOverride(
  projectCode: number,
  workflowCode: string | number,
  group: string | null | undefined,
  queryPreference: (code: number) => Promise<any>,
  updatePreference: (data: any, code: number) => Promise<any>
): Promise<void> {
  const result = await queryPreference(projectCode)
  const pref =
    result?.preferences && typeof result.preferences === 'string'
      ? JSON.parse(result.preferences)
      : result?.preferences && typeof result.preferences === 'object'
        ? { ...result.preferences }
        : {}
  const overrides: Record<string, string> = {
    ...(pref.workflowGroupOverrides || {})
  }
  const key = String(workflowCode)
  const g = String(group || '').trim()
  if (g) overrides[key] = g
  else delete overrides[key]
  pref.workflowGroupOverrides = overrides
  await updatePreference(
    { projectPreferences: JSON.stringify(pref), code: projectCode },
    projectCode
  )
}
