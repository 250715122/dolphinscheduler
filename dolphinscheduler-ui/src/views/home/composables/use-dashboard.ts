
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  endOfDay,
  format,
  getTime,
  startOfDay,
  startOfToday,
  subDays,
  subHours
} from 'date-fns'
import {
  countTaskState,
  countWorkflowInstanceState
} from '@/service/modules/projects-analysis'
import { queryProjectCreatedAndAuthorizedByUser } from '@/service/modules/projects'
import { queryWorkflowInstanceListPaging } from '@/service/modules/workflow-instances'
import { queryTaskListPaging } from '@/service/modules/task-instances'
import { queryScheduleListPaging } from '@/service/modules/schedules'
import {
  listMonitorServerNode,
  queryDatabaseState
} from '@/service/modules/monitor'
import {
  calcSuccessRate,
  formatRate,
  groupCounts,
  mapRawState,
  type DisplayGroup
} from '../adapters/status-groups'
import type {
  DashboardScope,
  InstanceRow,
  MetricCardModel,
  ScheduleRow,
  ServiceSummaryModel,
  TimePreset,
  WorkbenchTab
} from '../types/dashboard'

function presetRange(preset: TimePreset): [number, number] {
  const now = Date.now()
  if (preset === '1h') return [getTime(subHours(now, 1)), now]
  if (preset === '24h') return [getTime(subHours(now, 24)), now]
  if (preset === '7d') return [getTime(subDays(startOfToday(), 6)), now]
  return [getTime(startOfToday()), now]
}

