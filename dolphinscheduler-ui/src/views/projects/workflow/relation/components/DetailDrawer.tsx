import { defineComponent, PropType } from 'vue'
import { NButton, NSpace, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import type { RelationNode } from '../utils/layout'
import styles from '../styles/relation.module.scss'

const DetailDrawer = defineComponent({
  name: 'RelationDetailDrawer',
  props: {
    node: { type: Object as PropType<RelationNode | null>, default: null },
    upstream: { type: Array as PropType<RelationNode[]>, default: () => [] },
    downstream: { type: Array as PropType<RelationNode[]>, default: () => [] }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const router = useRouter()
    const route = useRoute()

    const goDefinition = () => {
      if (!props.node) return
      router.push({
        path: `/projects/${route.params.projectCode}/workflow/definitions/${props.node.id}`,
        query: { ...route.query }
      })
    }
    const goInstances = () => {
      if (!props.node) return
      router.push({
        path: `/projects/${route.params.projectCode}/workflow/instances`,
        query: {
          ...route.query,
          workflowDefinitionCode: String(props.node.id)
        }
      })
    }

    return () => (
      <div class={styles.panel}>
        <h3 class={styles.panelTitle}>{t('project.workflow.relation_detail')}</h3>
        {!props.node ? (
          <div class={styles.empty}>{t('project.workflow.relation_detail_empty')}</div>
        ) : (
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
                      background: props.node.bizGroupColor || '#64748b',
                      color: '#fff',
                      border: 'none'
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
                    [L{n.topoLevel ?? '?'} · {n.bizGroup || n.prefix}] {n.name}
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
                    [L{n.topoLevel ?? '?'} · {n.bizGroup || n.prefix}] {n.name}
                  </div>
                ))}
              </div>
            </div>

            <div class={styles.detailSection}>
              <h4>{t('project.workflow.relation_actions')}</h4>
              <NSpace>
                <NButton size='small' type='primary' onClick={goDefinition}>
                  {t('project.workflow.relation_goto_definition')}
                </NButton>
                <NButton size='small' onClick={goInstances}>
                  {t('project.workflow.relation_goto_instances')}
                </NButton>
              </NSpace>
            </div>
          </div>
        )}
      </div>
    )
  }
})

export default DetailDrawer
