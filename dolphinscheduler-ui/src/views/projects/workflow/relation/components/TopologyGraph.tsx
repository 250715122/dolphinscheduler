import {
  defineComponent,
  PropType,
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  getCurrentInstance,
  nextTick
} from 'vue'
import { useI18n } from 'vue-i18n'
import { prefixColor } from '../utils/group'
import type { RelationNode, RelationLink } from '../utils/layout'
import type { Ref } from 'vue'
import type { ECharts } from 'echarts'

/**
 * Manual echarts lifecycle (do NOT use @/components/chart initChart here).
 * initChart returns null and its onMounted must be registered from setup;
 * combined with reactive deep-watch dispose loops it left this view blank
 * while Timeline (plain DOM) worked fine.
 */
const TopologyGraph = defineComponent({
  name: 'RelationTopologyGraph',
  props: {
    nodes: { type: Array as PropType<RelationNode[]>, default: () => [] },
    links: { type: Array as PropType<RelationLink[]>, default: () => [] },
    selectedId: {
      type: [String, Number] as PropType<string | number | null>,
      default: null
    },
    highlightIds: { type: Array as PropType<string[]>, default: () => [] },
    labelShow: { type: Boolean as PropType<boolean>, default: true }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const domRef: Ref<HTMLDivElement | null> = ref(null)
    let chart: ECharts | null = null
    // Must capture during setup; getCurrentInstance() is null inside rAF/watch
    const echartsApi = (
      getCurrentInstance()?.appContext.config.globalProperties as any
    )?.echarts

    const statusCategory = (n: RelationNode) => {
      const wp = Number(n.workFlowPublishStatus)
      const sp = Number(n.schedulePublishStatus)
      if (wp === 0) return 1
      if (wp === 1 && sp === 0) return 2
      return 0
    }

    const buildOption = () => {
      const hl = new Set(props.highlightIds.map(String))
      const selected =
        props.selectedId != null ? String(props.selectedId) : null

      const data = (props.nodes || []).map((n: any) => {
        const id = String(n.id)
        const cat = statusCategory(n)
        const prefix = n.prefix || 'other'
        const bizGroup = n.bizGroup || prefix
        const bizColor = n.bizGroupColor || prefixColor(prefix)
        const level = n.topoLevel ?? 0
        const focused = !selected || hl.has(id) || id === selected
        const border =
          id === selected
            ? '#2563eb'
            : cat === 1
              ? '#f37373'
              : cat === 2
                ? '#ba3e3e'
                : bizColor

        // Prefer layered coordinates; force layout will refine if missing
        const x = Number(n.x)
        const y = Number(n.y)

        const nm = String(n.name || id)
        // Wider cards so names wrap inside instead of being clipped
        const cardW = Math.min(210, Math.max(132, Math.ceil(nm.length * 7.2)))
        const cardH = id === selected ? 58 : 52
        return {
          id,
          name: nm,
          category: cat,
          x: Number.isFinite(x) ? x : undefined,
          y: Number.isFinite(y) ? y : undefined,
          fixed: Number.isFinite(x) && Number.isFinite(y),
          topoLevel: level,
          prefix,
          bizGroup,
          bizGroupColor: bizColor,
          crontab: n.crontab || '-',
          workFlowPublishStatus: n.workFlowPublishStatus,
          schedulePublishStatus: n.schedulePublishStatus,
          symbolSize: [cardW, cardH],
          itemStyle: {
            color:
              cat === 1 ? '#f37373' : cat === 2 ? '#ba3e3e' : bizColor,
            borderColor: border,
            borderWidth: id === selected ? 3 : 1,
            opacity: focused ? 1 : 0.22
          },
          label: {
            show: props.labelShow,
            position: 'inside',
            color: '#fff',
            fontSize: 11,
            lineHeight: 15,
            width: cardW - 18,
            overflow: 'break',
            formatter: () => `L${level} · ${bizGroup}\n${nm}`
          }
        }
      })

      const links = (props.links || []).map((l) => {
        const s = String(l.source)
        const tg = String(l.target)
        const onPath =
          !selected ||
          (hl.has(s) && hl.has(tg)) ||
          s === selected ||
          tg === selected
        return {
          source: s,
          target: tg,
          lineStyle: {
            color: onPath && selected ? '#2563eb' : '#94a3b8',
            width: onPath && selected ? 2.5 : 2,
            opacity: onPath ? 0.95 : 0.2,
            curveness: 0.05
          }
        }
      })

      return {
        tooltip: {
          confine: true,
          formatter: (params: any) => {
            if (!params?.data?.name) return ''
            const d = params.data
            return `${t('project.workflow.workflow_name')}: ${d.name}<br/>
${t('project.workflow.relation_level')}: L${d.topoLevel ?? 0}<br/>
${t('project.workflow.relation_biz_group')}: ${d.bizGroup || d.prefix || '-'}<br/>
${t('project.workflow.crontab_expression')}: ${d.crontab || '-'}<br/>
${t('project.workflow.workflow_publish_status')}: ${d.workFlowPublishStatus}<br/>
${t('project.workflow.schedule_publish_status')}: ${d.schedulePublishStatus}`
          }
        },
        legend: {
          data: [
            t('project.workflow.online'),
            t('project.workflow.workflow_offline'),
            t('project.workflow.schedule_offline')
          ],
          bottom: 8
        },
        animationDuration: 400,
        series: [
          {
            type: 'graph',
            // force is the proven path in upstream Graph.tsx; layered x/y used as seeds
            layout: 'force',
            draggable: true,
            roam: true,
            force: {
              repulsion: 560,
              edgeLength: 200,
              gravity: 0.03,
              layoutAnimation: true
            },
            symbol: 'roundRect',
            categories: [
              { name: t('project.workflow.online') },
              { name: t('project.workflow.workflow_offline') },
              { name: t('project.workflow.schedule_offline') }
            ],
            edgeSymbol: ['circle', 'arrow'],
            edgeSymbolSize: [4, 10],
            data,
            links,
            lineStyle: { opacity: 0.9, width: 2, curveness: 0.05 },
            nodeScaleRatio: 0,
            zoom: 1
          }
        ]
      }
    }

    const ensureChart = () => {
      if (!domRef.value) return null
      const echarts = echartsApi
      if (!echarts) {
        console.error('[TopologyGraph] echarts not found on app globalProperties')
        return null
      }
      if (!chart) {
        const inst = echarts.init(domRef.value, 'macarons')
        inst.on('click', (params: any) => {
          if (params.dataType === 'node' && params.data?.id != null) {
            emit('select', params.data.id)
          }
        })
        chart = inst
      }
      return chart
    }

    const render = () => {
      const inst = ensureChart()
      if (!inst) return
      const option = buildOption()
      // false = merge; keep chart alive (avoid blank flashes)
      inst.setOption(option, { notMerge: true })
      nextTick(() => inst.resize())
    }

    const onResize = () => chart?.resize()

    onMounted(() => {
      // defer one frame so container has real size
      requestAnimationFrame(() => {
        render()
        window.addEventListener('resize', onResize)
      })
    })

    onBeforeUnmount(() => {
      window.removeEventListener('resize', onResize)
      chart?.dispose()
      chart = null
    })

    watch(
      () => [
        props.nodes,
        props.links,
        props.selectedId,
        props.highlightIds,
        props.labelShow
      ],
      () => render(),
      { deep: true }
    )

    return { domRef }
  },
  render() {
    const h =
      typeof window !== 'undefined' ? window.innerHeight - 260 : 560
    return (
      <div
        ref='domRef'
        style={{
          width: '100%',
          height: `${h}px`,
          minHeight: '520px',
          background: '#fff'
        }}
      />
    )
  }
})

export default TopologyGraph
