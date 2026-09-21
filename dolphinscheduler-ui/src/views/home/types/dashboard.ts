import type { DisplayGroup, EntityType } from '../adapters/status-groups'

export type TimePreset = '1h' | '24h' | 'today' | '7d' | 'custom'
export type WorkbenchTab = 'failure' | 'running' | 'waiting' | 'all'

export interface DashboardScope {
  projectCode: number | null
  projectName: string
  entityType: EntityType
  timePreset: TimePreset
  dateRange: [number, number]
  autoRefreshSec: number
}

export interface MetricCardModel {
  key: string
  label: string
  value: string | number
  hint: string
  tone?: 'default' | 'danger' | 'success' | 'warning' | 'primary'
  clickTab?: WorkbenchTab
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
}

export interface ScheduleRow {
  time: string
  name: string
  projectName: string
  crontab?: string
  workflowDefinitionCode?: number
  projectCode?: number
}

export interface ServiceSummaryModel {
  masterOnline: number | null
  workerOnline: number | null
  databaseOk: boolean | null
  error?: string
}
