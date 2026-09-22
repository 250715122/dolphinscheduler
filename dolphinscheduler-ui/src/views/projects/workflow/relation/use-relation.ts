import { computed, reactive } from 'vue'
import { useAsyncState } from '@vueuse/core'
import {
  queryWorkFlowList,
  queryLineageByWorkFlowCode,
  queryLineageByWorkFlowName
} from '@/service/modules/lineages'
import { queryScheduleList } from '@/service/modules/schedules'
import { queryListPaging } from '@/service/modules/workflow-definition'
import type {
  WorkflowRes,
  WorkFlowRelationDetailListRes
} from '@/service/modules/lineages/types'
import { extractPrefix } from './utils/group'
import {
  buildTopoPositions,
  neighbors,
  computeSummary,
  type RelationLink,
  type RelationNode
} from './utils/layout'
import {
  resolveWorkflowGroup,
  collectGroups,
  DEFAULT_GROUP_RULES,
  type WorkflowGroupRule
} from './utils/workflow-group'
import { queryProjectPreferenceByProjectCode } from '@/service/modules/projects-preference'

export type ViewMode = 'topology' | 'timeline'

export function useRelation() {
  const variables = reactive({
    workflowOptions: [] as Array<{ label: string; value: number }>,
    workflow: null as null | number,
    rawNodes: [] as RelationNode[],
    rawLinks: [] as RelationLink[],
    labelShow: true,
    loading: false,
    selectedId: null as null | string | number,
    viewMode: 'timeline' as ViewMode,
    keyword: '',
    groups: [] as string[],
    groupRules: [] as WorkflowGroupRule[],
    groupOverrides: {} as Record<string, string>,
    status: [] as string[],
    depth: 99,
    onlyIsolated: false
  })

  const applyBizGroups = () => {
    const rules = variables.groupRules?.length
      ? variables.groupRules
      : DEFAULT_GROUP_RULES
    variables.rawNodes = variables.rawNodes.map((n) => {
      const g = resolveWorkflowGroup(
        { name: n.name, description: n.description, code: n.id },
        rules,
        variables.groupOverrides
      )
      return {
        ...n,
        prefix: extractPrefix(String(n.name || '')),
        bizGroup: g.name,
        bizGroupColor: g.color,
        bizGroupSource: g.source
      }
    })
  }

  const loadGroupRules = async (projectCode: number) => {
    try {
      const result = await queryProjectPreferenceByProjectCode(projectCode)
      if (result?.preferences) {
        const pref = JSON.parse(result.preferences)
        variables.groupRules = pref.workflowGroupRules || []
        variables.groupOverrides = pref.workflowGroupOverrides || {}
      } else {
        variables.groupRules = []
        variables.groupOverrides = {}
      }
    } catch {
      variables.groupRules = []
      variables.groupOverrides = {}
    }
  }

  const mergeAllDefinitions = async (projectCode: number) => {
    if (!Number.isFinite(projectCode) || projectCode <= 0) return
    try {
      const page: any = await queryListPaging(
        { pageNo: 1, pageSize: 200, searchVal: '' },
        projectCode
      )
      const arr = page?.totalList || page?.data?.totalList || []
      if (!Array.isArray(arr) || !arr.length) return
      const byCode = new Map<string, any>()
      arr.forEach((item: any) => {
        const code = item.code ?? item.workflowDefinitionCode
        if (code != null) byCode.set(String(code), item)
      })
      // enrich existing with description / release
      variables.rawNodes = variables.rawNodes.map((n) => {
        const item = byCode.get(String(n.id))
        if (!item) return n
        return {
          ...n,
          description: item.description ?? n.description,
          name: n.name || item.name,
          workFlowPublishStatus:
            n.workFlowPublishStatus ??
            (item.releaseState === 'ONLINE' || item.releaseState === 1 ? 1 : 0)
        }
      })
      const existing = new Set(variables.rawNodes.map((n) => String(n.id)))
      const extras: RelationNode[] = []
      arr.forEach((item: any) => {
        const code = item.code ?? item.workflowDefinitionCode
        const name = item.name ?? item.workflowDefinitionName
        if (code == null || existing.has(String(code))) return
        const release =
          item.releaseState === 'ONLINE' || item.releaseState === 1 ? 1 : 0
        extras.push({
          id: code,
          name,
          description: item.description,
          prefix: extractPrefix(String(name || '')),
          workFlowPublishStatus: release,
          schedulePublishStatus: 0,
          workFlowName: name,
          workFlowCode: code
        })
      })
      if (extras.length) {
        variables.rawNodes = [...variables.rawNodes, ...extras]
      }
      applyBizGroups()
    } catch {
      applyBizGroups()
    }
  }

  const mergeCrontabFromSchedules = async (projectCode: number) => {
    if (!Number.isFinite(projectCode) || projectCode <= 0) return
    try {
      const list: any = await queryScheduleList(projectCode as any)
      const arr = Array.isArray(list) ? list : list?.data || []
      if (!Array.isArray(arr) || !arr.length) return
      const byDef = new Map<string, any>()
      arr.forEach((s: any) => {
        const code = String(
          s.workflowDefinitionCode || s.processDefinitionCode || ''
        )
        if (code) byDef.set(code, s)
      })
      variables.rawNodes = variables.rawNodes.map((n) => {
        const s = byDef.get(String(n.id))
        if (!s) return n
        const schOnline =
          s.releaseState === 'ONLINE' ||
          s.releaseState === 1 ||
          s.releaseState === '1'
        return {
          ...n,
          crontab: n.crontab || s.crontab,
          scheduleStartTime: n.scheduleStartTime || s.startTime,
          scheduleEndTime: n.scheduleEndTime || s.endTime,
          schedulePublishStatus: schOnline ? 1 : 0
        }
      })
    } catch {
      /* schedule enrichment optional */
    }
  }

  const formatWorkflow = (obj: any) => {
    const payload =
      obj?.data?.workFlowRelationDetailList || obj?.data?.workFlowRelationList
        ? obj.data
        : obj?.data?.data?.workFlowRelationDetailList ||
            obj?.data?.data?.workFlowRelationList
          ? obj.data.data
          : obj?.workFlowRelationDetailList || obj?.workFlowRelationList
            ? obj
            : obj?.data || {}
    variables.rawNodes = (payload.workFlowRelationDetailList || []).map(
      (item: any) => {
        return {
          name: item.workFlowName,
          id: item.workFlowCode,
          prefix: extractPrefix(item.workFlowName),
          ...item
        } as RelationNode
      }
    )
    variables.rawLinks = (payload.workFlowRelationList || [])
      .filter((item: any) => Number(item.sourceWorkFlowCode) !== 0)
      .map((item: any) => ({
        source: String(item.sourceWorkFlowCode),
        target: String(item.targetWorkFlowCode)
      }))
  }

  const statusOf = (n: RelationNode) => {
    const wp = Number(n.workFlowPublishStatus)
    const sp = Number(n.schedulePublishStatus)
    if (wp === 0) return 'workflow_offline'
    if (wp === 1 && sp === 0) return 'schedule_offline'
    return 'online'
  }

  const availableGroups = computed(() =>
    collectGroups(
      variables.rawNodes.map((n) => ({
        name: String(n.name),
        description: n.description,
        code: n.id
      })),
      variables.groupRules?.length ? variables.groupRules : DEFAULT_GROUP_RULES,
      variables.groupOverrides
    )
  )

  const filteredNodes = computed(() => {
    let list = [...variables.rawNodes]
    if (variables.keyword) {
      const q = variables.keyword.toLowerCase()
      list = list.filter(
        (n) =>
          String(n.name).toLowerCase().includes(q) ||
          String(n.id).includes(q) ||
          String(n.prefix || '').includes(q)
      )
    }
    if (variables.groups.length) {
      list = list.filter((n) =>
        variables.groups.includes(String(n.bizGroup || n.prefix || ''))
      )
    }
    if (variables.status.length) {
      list = list.filter((n) => variables.status.includes(statusOf(n)))
    }
    if (variables.onlyIsolated) {
      const connected = new Set<string>()
      variables.rawLinks.forEach((l) => {
        connected.add(String(l.source))
        connected.add(String(l.target))
      })
      list = list.filter((n) => !connected.has(String(n.id)))
    }
    return list
  })

  const focusIds = computed(() => {
    if (variables.selectedId == null || variables.depth === 99) {
      return null as Set<string> | null
    }
    const id = String(variables.selectedId)
    if (variables.depth === 0) return new Set([id])
    const { upstream, downstream } = neighbors(
      id,
      variables.rawLinks,
      variables.depth
    )
    return new Set<string>([id, ...upstream, ...downstream])
  })

  const visibleNodes = computed(() => {
    let list = filteredNodes.value
    if (focusIds.value) {
      list = list.filter((n) => focusIds.value!.has(String(n.id)))
    }
    const ids = new Set(list.map((n) => String(n.id)))
    const links = variables.rawLinks.filter(
      (l) => ids.has(String(l.source)) && ids.has(String(l.target))
    )
    return buildTopoPositions(list, links)
  })

  const visibleLinks = computed(() => {
    const ids = new Set(visibleNodes.value.map((n) => String(n.id)))
    return variables.rawLinks.filter(
      (l) => ids.has(String(l.source)) && ids.has(String(l.target))
    )
  })

  const highlightIds = computed(() => {
    if (variables.selectedId == null) return [] as string[]
    const id = String(variables.selectedId)
    const { upstream, downstream } = neighbors(id, variables.rawLinks, 99)
    return [id, ...upstream, ...downstream]
  })

  const selectedNode = computed(() => {
    if (variables.selectedId == null) return null
    return (
      variables.rawNodes.find(
        (n) => String(n.id) === String(variables.selectedId)
      ) || null
    )
  })

  const selectedUpstream = computed(() => {
    if (!selectedNode.value) return [] as RelationNode[]
    const { upstream } = neighbors(
      String(selectedNode.value.id),
      variables.rawLinks,
      1
    )
    return variables.rawNodes.filter((n) => upstream.has(String(n.id)))
  })

  const selectedDownstream = computed(() => {
    if (!selectedNode.value) return [] as RelationNode[]
    const { downstream } = neighbors(
      String(selectedNode.value.id),
      variables.rawLinks,
      1
    )
    return variables.rawNodes.filter((n) => downstream.has(String(n.id)))
  })

  const summary = computed(() =>
    computeSummary(filteredNodes.value, visibleLinks.value)
  )

  const getWorkflowName = (projectCode: number) => {
    if (!Number.isFinite(projectCode) || projectCode <= 0) return
    const { state } = useAsyncState(
      queryLineageByWorkFlowName({ projectCode }).then(
        (res: Array<WorkFlowRelationDetailListRes>) => {
          variables.workflowOptions = res.map((item) => ({
            label: item.workFlowName,
            value: item.workFlowCode
          }))
        }
      ),
      {}
    )
    return state
  }

  const getOneWorkflow = (workflowCode: number, projectCode: number) => {
    if (!Number.isFinite(projectCode) || projectCode <= 0) return
    variables.loading = true
    const { state } = useAsyncState(
      queryLineageByWorkFlowCode(
        { workFlowCode: workflowCode },
        { projectCode }
      )
        .then(async (res: WorkflowRes) => {
          formatWorkflow(res)
          variables.selectedId = workflowCode
          await loadGroupRules(projectCode)
          await mergeAllDefinitions(projectCode)
          await mergeCrontabFromSchedules(projectCode)
          applyBizGroups()
        })
        .finally(() => {
          variables.loading = false
        }),
      {}
    )
    return state
  }

  const getWorkflowList = (projectCode: number) => {
    if (!Number.isFinite(projectCode) || projectCode <= 0) return
    variables.loading = true
    const { state } = useAsyncState(
      queryWorkFlowList({ projectCode })
        .then(async (res: WorkflowRes) => {
          formatWorkflow(res)
          await loadGroupRules(projectCode)
          await mergeAllDefinitions(projectCode)
          await mergeCrontabFromSchedules(projectCode)
          applyBizGroups()
        })
        .finally(() => {
          variables.loading = false
        }),
      {}
    )
    return state
  }

  const selectNode = (id: string | number) => {
    if (String(variables.selectedId) === String(id)) {
      variables.selectedId = null
    } else {
      variables.selectedId = id
    }
  }

  const clearSelection = () => {
    variables.selectedId = null
  }

  return {
    variables,
    getWorkflowName,
    getOneWorkflow,
    getWorkflowList,
    visibleNodes,
    visibleLinks,
    highlightIds,
    selectedNode,
    selectedUpstream,
    selectedDownstream,
    summary,
    availableGroups,
    selectNode,
    clearSelection
  }
}
