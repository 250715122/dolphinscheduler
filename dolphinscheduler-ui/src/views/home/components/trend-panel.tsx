
import { defineComponent, PropType, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { NButton, NSpace } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import * as echarts from 'echarts'
import styles from '../styles/dashboard.module.scss'
import type { TrendMode, TrendPoint } from '../types/dashboard'

const TrendPanel = defineComponent({
  name: 'OpsTrendPanel',
  props: {
    points: { type: Array as PropType<TrendPoint[]>, default: () => [] },
    mode: { type: String as PropType<TrendMode>, default: 'task' },
    mini: { type: Boolean as PropType<boolean>, default: false }
  },
  emits: ['update:mode'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const elRef = ref<HTMLDivElement | null>(null)
    let chart: echarts.ECharts | null = null

    const render = () => {
      if (!elRef.value) return
      if (!chart) chart = echarts.init(elRef.value)
      const x = props.points.map((p) => p.date)
      const y =
        props.mode === 'task'
          ? props.points.map((p) => p.taskCount)
          : props.points.map((p) => p.workflowCount)
      const name =
        props.mode === 'task'
          ? t('home.ops_metric_task_count')
          : t('home.ops_trend_workflow_instances')
      const mini = props.mini
      chart.setOption({
        color: ['#2563eb'],
        grid: mini
          ? { left: 28, right: 8, top: 8, bottom: 18 }
          : { left: 48, right: 20, top: 16, bottom: 28 },
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: x,
          boundaryGap: false,
          axisLabel: {
            color: '#667085',
            fontSize: mini ? 9 : 11,
            interval: mini ? 'auto' : 0,
            hideOverlap: true
          },
          axisTick: { show: !mini },
          axisLine: { lineStyle: { color: '#e5eaf2' } }
        },
        yAxis: {
          type: 'value',
          minInterval: 1,
          axisLabel: {
            color: '#667085',
            fontSize: mini ? 9 : 11,
            show: !mini
          },
          splitLine: {
            show: !mini,
            lineStyle: { color: '#e5eaf2' }
          },
          splitNumber: mini ? 2 : 5
        },
        series: [
          {
            name,
            type: 'line',
            smooth: true,
            showSymbol: false,
            lineStyle: { width: mini ? 1.5 : 2 },
            areaStyle: { color: 'rgba(37,99,235,0.12)' },
            data: y
          }
        ]
      })
      chart.resize()
    }

    const onResize = () => chart?.resize()

    onMounted(() => {
      render()
      window.addEventListener('resize', onResize)
    })
    onBeforeUnmount(() => {
      window.removeEventListener('resize', onResize)
      chart?.dispose()
      chart = null
    })
    watch(
      () => [props.points, props.mode, props.mini],
      () => render(),
      { deep: true }
    )

    return () => (
      <div
        class={[
          styles.card,
          props.mini ? styles.trendMiniCard : styles.equalCard
        ]}
      >
        <div class={styles.cardHeaderRow} style={props.mini ? 'margin-bottom:2px' : undefined}>
          <div class={styles.trendMiniTitle}>
            {t('home.ops_trend_month')}
          </div>
          <NSpace size={4}>
            <NButton
              size={props.mini ? 'tiny' : 'small'}
              type={props.mode === 'task' ? 'primary' : 'default'}
              secondary={props.mode !== 'task'}
              onClick={() => emit('update:mode', 'task')}
            >
              {props.mini ? t('home.ops_entity_task') : t('home.ops_metric_task_count')}
            </NButton>
            <NButton
              size={props.mini ? 'tiny' : 'small'}
              type={props.mode === 'workflow' ? 'primary' : 'default'}
              secondary={props.mode !== 'workflow'}
              onClick={() => emit('update:mode', 'workflow')}
            >
              {props.mini ? t('home.ops_entity_workflow') : t('home.ops_trend_workflow_instances')}
            </NButton>
          </NSpace>
        </div>
        <div
          ref={elRef}
          class={props.mini ? styles.chartMini : styles.chartFill}
        />
      </div>
    )
  }
})

export default TrendPanel
