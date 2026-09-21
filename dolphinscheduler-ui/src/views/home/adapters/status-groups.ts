export type EntityType = 'WORKFLOW' | 'TASK'
export type DisplayGroup =
  | 'success'
  | 'failure'
  | 'running'
  | 'waiting'
  | 'manual'
  | 'other'

export const GROUP_COLORS: Record<DisplayGroup, string> = {
  success: '#15803d',
  failure: '#dc2626',
  running: '#2563eb',
  waiting: '#b45309',
  manual: '#7c3aed',
  other: '#64748b'
}

const WORKFLOW_MAP: Record<string, DisplayGroup> = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  RUNNING_EXECUTION: 'running',
  SUBMITTED_SUCCESS: 'waiting',
  SERIAL_WAIT: 'waiting',
  WAIT_TO_RUN: 'waiting',
  DELAY_EXECUTION: 'waiting',
  READY_PAUSE: 'other',
  PAUSE: 'other',
  READY_STOP: 'other',
  STOP: 'other',
  NEED_FAULT_TOLERANCE: 'other',
  BLOCK: 'other'
}

const TASK_MAP: Record<string, DisplayGroup> = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  RUNNING_EXECUTION: 'running',
  SUBMITTED_SUCCESS: 'waiting',
  DISPATCH: 'waiting',
  DELAY_EXECUTION: 'waiting',
  FORCED_SUCCESS: 'manual',
  READY_PAUSE: 'other',
  PAUSE: 'other',
  READY_STOP: 'other',
  STOP: 'other',
  KILL: 'other',
  NEED_FAULT_TOLERANCE: 'other'
}

export function mapRawState(
  raw: string,
  entityType: EntityType
): DisplayGroup {
  const table = entityType === 'WORKFLOW' ? WORKFLOW_MAP : TASK_MAP
  return table[raw] || 'other'
}

export function groupCounts(
  items: Array<{ state: string; count: number }>,
  entityType: EntityType
): Record<DisplayGroup, number> {
  const result: Record<DisplayGroup, number> = {
    success: 0,
    failure: 0,
    running: 0,
    waiting: 0,
    manual: 0,
    other: 0
  }
  items.forEach((item) => {
    const g = mapRawState(item.state, entityType)
    result[g] += item.count || 0
  })
  return result
}

export function calcSuccessRate(success: number, failure: number) {
  const denominator = success + failure
  if (denominator <= 0) {
    return { value: null as number | null, numerator: success, denominator }
  }
  return {
    value: success / denominator,
    numerator: success,
    denominator
  }
}

export function formatRate(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}
