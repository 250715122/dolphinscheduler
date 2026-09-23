import { defineComponent, onMounted, onBeforeUnmount, toRefs, watch, computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import {
  NButton,
  NIcon,
  NSpace,
  NTooltip,
  NSelect,
  NRadioGroup,
  NRadioButton,
  NSpin,
} from 'naive-ui'
import {
  ReloadOutlined,
  EyeOutlined,
  FilterOutlined,
  ExpandOutlined,
  QuestionCircleOutlined,
  CloseOutlined
} from '@vicons/antd'
import { useRelation } from './use-relation'
import FilterPanel from './components/FilterPanel'
import TopologyGraph from './components/TopologyGraph'
import TimelineView from './components/TimelineView'
import DetailDrawer from './components/DetailDrawer'
import Result from '@/components/result'
import styles from './styles/relation.module.scss'
import { useThemeStore } from '@/store/theme/theme'
import { queryProjectCreatedAndAuthorizedByUser } from '@/service/modules/projects'

const workflowRelation = defineComponent({
  name: 'workflow-relation',
  setup() {
    const { t, locale } = useI18n()
    const route = useRoute()
    const themeStore = useThemeStore()
    const projectAuthorized = ref(true)
    const fitToken = ref(0)
    const {
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
      selectedImpactUpstream,
      selectedImpactDownstream,
      summary,
      availableGroups,
      selectNode,
      focusNeighborhood,
      clearSelection
    } = useRelation()

    const projectCode = computed(() => {
      const raw = route.params.projectCode
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : null
    })

    const load = async () => {
      if (projectCode.value == null) return
      try {
        const list: any[] = await queryProjectCreatedAndAuthorizedByUser()
        const ok = (list || []).some(
          (p: any) => Number(p.code) === Number(projectCode.value)
        )
        projectAuthorized.value = ok
        if (!ok) return
      } catch {
        projectAuthorized.value = false
        return
      }
      getWorkflowList(projectCode.value)
      getWorkflowName(projectCode.value)
    }

    onMounted(load)

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection()
    }
    const onPointerDown = (e: MouseEvent) => {
      if (variables.selectedId == null) return
      const el = e.target as HTMLElement | null
      if (!el || typeof el.closest !== 'function') return
      // 拓扑视图（画布）内：拖拽/点击/空白均不关闭
      if (el.closest('[data-relation-canvas]')) return
      // 详情抽屉内不关闭
      if (el.closest('[data-relation-drawer]')) return
      if (el.closest('.n-drawer')) return
      if (el.closest('.n-drawer-container')) return
      // 仅拓扑视图外（工具栏/筛选/摘要等）关闭
      clearSelection()
    }
    onMounted(() => {
      window.addEventListener('keydown', onKeydown)
      document.addEventListener('mousedown', onPointerDown, true)
    })
    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onKeydown)
      document.removeEventListener('mousedown', onPointerDown, true)
    })

    const handleDropdownWorkflow = (value: number | null) => {
      if (projectCode.value == null) return
      variables.workflow = value
      if (value) {
        variables.selectedId = value
        getOneWorkflow(Number(value), projectCode.value)
      } else {
        variables.selectedId = null
        getWorkflowList(projectCode.value)
      }
    }

    const handleRefresh = () => {
      if (projectCode.value == null) return
      if (variables.workflow) {
        getOneWorkflow(Number(variables.workflow), projectCode.value)
      } else {
        getWorkflowList(projectCode.value)
      }
    }

    watch(
      () => locale.value,
      () => handleRefresh()
    )

    watch(
      () => route.params.projectCode,
      (code) => {
        const n = Number(code)
        if (!Number.isFinite(n) || n <= 0) return
        variables.selectedId = null
        variables.workflow = null
        variables.groups = []
        load()
      }
    )

    const sameStatus = (arr: string[]) => {
      const cur = [...variables.status].sort().join(',')
      const next = [...arr].sort().join(',')
      return cur === next
    }

    const handleMetricClick = (key: string) => {
      switch (key) {
        case 'nodes':
          variables.status = []
          variables.onlyIsolated = false
          variables.depth = 99
          variables.groups = []
          variables.keyword = ''
          variables.selectedId = null
          break
        case 'edges':
          variables.onlyIsolated = false
          variables.depth = 99
          break
        case 'isolated':
          variables.onlyIsolated = !variables.onlyIsolated
          if (variables.onlyIsolated) variables.status = []
          break
        case 'level':
          variables.viewMode = 'topology'
          break
        case 'online':
          variables.status = sameStatus(['online']) ? [] : ['online']
          variables.onlyIsolated = false
          break
        case 'workflow_offline':
          variables.status = sameStatus(['workflow_offline'])
            ? []
            : ['workflow_offline']
          variables.onlyIsolated = false
          break
        case 'schedule_offline':
          variables.status = sameStatus(['schedule_offline'])
            ? []
            : ['schedule_offline']
          variables.onlyIsolated = false
          break
        default:
          break
      }
    }

    const metricActive = (key: string) => {
      if (key === 'isolated') return variables.onlyIsolated
      if (key === 'online') return sameStatus(['online'])
      if (key === 'workflow_offline') return sameStatus(['workflow_offline'])
      if (key === 'schedule_offline') return sameStatus(['schedule_offline'])
      if (key === 'nodes') {
        return (
          !variables.onlyIsolated &&
          !variables.status.length &&
          !variables.groups.length &&
          !variables.keyword &&
          variables.depth === 99 &&
          variables.selectedId == null
        )
      }
      return false
    }

    const toggleFilter = () => {
      variables.filterCollapsed = !variables.filterCollapsed
    }
    const collapseFilter = () => {
      variables.filterCollapsed = true
    }
    const expandFilter = () => {
      variables.filterCollapsed = false
    }

    return {
      t,
      handleRefresh,
      handleDropdownWorkflow,
      handleMetricClick,
      metricActive,
      fitToken,
      toggleFilter,
      collapseFilter,
      expandFilter,
      ...toRefs(variables),
      visibleNodes,
      visibleLinks,
      highlightIds,
      selectedNode,
      selectedUpstream,
      selectedDownstream,
      selectedImpactUpstream,
      selectedImpactDownstream,
      summary,
      availableGroups,
      selectNode,
      focusNeighborhood,
      clearSelection,
      projectCode,
      themeStore,
      projectAuthorized
    }
  },
  render() {
    const { t } = this
    const empty = this.rawNodes.length === 0 && !this.loading
    const denied = !this.projectAuthorized
    return (
      <div class={[styles.page, this.themeStore.darkTheme ? styles.pageDark : null]}>
        <div class={styles.toolbar}>
          <div class={styles.toolbarLeft}>
            <div>
              <h2 class={styles.title}>
                {t('project.workflow.relation_title')}
                <NTooltip>
                  {{
                    default: () => t('project.workflow.relation_subtitle'),
                    trigger: () => (
                      <NIcon
                        size={14}
                        style='margin-left:6px;vertical-align:middle;color:#94a3b8;cursor:help'
                      >
                        <QuestionCircleOutlined />
                      </NIcon>
                    )
                  }}
                </NTooltip>
              </h2>
            </div>
          </div>
          <NSpace align='center'>
            <NSelect
              style={{ width: '260px' }}
              clearable
              filterable
              size='small'
              placeholder={t('project.workflow.workflow_name')}
              options={this.workflowOptions}
              value={this.workflow}
              onUpdateValue={(value: any) => this.handleDropdownWorkflow(value)}
            />
            <NTooltip>
              {{
                default: () => t('project.workflow.relation_fit_view'),
                trigger: () => (
                  <NButton
                    strong
                    secondary
                    circle
                    type='info'
                    onClick={() => (this.fitToken = this.fitToken + 1)}
                  >
                    <NIcon>
                      <ExpandOutlined />
                    </NIcon>
                  </NButton>
                )
              }}
            </NTooltip>
            <NTooltip>
              {{
                default: () => t('project.workflow.refresh'),
                trigger: () => (
                  <NButton strong secondary circle type='info' onClick={this.handleRefresh}>
                    <NIcon>
                      <ReloadOutlined />
                    </NIcon>
                  </NButton>
                )
              }}
            </NTooltip>
            <NTooltip>
              {{
                default: () => t('project.workflow.show_hide_label'),
                trigger: () => (
                  <NButton
                    strong
                    secondary
                    circle
                    type='info'
                    onClick={() => (this.labelShow = !this.labelShow)}
                  >
                    <NIcon>
                      <EyeOutlined />
                    </NIcon>
                  </NButton>
                )
              }}
            </NTooltip>
          </NSpace>
        </div>

        <div class={styles.summaryRow}>
          <div class={styles.summary}>
            <button
              type='button'
              class={[
                styles.filterChipBtn,
                !this.filterCollapsed ? styles.filterChipBtnActive : ''
              ].join(' ')}
              onClick={() => this.toggleFilter()}
            >
              <NIcon size={14}>
                <FilterOutlined />
              </NIcon>
              {t('project.workflow.relation_filters')}
            </button>
          <span
            class={[styles.chip, this.metricActive('nodes') ? styles.chipActive : ''].join(' ')}
            onClick={() => this.handleMetricClick('nodes')}
          >
            {t('project.workflow.relation_metric_nodes')}{' '}
            <strong>{this.summary.totalNodes}</strong>
          </span>
          <span
            class={[styles.chip, this.metricActive('edges') ? styles.chipActive : ''].join(' ')}
            onClick={() => this.handleMetricClick('edges')}
          >
            {t('project.workflow.relation_metric_edges')}{' '}
            <strong>{this.summary.totalEdges}</strong>
          </span>
          <span
            class={[styles.chip, this.metricActive('isolated') ? styles.chipActive : ''].join(' ')}
            onClick={() => this.handleMetricClick('isolated')}
          >
            {t('project.workflow.relation_metric_isolated')}{' '}
            <strong>{this.summary.isolated}</strong>
          </span>
          <span
            class={[styles.chip, this.metricActive('online') ? styles.chipActive : ''].join(' ')}
            onClick={() => this.handleMetricClick('online')}
          >
            {t('project.workflow.online')} <strong>{this.summary.online}</strong>
          </span>
          <span
            class={[
              styles.chip,
              this.metricActive('workflow_offline') ? styles.chipActive : ''
            ].join(' ')}
            onClick={() => this.handleMetricClick('workflow_offline')}
          >
            {t('project.workflow.workflow_offline')}{' '}
            <strong>{this.summary.offline}</strong>
          </span>
          <span
            class={[
              styles.chip,
              this.metricActive('schedule_offline') ? styles.chipActive : ''
            ].join(' ')}
            onClick={() => this.handleMetricClick('schedule_offline')}
          >
            {t('project.workflow.schedule_offline')}{' '}
            <strong>{this.summary.scheduleOffline}</strong>
          </span>
          </div>
          {!this.filterCollapsed ? (
            <FilterPanel
              keyword={this.keyword}
              groups={this.groups}
              availableGroups={this.availableGroups}
              status={this.status}
              depth={this.depth}
              onlyIsolated={this.onlyIsolated}
              onUpdate:keyword={(v: string) => (this.keyword = v)}
              onUpdate:groups={(v: string[]) => (this.groups = v)}
              onUpdate:status={(v: string[]) => (this.status = v)}
              onUpdate:depth={(v: number) => (this.depth = v)}
              onUpdate:onlyIsolated={(v: boolean) => (this.onlyIsolated = v)}
              onCollapse={() => this.collapseFilter()}
            />
          ) : null}
        </div>

        {denied ? (
          <Result
            title={t('project.workflow.relation_no_permission_title')}
            description={t('project.workflow.relation_no_permission_desc')}
            status={'info'}
            size={'medium'}
          />
        ) : empty ? (
          <Result
            title={t('project.workflow.workflow_relation_no_data_result_title')}
            description={t('project.workflow.workflow_relation_no_data_result_desc')}
            status={'info'}
            size={'medium'}
          />
        ) : (
          <NSpin show={this.loading} class={styles.spinFill}>
            <div class={styles.body}>
              <div class={styles.canvas} data-relation-canvas='1'>
                <div class={styles.canvasHead}>
                  <NRadioGroup
                    value={this.viewMode}
                    size='small'
                    onUpdateValue={(v: any) => (this.viewMode = v)}
                  >
                    <NRadioButton value='topology'>
                      {t('project.workflow.relation_view_topology')}
                    </NRadioButton>
                    <NRadioButton value='timeline'>
                      {t('project.workflow.relation_view_timeline')}
                    </NRadioButton>
                  </NRadioGroup>
                  <div class={styles.legend}>
                    <span>
                      <i class={styles.dot} style='background:#16a34a' />
                      {t('project.workflow.online')}
                    </span>
                    <span>
                      <i class={styles.dot} style='background:#dc2626' />
                      {t('project.workflow.workflow_offline')}
                    </span>
                    <span>
                      <i class={styles.dot} style='background:#ea580c' />
                      {t('project.workflow.schedule_offline')}
                    </span>
                    <span>{t('project.workflow.relation_focus_hint')}</span>
                  </div>
                </div>
                <div class={styles.canvasBody}>
                  {this.viewMode === 'topology' ? (
                    <TopologyGraph
                      nodes={this.visibleNodes}
                      links={this.visibleLinks}
                      selectedId={this.selectedId}
                      highlightIds={this.highlightIds}
                      labelShow={this.labelShow}
                      fitToken={this.fitToken}
                      darkTheme={this.themeStore.darkTheme}
                      onSelect={(id: any) => { if (id != null) this.selectNode(id, { keep: true }) }}
                      onFocus={(id: any) => this.focusNeighborhood(id, 2)}
                    />
                  ) : (
                    <TimelineView
                      nodes={this.visibleNodes}
                      links={this.visibleLinks}
                      selectedId={this.selectedId}
                      highlightIds={this.highlightIds}
                      onSelect={(id: any) => { if (id != null) this.selectNode(id, { keep: true }) }}
                    />
                  )}
                </div>
              </div>
            </div>
          </NSpin>
        )}

        {this.selectedNode ? (
          <aside class={styles.detailSide} data-relation-drawer='1'>
            <div class={styles.detailSideHead}>
              <span class={styles.detailSideTitle}>
                {t('project.workflow.relation_detail')}
              </span>
              <NButton
                quaternary
                circle
                size='small'
                onClick={() => this.clearSelection()}
              >
                <NIcon size={16}>
                  <CloseOutlined />
                </NIcon>
              </NButton>
            </div>
            <div class={styles.detailSideBody}>
              <DetailDrawer
                node={this.selectedNode}
                upstream={this.selectedUpstream}
                downstream={this.selectedDownstream}
                impactUpstream={this.selectedImpactUpstream}
                impactDownstream={this.selectedImpactDownstream}
                onSelect={(id: any) => this.selectNode(id, { keep: true })}
              />
            </div>
          </aside>
        ) : null}
      </div>
    )
  }
})

export default workflowRelation