export function useDashboard() {
  const { t, locale } = useI18n()
  const router = useRouter()

  const scope = reactive<DashboardScope>({
    projectCode: null,
    projectName: '',
    entityType: 'WORKFLOW',
    timePreset: 'today',
    dateRange: presetRange('today'),
    autoRefreshSec: 30
  })

  const projects = ref<Array<{ label: string; value: number }>>([])
  const loading = ref(false)
  const asOf = ref('')
  const periodGroups = ref<Record<DisplayGroup, number>>({
    success: 0,
    failure: 0,
    running: 0,
    waiting: 0,
    manual: 0,
    other: 0
  })
  const snapshotGroups = ref<Record<DisplayGroup, number>>({
    success: 0,
    failure: 0,
    running: 0,
    waiting: 0,
    manual: 0,
    other: 0
  })
  const periodTotal = ref(0)
  const workbenchTab = ref<WorkbenchTab>('all')
  const userPickedTab = ref(false)
  const instances = ref<InstanceRow[]>([])
  const instanceTotal = ref(0)
  const schedules = ref<ScheduleRow[]>([])
  const service = ref<ServiceSummaryModel>({
    masterOnline: null,
    workerOnline: null,
    databaseOk: null
  })
  const keyword = ref('')

  let timer: number | undefined
  let requestSeq = 0

  const dateParams = computed(() => ({
    startDate: format(scope.dateRange[0], 'yyyy-MM-dd HH:mm:ss'),
    endDate: format(scope.dateRange[1], 'yyyy-MM-dd HH:mm:ss'),
    projectCode: scope.projectCode || undefined
  }))

  const metrics = computed<MetricCardModel[]>(() => {
    const p = periodGroups.value
    const s = snapshotGroups.value
    const rate = calcSuccessRate(p.success, p.failure)
    const sampleHint =
      rate.denominator === 1
        ? t('home.ops_sample_one')
        : rate.denominator === 0
          ? t('home.ops_no_result')
          : `${t('home.ops_success')} ${rate.numerator} / ${t(
              'home.ops_success_or_failure'
            )} ${rate.denominator}`

    return [
      {
        key: 'started',
        label: t('home.ops_metric_started'),
        value: periodTotal.value,
        hint: t('home.ops_hint_period'),
        clickTab: 'all'
      },
      {
        key: 'successRate',
        label: t('home.ops_metric_success_rate'),
        value: formatRate(rate.value),
        hint: sampleHint,
        tone: rate.value === null ? 'default' : 'success'
      },
      {
        key: 'running',
        label: t('home.ops_metric_running'),
        value: s.running,
        hint: t('home.ops_hint_snapshot'),
        tone: 'primary',
        clickTab: 'running'
      },
      {
        key: 'waiting',
        label: t('home.ops_metric_waiting'),
        value: s.waiting,
        hint: t('home.ops_hint_snapshot'),
        tone: 'warning',
        clickTab: 'waiting'
      },
      {
        key: 'failure',
        label: t('home.ops_metric_failure'),
        value: p.failure,
        hint: t('home.ops_hint_period_failure'),
        tone: p.failure > 0 ? 'danger' : 'default',
        clickTab: 'failure'
      },
      {
        key: 'risk',
        label: t('home.ops_metric_risk'),
        value: '—',
        hint: t('home.ops_risk_unconfigured'),
        available: false
      }
    ]
  })

  const statusChips = computed(() => {
    const g = periodGroups.value
    const core: DisplayGroup[] = ['success', 'failure', 'running', 'waiting']
    const chips = core.map((key) => ({ key, count: g[key] }))
    if (g.manual > 0) chips.push({ key: 'manual' as DisplayGroup, count: g.manual })
    if (g.other > 0) chips.push({ key: 'other' as DisplayGroup, count: g.other })
    return chips
  })

  const compactMode = computed(() => periodTotal.value > 0 && periodTotal.value <= 5)

  const applyDefaultTab = () => {
    if (userPickedTab.value) return
    if (periodGroups.value.failure > 0) workbenchTab.value = 'failure'
    else if (snapshotGroups.value.running > 0) workbenchTab.value = 'running'
    else workbenchTab.value = 'all'
  }

  const loadProjects = async () => {
    const list = await queryProjectCreatedAndAuthorizedByUser()
    projects.value = (list || []).map((p: any) => ({
      label: p.name,
      value: p.code
    }))
  }

  const fetchStateCounts = async () => {
    const fetcher =
      scope.entityType === 'WORKFLOW'
        ? countWorkflowInstanceState
        : countTaskState
    const [periodRes, snapRes] = await Promise.all([
      fetcher(dateParams.value),
      fetcher({ projectCode: scope.projectCode || undefined })
    ])
    const periodItems =
      periodRes.workflowInstanceStatusCounts ||
      periodRes.taskInstanceStatusCounts ||
      []
    const snapItems =
      snapRes.workflowInstanceStatusCounts ||
      snapRes.taskInstanceStatusCounts ||
      []
    periodGroups.value = groupCounts(periodItems, scope.entityType)
    snapshotGroups.value = groupCounts(snapItems, scope.entityType)
    periodTotal.value = periodRes.totalCount || 0
  }

  const stateTypeForTab = (tab: WorkbenchTab) => {
    if (tab === 'failure') return 'FAILURE'
    if (tab === 'running') return 'RUNNING_EXECUTION'
    if (tab === 'waiting') return 'SUBMITTED_SUCCESS'
    return undefined
  }

  const loadInstances = async () => {
    const targetProjects =
      scope.projectCode != null
        ? projects.value.filter((p) => p.value === scope.projectCode)
        : projects.value.slice(0, 8)

    if (!targetProjects.length) {
      instances.value = []
      instanceTotal.value = 0
      return
    }

    const tab = workbenchTab.value
    const usePeriod = tab === 'failure' || tab === 'all'
    const rows: InstanceRow[] = []
    let total = 0

    await Promise.all(
      targetProjects.map(async (project) => {
        if (scope.entityType === 'WORKFLOW') {
          const res = await queryWorkflowInstanceListPaging(
            {
              pageNo: 1,
              pageSize: 5,
              searchVal: keyword.value || undefined,
              stateType: stateTypeForTab(tab),
              startDate: usePeriod ? dateParams.value.startDate : undefined,
              endDate: usePeriod ? dateParams.value.endDate : undefined
            },
            project.value
          )
          total += res.total || 0
          ;(res.totalList || []).forEach((item: any) => {
            rows.push({
              id: item.id,
              name: item.name,
              projectCode: project.value,
              projectName: project.label,
              state: item.state,
              group: mapRawState(item.state, 'WORKFLOW'),
              startTime: item.startTime,
              endTime: item.endTime,
              duration: item.duration
            })
          })
        } else {
          const res = await queryTaskListPaging(
            {
              pageNo: 1,
              pageSize: 5,
              searchVal: keyword.value || undefined,
              stateType: stateTypeForTab(tab),
              startDate: usePeriod ? dateParams.value.startDate : undefined,
              endDate: usePeriod ? dateParams.value.endDate : undefined
            } as any,
            { projectCode: project.value }
          )
          total += res.total || 0
          ;(res.totalList || []).forEach((item: any) => {
            rows.push({
              id: item.id,
              name: item.name || item.taskName,
              projectCode: project.value,
              projectName: project.label,
              state: item.state,
              group: mapRawState(item.state, 'TASK'),
              startTime: item.startTime,
              endTime: item.endTime,
              duration: item.duration
            })
          })
        }
      })
    )

    instances.value = rows.slice(0, 5)
    instanceTotal.value = total
  }

  const loadSchedules = async () => {
    const targetProjects =
      scope.projectCode != null
        ? projects.value.filter((p) => p.value === scope.projectCode)
        : projects.value.slice(0, 5)
    const rows: ScheduleRow[] = []
    for (const project of targetProjects) {
      try {
        const res = await queryScheduleListPaging(
          { pageNo: 1, pageSize: 20 } as any,
          project.value
        )
        ;(res.totalList || []).forEach((item: any) => {
          if (item.releaseState && String(item.releaseState).toUpperCase() !== 'ONLINE') {
            return
          }
          rows.push({
            time: (item.startTime || '').slice(11, 16) || '--:--',
            name: item.workflowDefinitionName || item.processDefinitionName || item.crontab,
            projectName: project.label,
            crontab: item.crontab,
            workflowDefinitionCode: item.workflowDefinitionCode,
            projectCode: project.value
          })
        })
      } catch (e) {
        // ignore project-level schedule errors in light mode
      }
    }
    schedules.value = rows.slice(0, 4)
  }

  const loadService = async () => {
    try {
      const [masters, workers, dbs] = await Promise.all([
        listMonitorServerNode('MASTER'),
        listMonitorServerNode('WORKER'),
        queryDatabaseState()
      ])
      service.value = {
        masterOnline: Array.isArray(masters) ? masters.length : 0,
        workerOnline: Array.isArray(workers) ? workers.length : 0,
        databaseOk: Array.isArray(dbs)
          ? dbs.every((d: any) => String(d.state).toUpperCase() === 'YES')
          : null
      }
    } catch (e: any) {
      service.value = {
        masterOnline: null,
        workerOnline: null,
        databaseOk: null,
        error: t('home.ops_monitor_unavailable')
      }
    }
  }

  const refresh = async () => {
    const seq = ++requestSeq
    loading.value = true
    try {
      if (!projects.value.length) await loadProjects()
      await Promise.all([fetchStateCounts(), loadService()])
      if (seq !== requestSeq) return
      applyDefaultTab()
      await Promise.all([loadInstances(), loadSchedules()])
      if (seq !== requestSeq) return
      asOf.value = format(Date.now(), 'HH:mm:ss')
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  const setPreset = (preset: TimePreset) => {
    scope.timePreset = preset
    if (preset !== 'custom') scope.dateRange = presetRange(preset)
  }

  const setTab = (tab: WorkbenchTab) => {
    userPickedTab.value = true
    workbenchTab.value = tab
  }

  const openInstance = (row: InstanceRow) => {
    if (scope.entityType === 'WORKFLOW') {
      router.push({
        path: `/projects/${row.projectCode}/workflow/instances/${row.id}`,
        query: { projectName: row.projectName }
      })
    } else {
      router.push({
        path: `/projects/${row.projectCode}/task/instances`,
        query: { projectName: row.projectName }
      })
    }
  }

  const openMonitor = () => {
    router.push({ path: '/monitor/master' })
  }

  const setupTimer = () => {
    if (timer) window.clearInterval(timer)
    if (scope.autoRefreshSec > 0) {
      timer = window.setInterval(() => {
        if (document.hidden) return
        refresh()
      }, scope.autoRefreshSec * 1000)
    }
  }

  onMounted(async () => {
    await refresh()
    setupTimer()
  })

  onUnmounted(() => {
    if (timer) window.clearInterval(timer)
  })

  watch(
    () => [
      scope.projectCode,
      scope.entityType,
      scope.dateRange[0],
      scope.dateRange[1],
      locale.value
    ],
    () => {
      userPickedTab.value = false
      refresh()
    }
  )

  watch(
    () => [workbenchTab.value, keyword.value],
    () => loadInstances()
  )

  watch(
    () => scope.autoRefreshSec,
    () => setupTimer()
  )

  return {
    t,
    scope,
    projects,
    loading,
    asOf,
    metrics,
    statusChips,
    compactMode,
    workbenchTab,
    instances,
    instanceTotal,
    schedules,
    service,
    keyword,
    refresh,
    setPreset,
    setTab,
    openInstance,
    openMonitor,
    periodTotal
  }
}
