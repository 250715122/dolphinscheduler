
import { defineComponent, PropType } from 'vue'
import styles from '../styles/dashboard.module.scss'
import type { MetricCardModel } from '../types/dashboard'

const MetricCard = defineComponent({
  name: 'OpsMetricCard',
  props: {
    model: {
      type: Object as PropType<MetricCardModel>,
      required: true
    },
    active: {
      type: Boolean as PropType<boolean>,
      default: false
    }
  },
  emits: ['click'],
  setup(props, { emit }) {
    return () => {
      const toneClass =
        props.model.tone === 'danger'
          ? styles.metricValueDanger
          : props.model.tone === 'success'
            ? styles.metricValueSuccess
            : props.model.tone === 'warning'
              ? styles.metricValueWarning
              : props.model.tone === 'primary'
                ? styles.metricValuePrimary
                : ''
      return (
        <div
          class={[styles.metricCard, props.active ? styles.metricCardActive : null]}
          role='button'
          tabindex={0}
          onClick={() => emit('click', props.model)}
          onKeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              emit('click', props.model)
            }
          }}
        >
          <div class={styles.metricLabel}>
            <span>{props.model.label}</span>
          </div>
          <div class={[styles.metricValue, toneClass]}>{props.model.value}</div>
          <div class={styles.metricHint}>{props.model.hint}</div>
        </div>
      )
    }
  }
})

export default MetricCard
