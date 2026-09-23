
import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onBeforeUnmount,
  onUnmounted,
  reactive,
  ref,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useUserStore } from '@/store/user/user'
import type { UserInfoRes } from '@/service/modules/users/types'
import {
  format,
  getTime,
  startOfDay,
  startOfToday,
  subDays,
  subHours,
  endOfDay
} from 'date-fns'
import {
  countDefinitionByUser,
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
import { durationToSeconds } from '../adapters/duration'
import type {
  DashboardScope,
  InstanceRow,
  MetricCardModel,
  ScheduleRow,
  ServiceSummaryModel,
  TimePreset,
  TrendMode,
  TrendPoint,
  WorkbenchTab
} from '../types/dashboard'

function presetRange(preset: TimePreset): [number, number] {
  const now = Date.now()
  if (preset === '1h') return [getTime(subHours(now, 1)), now]
  if (preset === '24h') return [getTime(subHours(now, 24)), now]
  if (preset === '7d') return [getTime(subDays(startOfToday(), 6)), now]
  return [getTime(startOfToday()), now]
}

function parseTimeMs(v?: string): number {
  if (!v) return 0
  const t = new Date(String(v).replace(/-/g, '/')).getTime()
  return Number.isNaN(t) ? 0 : t
}

export type DashboardOptions = {
  /** home: multi-project aggregate; project: single locked project */
  mode?: 'home' | 'project'
  fixedProjectCode?: number | (() => number)
  fixedProjectName?: string | (() => string)
}

export function useDashboard(options: DashboardOptions = {}) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const userStore = useUserStore()
  const isAdmin = computed(
    () => (userStore.getUserInfo as UserInfoRes)?.userType === 'ADMIN_USER'
  )
  const dashboardMode = options.mode || 'home'
  const resolveFixedCode = () => {
    const v =
      typeof options.fixedProjectCode === 'function'
        ? options.fixedProjectCode()
        : options.fixedProjectCode
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const resolveFixedName = () => {
    const v =
      typeof options.fixedProjectName === 'function'
        ? options.fixedProjectName()
        : options.fixedProjectName
    return String(v || '').trim()
  }

  const scope = reactive<DashboardScope>({
    projectCode: resolveFixedCode(),
    projectName: resolveFixedName(),
    entityType: 'TASK',
    timePreset: 'today',
    dateRange: presetRange('today'),
    autoRefreshSec: 300
  })

  const projects = ref<Array<{ label: string; value: number }>>([])
  const loading = ref(false)
  const asOf = ref('')
  const workflowDefCount = ref(0)
  const taskPeriodTotal = ref(0)
  const taskPeriodGroups = ref<Record<DisplayGroup, number>>({
    success: 0,
    failure: 0,
    running: 0,
    waiting: 0,
    manual: 0,
    other: 0
  })
  const taskSnapshotGroups = ref<Record<DisplayGroup, number>>({
    success: 0,
    failure: 0,
    running: 0,
    waiting: 0,
    manual: 0,
    other: 0
  })
  const todayGroups = ref<Record<DisplayGroup, number>>({
    success: 0,
    failure: 0,
    running: 0,
    waiting: 0,
    manual: 0,
    other: 0
  })
  const todayTotal = ref(0)
  const periodTotal = ref(0)
  const workbenchTab = ref<WorkbenchTab>('all')
  const userPickedTab = ref(false)
  const instanceAll = ref<InstanceRow[]>([])
  const instanceTotal = ref(0)
  const instancePage = ref(1)
  const instancePageSize = 8
  const scheduleAll = ref<ScheduleRow[]>([])
  const schedulePage = ref(1)
  const schedulePageSize = 6
  const service = ref<ServiceSummaryModel>({
    masterOnline: null,
    workerOnline: null,
    databaseOk: null
  })
  const keyword = ref('')
  const trendPoints = ref<TrendPoint[]>([])
  const trendMode = ref<TrendMode>('task')
  const durationRows = ref<InstanceRow[]>([])
  const durationPage = ref(1)
  const durationPageSize = 8

  let timer: number | undefined
  let requestSeq = 0

  const dateParams = computed(() => ({
    startDate: format(scope.dateRange[0], 'yyyy-MM-dd HH:mm:ss'),
    endDate: format(scope.dateRange[1], 'yyyy-MM-dd HH:mm:ss'),
    projectCode: scope.projectCode || undefined
  }))

  const todayParams = computed(() => ({
    startDate: format(startOfToday(), 'yyyy-MM-dd HH:mm:ss'),
    endDate: format(Date.now(), 'yyyy-MM-dd HH:mm:ss'),
    projectCode: scope.projectCode || undefined
  }))

  const ranCount = computed(
    () =>
      taskPeriodGroups.value.success +
      taskPeriodGroups.value.failure +
      taskPeriodGroups.value.manual
  )

  const completionRate = computed(() =>
    calcSuccessRate(todayGroups.value.success, todayGroups.value.failure)
  )

  const metrics = computed<MetricCardModel[]>(() => {
    const rate = completionRate.value
    return [
      {
        key: 'workflow',
        label: t('home.ops_metric_workflow_count'),
        value: workflowDefCount.value,
        hint: t('home.ops_hint_workflow_def'),
        clickTab: 'workflow',
        entityType: 'WORKFLOW'
      },
      {
        key: 'task',
        label: t('home.ops_metric_task_count'),
        value: taskPeriodTotal.value,
        hint: t('home.ops_hint_period'),
        clickTab: 'all',
        entityType: 'TASK'
      },
      {
        key: 'ran',
        label: t('home.ops_metric_ran_count'),
        value: ranCount.value,
        hint: t('home.ops_hint_period'),
        tone: 'primary',
        clickTab: 'ran',
        entityType: 'TASK'
      },
      {
        key: 'waiting',
        label: t('home.ops_metric_pending_count'),
        value: taskSnapshotGroups.value.waiting,
        hint: t('home.ops_hint_snapshot'),
        tone: 'warning',
        clickTab: 'waiting',
        entityType: 'TASK'
      },
      {
        key: 'failure',
        label: t('home.ops_metric_fail_count'),
        value: taskPeriodGroups.value.failure,
        hint: t('home.ops_hint_period_failure'),
        tone: taskPeriodGroups.value.failure > 0 ? 'danger' : 'default',
        clickTab: 'failure',
        entityType: 'TASK'
      },
      {
        key: 'completion',
        label: t('home.ops_metric_completion_rate'),
        value: formatRate(rate.value),
        hint:
          rate.denominator === 0
            ? t('home.ops_no_result')
            : `${t('home.ops_success')} ${rate.numerator} / ${t(
                'home.ops_success_or_failure'
              )} ${rate.denominator}`,
        tone: rate.value === null ? 'default' : 'success',
        clickTab: 'ran',
        entityType: 'TASK'
      }
    ]
  })

  const statusChips = computed(() => {
    const g = taskPeriodGroups.value
    const core: DisplayGroup[] = ['success', 'failure', 'running', 'waiting']
    const chips = core.map((key) => ({ key, count: g[key] }))
    if (g.manual > 0) chips.push({ key: 'manual' as DisplayGroup, count: g.manual })
    if (g.other > 0) chips.push({ key: 'other' as DisplayGroup, count: g.other })
    return chips
  })

  const compactMode = computed(
    () => taskPeriodTotal.value > 0 && taskPeriodTotal.value <= 5
  )

  const durationTotal = computed(() => durationRows.value.length)
  const durationPageRows = computed(() => {
    const start = (durationPage.value - 1) * durationPageSize
    return durationRows.value.slice(start, start + durationPageSize)
  })

  const instances = computed(() => {
    const start = (instancePage.value - 1) * instancePageSize
    return instanceAll.value.slice(start, start + instancePageSize)
  })
  const schedules = computed(() => {
    const start = (schedulePage.value - 1) * schedulePageSize
    return scheduleAll.value.slice(start, start + schedulePageSize)
  })
  const scheduleTotal = computed(() => scheduleAll.value.length)

  const applyDefaultTab = () => {
    if (userPickedTab.value) return
    if (taskPeriodGroups.value.failure > 0) workbenchTab.value = 'failure'
    else if (taskSnapshotGroups.value.running > 0) workbenchTab.value = 'running'
    else workbenchTab.value = 'all'
  }

  const emptyGroups = (): Record<DisplayGroup, number> => ({
    success: 0,
    failure: 0,
    running: 0,
    waiting: 0,
    manual: 0,
    other: 0
  })

  const mergeGroups = (
    acc: Record<DisplayGroup, number>,
    next: Record<DisplayGroup, number>
  ) => {
    ;(Object.keys(next) as DisplayGroup[]).forEach((k) => {
      acc[k] = (acc[k] || 0) + (next[k] || 0)
    })
    return acc
  }

  /** Only projects the current user is authorized to see */
  const targetProjects = () => {
    if (scope.projectCode != null) {
      return projects.value.filter((p) => p.value === scope.projectCode)
    }
    // authorized list only; soft-cap for API fan-out
    return projects.value.slice(0, 50)
  }

  const hasAuthorizedProjects = computed(() => {
    if (dashboardMode === 'project') {
      const code = resolveFixedCode()
      if (code == null) return false
      // authorized if appears in list, or list still loading empty briefly after lock
      return projects.value.some((p) => Number(p.value) === Number(code))
    }
    return projects.value.length > 0
  })

  const showService = computed(
    () => isAdmin.value && !service.value.error
  )

  const loadProjects = async () => {
    const list = await queryProjectCreatedAndAuthorizedByUser()
    projects.value = (list || []).map((p: any) => ({
      label: p.name,
      value: p.code
    }))
    if (dashboardMode === 'project') {
      const code = resolveFixedCode()
      scope.projectCode = code
      const hit = projects.value.find((p) => Number(p.value) === Number(code))
      scope.projectName = hit?.label || resolveFixedName()
      return
    }
    // drop selection if no longer authorized
    if (
      scope.projectCode != null &&
      !projects.value.some((p) => p.value === scope.projectCode)
    ) {
      scope.projectCode = null
      scope.projectName = ''
    }
  }

  const sumTaskState = async (base: {
    startDate?: string
    endDate?: string
  }) => {
    const list = targetProjects()
    if (!list.length) {
      return { total: 0, groups: emptyGroups() }
    }
    const results = await Promise.all(
      list.map((p) =>
        countTaskState({
          ...base,
          projectCode: p.value
        }).catch(() => ({ totalCount: 0, taskInstanceStatusCounts: [] }))
      )
    )
    let total = 0
    const groups = emptyGroups()
    results.forEach((res: any) => {
      total += res?.totalCount || 0
      mergeGroups(
        groups,
        groupCounts(res?.taskInstanceStatusCounts || [], 'TASK')
      )
    })
    return { total, groups }
  }

  const fetchStateCounts = async () => {
    const list = targetProjects()
    if (!list.length) {
      taskPeriodGroups.value = emptyGroups()
      taskSnapshotGroups.value = emptyGroups()
      todayGroups.value = emptyGroups()
      taskPeriodTotal.value = 0
      todayTotal.value = 0
      periodTotal.value = 0
      workflowDefCount.value = 0
      return
    }

    const [period, snap, today, defCounts] = await Promise.all([
      sumTaskState({
        startDate: dateParams.value.startDate,
        endDate: dateParams.value.endDate
      }),
      sumTaskState({}),
      sumTaskState({
        startDate: todayParams.value.startDate,
        endDate: todayParams.value.endDate
      }),
      Promise.all(
        list.map((p) =>
          countDefinitionByUser({ projectCode: p.value } as any).catch(() => ({
            count: 0
          }))
        )
      )
    ])
    taskPeriodGroups.value = period.groups
    taskSnapshotGroups.value = snap.groups
    todayGroups.value = today.groups
    taskPeriodTotal.value = period.total
    todayTotal.value = today.total
    periodTotal.value = period.total
    workflowDefCount.value = defCounts.reduce(
      (s: number, r: any) => s + (r?.count || 0),
      0
    )
  }

  const stateTypeForTab = (tab: WorkbenchTab) => {
    if (tab === 'failure') return 'FAILURE'
    if (tab === 'running') return 'RUNNING_EXECUTION'
    if (tab === 'waiting') return 'SUBMITTED_SUCCESS'
    if (tab === 'ran') return 'SUCCESS'
    return undefined
  }

  const loadInstances = async () => {
    const list = targetProjects()
    if (!list.length) {
      instanceAll.value = []
      instanceTotal.value = 0
      instancePage.value = 1
      return
    }

    const tab = workbenchTab.value
    const entity: 'WORKFLOW' | 'TASK' =
      tab === 'workflow' ? 'WORKFLOW' : scope.entityType
    const usePeriod =
      tab === 'failure' || tab === 'all' || tab === 'ran' || tab === 'workflow'
    const rows: InstanceRow[] = []
    let total = 0

    await Promise.all(
      list.map(async (project) => {
        if (entity === 'WORKFLOW') {
          const res = await queryWorkflowInstanceListPaging(
            {
              pageNo: 1,
              pageSize: 30,
              searchVal: keyword.value || undefined,
              stateType: stateTypeForTab(tab === 'workflow' ? 'all' : tab),
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
              duration: item.duration,
              durationSec: durationToSeconds(item.duration)
            })
          })
        } else {
          // for "ran" also pull FAILURE
          const states =
            tab === 'ran'
              ? ['SUCCESS', 'FAILURE']
              : [stateTypeForTab(tab)]
          for (const st of states) {
            const res = await queryTaskListPaging(
              {
                pageNo: 1,
                pageSize: 30,
                searchVal: keyword.value || undefined,
                stateType: st || undefined,
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
                duration: item.duration,
                durationSec: durationToSeconds(item.duration)
              })
            })
          }
        }
      })
    )

    // newest first
    rows.sort((a, b) => parseTimeMs(b.startTime) - parseTimeMs(a.startTime))
    // dedupe by id
    const seen = new Set<number>()
    const unique = rows.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    })
    instanceAll.value = unique.slice(0, 100)
    instanceTotal.value = unique.length
    instancePage.value = 1
  }

  const loadSchedules = async () => {
    const list = targetProjects()
    const rows: ScheduleRow[] = []
    for (const project of list) {
      try {
        const res = await queryScheduleListPaging(
          { pageNo: 1, pageSize: 50 } as any,
          project.value
        )
        ;(res.totalList || []).forEach((item: any) => {
          if (
            item.releaseState &&
            String(item.releaseState).toUpperCase() !== 'ONLINE'
          ) {
            return
          }
          rows.push({
            time: (item.startTime || '').slice(11, 16) || '--:--',
            name:
              item.workflowDefinitionName ||
              item.processDefinitionName ||
              item.crontab,
            projectName: project.label,
            crontab: item.crontab,
            workflowDefinitionCode: item.workflowDefinitionCode,
            projectCode: project.value
          })
        })
      } catch (e) {
        /* ignore */
      }
    }
    scheduleAll.value = rows.slice(0, 60)
    schedulePage.value = 1
  }

  const loadService = async () => {
    if (!isAdmin.value) {
      service.value = {
        masterOnline: null,
        workerOnline: null,
        databaseOk: null,
        error: t('home.ops_monitor_unavailable')
      }
      return
    }
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

  const loadTrend = async () => {
    const days = 30
    const points: TrendPoint[] = []
    const today = startOfToday()
    // sequential batches of 5 to avoid flooding
    const jobs: Array<() => Promise<void>> = []
    for (let i = days - 1; i >= 0; i--) {
      const day = subDays(today, i)
      const start = format(startOfDay(day), 'yyyy-MM-dd HH:mm:ss')
      const end = format(endOfDay(day), 'yyyy-MM-dd HH:mm:ss')
      const label = format(day, 'MM-dd')
      jobs.push(async () => {
        const list = targetProjects()
        if (!list.length) {
          points.push({ date: label, taskCount: 0, workflowCount: 0 })
          return
        }
        const results = await Promise.all(
          list.map(async (p) => {
            const params = {
              startDate: start,
              endDate: end,
              projectCode: p.value
            }
            const [taskRes, wfRes] = await Promise.all([
              countTaskState(params).catch(() => ({ totalCount: 0 })),
              countWorkflowInstanceState(params).catch(() => ({
                totalCount: 0
              }))
            ])
            return {
              taskCount: taskRes.totalCount || 0,
              workflowCount: wfRes.totalCount || 0
            }
          })
        )
        points.push({
          date: label,
          taskCount: results.reduce((s, r) => s + r.taskCount, 0),
          workflowCount: results.reduce((s, r) => s + r.workflowCount, 0)
        })
      })
    }
    for (let i = 0; i < jobs.length; i += 5) {
      await Promise.all(jobs.slice(i, i + 5).map((fn) => fn()))
    }
    points.sort((a, b) => a.date.localeCompare(b.date))
    // dates are MM-dd within same year month order ok for 30d spanning months - better sort by index
    // rebuild in order
    const ordered: TrendPoint[] = []
    for (let i = days - 1; i >= 0; i--) {
      const day = subDays(today, i)
      const label = format(day, 'MM-dd')
      const found = points.find((p) => p.date === label)
      ordered.push(
        found || { date: label, taskCount: 0, workflowCount: 0 }
      )
    }
    trendPoints.value = ordered
  }

  const loadDurationRank = async () => {
    const list = targetProjects()
    const rows: InstanceRow[] = []
    const start = format(subDays(startOfToday(), 29), 'yyyy-MM-dd HH:mm:ss')
    const end = format(Date.now(), 'yyyy-MM-dd HH:mm:ss')
    await Promise.all(
      list.map(async (project) => {
        try {
          const res = await queryTaskListPaging(
            {
              pageNo: 1,
              pageSize: 100,
              startDate: start,
              endDate: end
            } as any,
            { projectCode: project.value }
          )
          ;(res.totalList || []).forEach((item: any) => {
            const sec = durationToSeconds(item.duration)
            if (sec <= 0) return
            rows.push({
              id: item.id,
              name: item.name || item.taskName,
              projectCode: project.value,
              projectName: project.label,
              state: item.state,
              group: mapRawState(item.state, 'TASK'),
              startTime: item.startTime,
              endTime: item.endTime,
              duration: item.duration,
              durationSec: sec
            })
          })
        } catch (e) {
          /* ignore */
        }
      })
    )
    rows.sort((a, b) => (b.durationSec || 0) - (a.durationSec || 0))
    const seen = new Set<number>()
    durationRows.value = rows
      .filter((r) => {
        if (seen.has(r.id)) return false
        seen.add(r.id)
        return true
      })
      .slice(0, 200)
    durationPage.value = 1
  }

  const refresh = async () => {
    const seq = ++requestSeq
    loading.value = true
    try {
      if (!projects.value.length) await loadProjects()
      await Promise.all([fetchStateCounts(), loadService()])
      if (seq !== requestSeq) return
      applyDefaultTab()
      await Promise.all([
        loadInstances(),
        loadSchedules(),
        loadTrend(),
        loadDurationRank()
      ])
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
    if (tab === 'workflow') scope.entityType = 'WORKFLOW'
    else if (tab !== 'all') scope.entityType = 'TASK'
  }

  const onMetricClick = (card: MetricCardModel) => {
    userPickedTab.value = true
    if (card.entityType) scope.entityType = card.entityType
    if (card.clickTab) workbenchTab.value = card.clickTab
  }

  const openInstance = (row: InstanceRow) => {
    if (scope.entityType === 'WORKFLOW' || workbenchTab.value === 'workflow') {
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

  const stopTimer = () => {
    if (timer != null) {
      window.clearInterval(timer)
      timer = undefined
    }
  }

  const setupTimer = () => {
    stopTimer()
    // only poll while this page is active in the SPA
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

  // leave / deactivate home: stop background polling immediately
  onBeforeUnmount(stopTimer)
  onUnmounted(stopTimer)
  onDeactivated(stopTimer)
  onActivated(() => {
    setupTimer()
  })
  onBeforeRouteLeave((_to, _from, next) => {
    stopTimer()
    next()
  })

  watch(
    () => [scope.projectCode, scope.dateRange[0], scope.dateRange[1], locale.value],
    () => {
      userPickedTab.value = false
      refresh()
    }
  )

  watch(
    () => scope.entityType,
    () => {
      // entity switch without resetting metric/tab pick
      loadInstances()
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
    instancePage,
    instancePageSize,
    schedules,
    scheduleTotal,
    schedulePage,
    schedulePageSize,
    service,
    keyword,
    trendPoints,
    trendMode,
    durationPageRows,
    durationTotal,
    durationPage,
    durationPageSize,
    refresh,
    setPreset,
    setTab,
    onMetricClick,
    openInstance,
    openMonitor,
    periodTotal,
    ranCount,
    todayTotal,
    hasAuthorizedProjects,
    showService,
    isAdmin,
    dashboardMode
  }
}
