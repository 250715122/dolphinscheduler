import { defineComponent, PropType, ref, watch } from 'vue'
import { NButton, NSpace, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import type { RelationNode } from '../utils/layout'
import { crontabToDayWindow } from '../utils/schedule'
import styles from '../styles/relation.module.scss'

type PanelMode = 'detail' | 'impact'

const DetailDrawer = defineComponent({
  name: 'RelationDetailDrawer',
  props: {
    node: { type: Object as PropType<RelationNode | null>, default: null },
    upstream: { type: Array as PropType<RelationNode[]>, default: () => [] },
    downstream: { type: Array as PropType<RelationNode[]>, default: () => [] },
    impactUpstream: {
      type: Array as PropType<RelationNode[]>,
      default: () => []
    },
    impactDownstream: {
      type: Array as PropType<RelationNode[]>,
      default: () => []
    }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const router = useRouter()
    const route = useRoute()
    const panel = ref<PanelMode>('detail')

    const schedOf = (n: RelationNode) => {
      const w = crontabToDayWindow(n.crontab)
      return w?.label || t('project.workflow.relation_timeline_no_cron')
    }

    const rowLabel = (n: RelationNode) => {
      const ext = n.external
        ? ` · ${t('project.workflow.relation_external_short', {
            project: n.projectName || t('project.workflow.relation_external_project')
          })}`
        : ''
      return `[L${n.topoLevel ?? '?'} · ${n.bizGroup || n.prefix || '—'} · ${schedOf(n)}${ext}] ${n.name}`
    }

    watch(
      () => (props.node ? String(props.node.id) : null),
      () => {
        panel.value = 'detail'
      }
    )

    const projectPathCode = () =>
      props.node?.external && props.node?.projectCode
        ? props.node.projectCode
        : route.params.projectCode

    const goDefinition = () => {
      if (!props.node) return
      router.push({
        path: `/projects/${projectPathCode()}/workflow/definitions/${props.node.id}`,
        query: { ...route.query }
      })
    }
    const goInstances = () => {
      if (!props.node) return
      router.push({
        path: `/projects/${projectPathCode()}/workflow/instances`,
        query: {
          ...route.query,
          workflowDefinitionCode: String(props.node.id)
        }
      })
    }

    return () => {
      if (!props.node) {
        return (
          <div class={styles.empty}>{t('project.workflow.relation_detail_empty')}</div>
        )
      }

      if (panel.value === 'impact') {
        return (
          <div>
            <div class={styles.impactNav}>
              <NButton
                text
                type='primary'
                size='small'
                onClick={() => (panel.value = 'detail')}
              >
                ← {t('project.workflow.relation_back_detail')}
              </NButton>
            </div>
            <div class={styles.impactHero}>
              <div class={styles.impactTitle}>{props.node.name}
              {props.node.external ? (
                <NTag size='small' type='warning' style={{ marginLeft: '8px' }}>
                  {t('project.workflow.relation_external_short', {
                    project:
                      props.node.projectName ||
                      t('project.workflow.relation_external_project')
                  })}
                </NTag>
              ) : null}</div>
              <div class={styles.impactMeta}>
                {t('project.workflow.relation_impact_summary', {
                  up: props.impactUpstream.length,
                  down: props.impactDownstream.length
                })}
              </div>
            </div>
            <div class={styles.detailSection}>
              <h4>
                {t('project.workflow.relation_upstream')} (
                {props.impactUpstream.length})
              </h4>
              <div class={styles.linkList}>
                {props.impactUpstream.length === 0 && (
                  <div class={styles.empty}>{t('project.workflow.relation_none')}</div>
                )}
                {props.impactUpstream.map((n) => (
                  <div
                    class={styles.linkItem}
                    onClick={() => emit('select', n.id)}
                  >
                    {rowLabel(n)}
                  </div>
                ))}
              </div>
            </div>
            <div class={styles.detailSection}>
              <h4>
                {t('project.workflow.relation_downstream')} (
                {props.impactDownstream.length})
              </h4>
              <div class={styles.linkList}>
                {props.impactDownstream.length === 0 && (
                  <div class={styles.empty}>{t('project.workflow.relation_none')}</div>
                )}
                {props.impactDownstream.map((n) => (
                  <div
                    class={styles.linkItem}
                    onClick={() => emit('select', n.id)}
                  >
                    {rowLabel(n)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      }

      return (
        <div>
          <div class={styles.detailSection}>
            <h4>{t('project.workflow.relation_basic')}</h4>
            <div class={styles.metaRow}>
              <span>{t('project.workflow.workflow_name')}</span>
              <span>{props.node.name}</span>
            </div>
            <div class={styles.metaRow}>
              <span>Code</span>
              <span>{props.node.id}</span>
            </div>
            <div class={styles.metaRow}>
              <span>{t('project.workflow.relation_level')}</span>
              <span>
                <NTag size='small' type='info'>
                  L{props.node.topoLevel ?? 0}
                </NTag>
              </span>
            </div>
            <div class={styles.metaRow}>
              <span>{t('project.workflow.relation_biz_group')}</span>
              <span>
                <NTag
                  size='small'
                  style={{
                    background: `${props.node.bizGroupColor || '#64748b'}22`,
                    color: props.node.bizGroupColor || '#64748b',
                    border: `1px solid ${props.node.bizGroupColor || '#64748b'}55`
                  }}
                >
                  {props.node.bizGroup || props.node.prefix || '—'}
                </NTag>
              </span>
            </div>
            <div class={styles.metaRow}>
              <span>{t('project.workflow.crontab_expression')}</span>
              <span>{props.node.crontab || '—'}</span>
            </div>
            <div class={styles.metaRow}>
              <span>{t('project.workflow.workflow_publish_status')}</span>
              <span>{props.node.workFlowPublishStatus}</span>
            </div>
            <div class={styles.metaRow}>
              <span>{t('project.workflow.schedule_publish_status')}</span>
              <span>{props.node.schedulePublishStatus}</span>
            </div>
          </div>

          <div class={styles.detailSection}>
            <h4>
              {t('project.workflow.relation_upstream')} ({props.upstream.length})
            </h4>
            <div class={styles.linkList}>
              {props.upstream.length === 0 && (
                <div class={styles.empty}>{t('project.workflow.relation_none')}</div>
              )}
              {props.upstream.map((n) => (
                <div class={styles.linkItem} onClick={() => emit('select', n.id)}>
                  {rowLabel(n)}
                </div>
              ))}
            </div>
          </div>

          <div class={styles.detailSection}>
            <h4>
              {t('project.workflow.relation_downstream')} ({props.downstream.length})
            </h4>
            <div class={styles.linkList}>
              {props.downstream.length === 0 && (
                <div class={styles.empty}>{t('project.workflow.relation_none')}</div>
              )}
              {props.downstream.map((n) => (
                <div class={styles.linkItem} onClick={() => emit('select', n.id)}>
                  {rowLabel(n)}
                </div>
              ))}
            </div>
          </div>

          <div class={styles.detailSection}>
            <h4>{t('project.workflow.relation_actions')}</h4>
            <NSpace vertical size={8} style='width:100%'>
              <NSpace>
                <NButton size='small' type='primary' onClick={goDefinition}>
                  {t('project.workflow.relation_goto_definition')}
                </NButton>
                <NButton size='small' onClick={goInstances}>
                  {t('project.workflow.relation_goto_instances')}
                </NButton>
              </NSpace>
              <NButton
                size='small'
                type='info'
                secondary
                block
                onClick={() => (panel.value = 'impact')}
              >
                {t('project.workflow.relation_goto_impact')}
              </NButton>
            </NSpace>
          </div>
        </div>
      )
    }
  }
})

export default DetailDrawer
