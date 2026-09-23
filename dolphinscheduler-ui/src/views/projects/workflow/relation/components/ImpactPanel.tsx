import { defineComponent, PropType, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { neighbors, type RelationNode, type RelationLink } from '../utils/layout'
import styles from '../styles/relation.module.scss'

const ImpactPanel = defineComponent({
  name: 'RelationImpactPanel',
  props: {
    nodes: { type: Array as PropType<RelationNode[]>, default: () => [] },
    links: { type: Array as PropType<RelationLink[]>, default: () => [] },
    selectedId: {
      type: [String, Number] as PropType<string | number | null>,
      default: null
    }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const { t } = useI18n()

    const impact = computed(() => {
      if (props.selectedId == null) return null
      const id = String(props.selectedId)
      const { downstream } = neighbors(id, props.links, 99)
      const { upstream } = neighbors(id, props.links, 99)
      const downNodes = props.nodes.filter((n) => downstream.has(String(n.id)))
      const upNodes = props.nodes.filter((n) => upstream.has(String(n.id)))
      const self = props.nodes.find((n) => String(n.id) === id)
      return { self, downNodes, upNodes, downCount: downNodes.length, upCount: upNodes.length }
    })

    return () => {
      if (!impact.value) {
        return (
          <div class={styles.impactEmpty}>
            <div class={styles.empty}>{t('project.workflow.relation_impact_hint')}</div>
          </div>
        )
      }
      const { self, downNodes, upNodes, downCount, upCount } = impact.value
      return (
        <div class={styles.impactPanel}>
          <div class={styles.impactHero}>
            <div class={styles.impactTitle}>{self?.name || props.selectedId}</div>
            <div class={styles.impactMeta}>
              {t('project.workflow.relation_impact_summary', {
                up: upCount,
                down: downCount
              })}
            </div>
          </div>
          <div class={styles.impactCols}>
            <div>
              <h4>
                {t('project.workflow.relation_upstream')} ({upCount})
              </h4>
              <div class={styles.linkList}>
                {upNodes.length === 0 && (
                  <div class={styles.empty}>{t('project.workflow.relation_none')}</div>
                )}
                {upNodes.map((n) => (
                  <div class={styles.linkItem} onClick={() => emit('select', n.id)}>
                    [L{n.topoLevel ?? '?'}] {n.name}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4>
                {t('project.workflow.relation_downstream')} ({downCount})
              </h4>
              <div class={styles.linkList}>
                {downNodes.length === 0 && (
                  <div class={styles.empty}>{t('project.workflow.relation_none')}</div>
                )}
                {downNodes.map((n) => (
                  <div class={styles.linkItem} onClick={() => emit('select', n.id)}>
                    [L{n.topoLevel ?? '?'}] {n.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    }
  }
})

export default ImpactPanel
