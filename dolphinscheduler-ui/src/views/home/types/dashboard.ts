import type { DisplayGroup, EntityType } from '../adapters/status-groups'

export type TimePreset = '1h' | '24h' | 'today' | '7d' | 'custom'
export type WorkbenchTab =
  | 'failure'
  | 'running'
  | 'waiting'
  | 'all'
  | 'ran'
  | 'workflow'

export type MetricKey =
  | 'workflow'
  | 'task'
  | 'ran'
  | 'waiting'
  | 'failure'
  | 'completion'
  | 'quality'

export interface DashboardScope {
  projectCode: number | null
  projectName: string
  entityType: EntityType
  timePreset: TimePreset
  dateRange: [number, number]
  autoRefreshSec: number
}

export interface MetricCardModel {
  key: MetricKey | string
  label: string
  value: string | number
  hint: string
  tone?: 'default' | 'danger' | 'success' | 'warning' | 'primary'
  clickTab?: WorkbenchTab
  entityType?: EntityType
  available?: boolean
}

export interface InstanceRow {
  id: number
  name: string
  projectCode: number
  projectName: string
  state: string
  group: DisplayGroup
  startTime?: string
  endTime?: string
  duration?: string
  durationSec?: number
  /** TASK vs WORKFLOW — used by openInstance navigation */
  entityType?: 'TASK' | 'WORKFLOW'
  workflowInstanceId?: number
  taskType?: string
  appLink?: string
  checkActual?: number
  checkPassed?: boolean
}

export interface ScheduleRow {
  time: string
  name: string
  projectName: string
  crontab?: string
  workflowDefinitionCode?: number
  projectCode?: number
  /** next fire epoch ms for sorting */
  sortMs?: number
}

export interface ServiceSummaryModel {
  masterOnline: number | null
  workerOnline: number | null
  databaseOk: boolean | null
  error?: string
}

export interface TrendPoint {
  date: string
  taskCount: number
  workflowCount: number
}

export type TrendMode = 'task' | 'workflow'
