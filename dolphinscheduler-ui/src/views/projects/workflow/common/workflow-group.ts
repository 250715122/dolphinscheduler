import { extractPrefix, prefixColor } from '../relation/utils/group'

export interface WorkflowGroupRule {
  group: string
  /** RegExp source or plain prefix; matched against workflow name */
  pattern: string
}

export type GroupSource = 'manual' | 'rule' | 'prefix'

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

export function resolveWorkflowGroup(
  workflow: {
    name?: string
    workFlowName?: string
    description?: string | null
    code?: string | number
  },
  rules?: WorkflowGroupRule[] | null,
  overrides?: WorkflowGroupOverrides | null
): ResolvedGroup {
  const codeKey = workflow.code != null ? String(workflow.code) : ''
  if (overrides && codeKey && overrides[codeKey]) {
    const ov = String(overrides[codeKey]).trim()
    if (ov) {
      return { name: ov, color: prefixColor(ov), source: 'manual' }
    }
  }
  const name = String(workflow.name || workflow.workFlowName || '')
  const manual = parseGroupFromDescription(workflow.description)
  if (manual) {
    return { name: manual, color: prefixColor(manual), source: 'manual' }
  }
  const byRule = matchGroupByRules(name, rules)
  if (byRule) {
    return { name: byRule, color: prefixColor(byRule), source: 'rule' }
  }
  const prefix = extractPrefix(name)
  return { name: prefix, color: prefixColor(prefix), source: 'prefix' }
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
  overrides?: WorkflowGroupOverrides | null
): string[] {
  const set = new Set<string>()
  items.forEach((w) => set.add(resolveWorkflowGroup(w, rules, overrides).name))
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

export function groupColor(groupName: string): string {
  return prefixColor(groupName)
}

export const DEFAULT_GROUP_RULES: WorkflowGroupRule[] = [
  { group: '采集', pattern: '^collect_' },
  { group: '清洗', pattern: '^clean_' },
  { group: '汇总', pattern: '^merge_' },
  { group: '报表', pattern: '^report_' },
  { group: '旁路', pattern: '^(sync_|alert_|ods_|ads_)' },
  { group: '运维', pattern: '^(manual_|retired_|paused_|experiment_|orphan_|legacy_)' }
]

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
