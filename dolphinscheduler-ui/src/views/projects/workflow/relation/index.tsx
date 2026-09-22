import { defineComponent, onMounted, onBeforeUnmount, toRefs, watch, computed } from 'vue'
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
  NSpin
} from 'naive-ui'
import { ReloadOutlined, EyeOutlined } from '@vicons/antd'
import { useRelation } from './use-relation'
import FilterPanel from './components/FilterPanel'
import TopologyGraph from './components/TopologyGraph'
import TimelineView from './components/TimelineView'
import DetailDrawer from './components/DetailDrawer'
import Result from '@/components/result'
import styles from './styles/relation.module.scss'

const workflowRelation = defineComponent({
  name: 'workflow-relation',
  setup() {
    const { t, locale } = useI18n()
    const route = useRoute()
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
      summary,
      availableGroups,
      selectNode,
      clearSelection
    } = useRelation()

    const projectCode = computed(() => {
      const raw = route.params.projectCode
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : null
    })

    const load = () => {
      if (projectCode.value == null) return
      getWorkflowList(projectCode.value)
      getWorkflowName(projectCode.value)
    }

    onMounted(load)

    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection()
    }
    onMounted(() => window.addEventListener('keydown', onKeydown))
    onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))


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
          // show all
          variables.status = []
          variables.onlyIsolated = false
          variables.depth = 99
          variables.groups = []
          variables.keyword = ''
          variables.selectedId = null
          break
        case 'edges':
          // focus dependency topology
          variables.onlyIsolated = false
          variables.depth = 99
          variables.viewMode = 'topology'
          break
        case 'isolated':
          variables.onlyIsolated = !variables.onlyIsolated
          if (variables.onlyIsolated) {
            variables.status = []
          }
          break
        case 'level':
          variables.onlyIsolated = false
          variables.depth = 99
          variables.viewMode = 'topology'
          break
        case 'online':
          variables.onlyIsolated = false
          variables.status = sameStatus(['online']) ? [] : ['online']
          break
        case 'workflow_offline':
          variables.onlyIsolated = false
          variables.status = sameStatus(['workflow_offline'])
            ? []
            : ['workflow_offline']
          break
        case 'schedule_offline':
          variables.onlyIsolated = false
          variables.status = sameStatus(['schedule_offline'])
            ? []
            : ['schedule_offline']
          break
      }
    }

    const metricActive = (key: string) => {
      if (key === 'isolated') return variables.onlyIsolated
      if (key === 'online') return sameStatus(['online'])
      if (key === 'workflow_offline') return sameStatus(['workflow_offline'])
      if (key === 'schedule_offline') return sameStatus(['schedule_offline'])
      if (key === 'edges' || key === 'level')
        return (
          variables.viewMode === 'topology' &&
          !variables.onlyIsolated &&
          variables.depth === 99
        )
      if (key === 'nodes')
        return (
          !variables.onlyIsolated &&
          variables.status.length === 0 &&
          !variables.keyword &&
          variables.groups.length === 0 &&
          variables.depth === 99
        )
      return false
    }

    return {
      t,
      handleRefresh,
      handleDropdownWorkflow,
      handleMetricClick,
      metricActive,
      ...toRefs(variables),
      visibleNodes,
      visibleLinks,
      highlightIds,
      selectedNode,
      selectedUpstream,
      selectedDownstream,
      summary,
      availableGroups,
      selectNode,
      clearSelection,
      projectCode
    }
  },
  render() {
    const { t } = this
    const empty = this.rawNodes.length === 0 && !this.loading

    return (
      <div class={styles.page}>
        <div class={styles.toolbar}>
          <div>
            <h2 class={styles.title}>{t('project.workflow.relation_title')}</h2>
            <p class={styles.subtitle}>{t('project.workflow.relation_subtitle')}</p>
          </div>
          <NSpace align='center'>
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
            <NSelect
              style={{ width: '280px' }}
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

        <div class={styles.summary}>
          <span
            class={[styles.chip, this.metricActive('nodes') ? styles.chipActive : ''].join(' ')}
            title={t('project.workflow.relation_metric_nodes')}
            onClick={() => this.handleMetricClick('nodes')}
          >
            {t('project.workflow.relation_metric_nodes')}{' '}
            <strong>{this.summary.totalNodes}</strong>
          </span>
          <span
            class={[styles.chip, this.metricActive('edges') ? styles.chipActive : ''].join(' ')}
            title={t('project.workflow.relation_metric_edges')}
            onClick={() => this.handleMetricClick('edges')}
          >
            {t('project.workflow.relation_metric_edges')}{' '}
            <strong>{this.summary.totalEdges}</strong>
          </span>
          <span
            class={[styles.chip, this.metricActive('isolated') ? styles.chipActive : ''].join(' ')}
            title={t('project.workflow.relation_metric_isolated')}
            onClick={() => this.handleMetricClick('isolated')}
          >
            {t('project.workflow.relation_metric_isolated')}{' '}
            <strong>{this.summary.isolated}</strong>
          </span>
          <span
            class={[styles.chip, this.metricActive('level') ? styles.chipActive : ''].join(' ')}
            title={t('project.workflow.relation_level')}
            onClick={() => this.handleMetricClick('level')}
          >
            {t('project.workflow.relation_level')}{' '}
            <strong>0–{this.summary.maxLevel}</strong>
          </span>
          <span
            class={[styles.chip, this.metricActive('online') ? styles.chipActive : ''].join(' ')}
            title={t('project.workflow.online')}
            onClick={() => this.handleMetricClick('online')}
          >
            {t('project.workflow.online')} <strong>{this.summary.online}</strong>
          </span>
          <span
            class={[
              styles.chip,
              this.metricActive('workflow_offline') ? styles.chipActive : ''
            ].join(' ')}
            title={t('project.workflow.workflow_offline')}
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
            title={t('project.workflow.schedule_offline')}
            onClick={() => this.handleMetricClick('schedule_offline')}
          >
            {t('project.workflow.schedule_offline')}{' '}
            <strong>{this.summary.scheduleOffline}</strong>
          </span>
        </div>

        {empty ? (
          <Result
            title={t('project.workflow.workflow_relation_no_data_result_title')}
            description={t('project.workflow.workflow_relation_no_data_result_desc')}
            status={'info'}
            size={'medium'}
          />
        ) : (
          <NSpin show={this.loading}>
            <div class={styles.body}>
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
              />

              <div class={styles.canvas}>
                <div class={styles.canvasHead}>
                  <div class={styles.legend}>
                    <span>
                      <i class={styles.dot} style='background:#2563eb' />
                      {t('project.workflow.online')}
                    </span>
                    <span>
                      <i class={styles.dot} style='background:#f37373' />
                      {t('project.workflow.workflow_offline')}
                    </span>
                    <span>
                      <i class={styles.dot} style='background:#ba3e3e' />
                      {t('project.workflow.schedule_offline')}
                    </span>
                    <span>{t('project.workflow.relation_lane_hint')}</span>
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
                      onSelect={(id: any) => this.selectNode(id)}
                    />
                  ) : (
                    <TimelineView
                      nodes={this.visibleNodes}
                      links={this.visibleLinks}
                      selectedId={this.selectedId}
                      highlightIds={this.highlightIds}
                      onSelect={(id: any) => this.selectNode(id)}
                    />
                  )}
                </div>
              </div>

              <DetailDrawer
                node={this.selectedNode}
                upstream={this.selectedUpstream}
                downstream={this.selectedDownstream}
                onSelect={(id: any) => this.selectNode(id)}
              />
            </div>
          </NSpin>
        )}
      </div>
    )
  }
})

export default workflowRelation
