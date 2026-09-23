import {
  defineComponent,
  PropType,
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick
} from 'vue'
import { useI18n } from 'vue-i18n'
import { Graph } from '@antv/x6'
import { pastelOf, prefixColor, statusAccent } from '../utils/group'
import { crontabToDayWindow } from '../utils/schedule'
import type { RelationNode, RelationLink } from '../utils/layout'

const NODE_W = 228
const NODE_H = 96
const NODE_NAME = 'relation-card-v2'
const EDGE_NAME = 'relation-edge-v2'

function ensureRegistry() {
  try {
    Graph.unregisterNode(NODE_NAME)
  } catch {
    /* ignore */
  }
  try {
    Graph.unregisterEdge(EDGE_NAME)
  } catch {
    /* ignore */
  }
  Graph.registerNode(NODE_NAME, {
    inherit: 'rect',
    width: NODE_W,
    height: NODE_H,
    attrs: {
      body: {
        rx: 8,
        ry: 8,
        strokeWidth: 2,
        fill: '#fff',
        stroke: '#16a34a'
      },
      label: {
        fill: '#17233d',
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 18,
        textWrap: {
          width: NODE_W - 28,
          height: NODE_H - 22,
          ellipsis: true,
          breakWord: true
        },
        refX: 0.5,
        refY: 0.5,
        textAnchor: 'middle',
        textVerticalAnchor: 'middle'
      }
    },
    ports: {
      groups: {
        in: {
          position: { name: 'left' },
          attrs: {
            circle: { r: 0, magnet: false, strokeWidth: 0, fill: 'transparent' }
          }
        },
        out: {
          position: { name: 'right' },
          attrs: {
            circle: { r: 0, magnet: false, strokeWidth: 0, fill: 'transparent' }
          }
        }
      },
      items: [
        { id: 'in', group: 'in' },
        { id: 'out', group: 'out' }
      ]
    }
  })
  Graph.registerEdge(EDGE_NAME, {
    inherit: 'edge',
    attrs: {
      line: {
        stroke: '#94a3b8',
        strokeWidth: 1.6,
        targetMarker: { name: 'block', width: 8, height: 6 }
      }
    },
    connector: { name: 'rounded', args: { radius: 10 } },
    router: { name: 'normal' }
  })
}

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
    labelShow: { type: Boolean as PropType<boolean>, default: true },
    fitToken: { type: Number as PropType<number>, default: 0 },
    darkTheme: { type: Boolean as PropType<boolean>, default: false }
  },
  emits: ['select', 'focus'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const domRef = ref<HTMLDivElement | null>(null)
    let graph: Graph | null = null
    let ro: ResizeObserver | null = null
    let fitTimer: number | null = null

    const statusCategory = (n: RelationNode) => {
      const wp = Number(n.workFlowPublishStatus)
      const sp = Number(n.schedulePublishStatus)
      if (wp === 0) return 1 as const
      if (wp === 1 && sp === 0) return 2 as const
      return 0 as const
    }

    const scheduleLabel = (n: RelationNode) => {
      const w = crontabToDayWindow(n.crontab)
      return w?.label || t('project.workflow.relation_timeline_no_cron')
    }

    const nodeLabel = (n: RelationNode) => {
      if (!props.labelShow) return ''
      const group = n.bizGroup || n.prefix || '—'
      const sched = scheduleLabel(n)
      const name = String(n.name || n.id)
      if (n.external) {
        const proj =
          n.projectName ||
          t('project.workflow.relation_external_project')
        return `${name}\n[${proj}]\n${group}  ·  L${n.topoLevel ?? 0}`
      }
      return `${name}\n${group}  ·  L${n.topoLevel ?? 0}\n●  ${sched}`
    }

    const fitView = () => {
      if (!graph || !props.nodes.length) return
      try {
        const w = domRef.value?.clientWidth || 0
        const h = domRef.value?.clientHeight || 0
        if (w < 40 || h < 40) return
        graph.resize(w, h)
        graph.zoomToFit({
          padding: 48,
          maxScale: 1.2,
          minScale: 0.3
        })
        graph.centerContent()
      } catch (e) {
        console.warn('[TopologyGraph] fitView failed', e)
      }
    }

    const scheduleFit = () => {
      if (fitTimer) window.clearTimeout(fitTimer)
      fitTimer = window.setTimeout(() => {
        fitView()
        fitTimer = null
      }, 50)
    }

    const renderGraph = () => {
      if (!graph) return
      const hl = new Set(props.highlightIds.map(String))
      const selected =
        props.selectedId != null ? String(props.selectedId) : null

      const cells: any[] = []
      ;(props.nodes || []).forEach((n: any) => {
        const id = String(n.id)
        const cat = statusCategory(n)
        const bizColor = n.bizGroupColor || prefixColor(n.prefix || 'other')
        const accent = statusAccent(cat)
        const focused = !selected || hl.has(id) || id === selected
        const x = Number(n.x)
        const y = Number(n.y)
        cells.push(
          graph!.createNode({
            id,
            shape: NODE_NAME,
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            width: NODE_W,
            height: NODE_H,
            label: nodeLabel(n),
            attrs: {
              body: {
                fill: n.external
                  ? props.darkTheme
                    ? 'rgba(148,163,184,0.12)'
                    : 'rgba(148,163,184,0.10)'
                  : pastelOf(bizColor),
                stroke: id === selected
                  ? '#2563eb'
                  : n.external
                    ? '#64748b'
                    : accent,
                strokeWidth: id === selected ? 2.5 : n.external ? 2 : 2,
                strokeDasharray: n.external ? '6 4' : undefined,
                opacity: focused ? 1 : 0.25
              },
              label: {
                fill: props.darkTheme ? '#e8eaed' : '#17233d',
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 20,
                textWrap: {
                  width: NODE_W - 28,
                  height: NODE_H - 22,
                  ellipsis: true,
                  breakWord: true
                }
              }
            },
            ports: {
              groups: {
                in: {
                  position: 'left',
                  attrs: {
                    circle: {
                      r: 0,
                      magnet: false,
                      strokeWidth: 0,
                      fill: 'transparent'
                    }
                  }
                },
                out: {
                  position: 'right',
                  attrs: {
                    circle: {
                      r: 0,
                      magnet: false,
                      strokeWidth: 0,
                      fill: 'transparent'
                    }
                  }
                }
              },
              items: [
                { id: 'in', group: 'in' },
                { id: 'out', group: 'out' }
              ]
            },
            zIndex: 2
          })
        )
      })

      const idSet = new Set((props.nodes || []).map((n) => String(n.id)))
      ;(props.links || []).forEach((l, idx) => {
        const s = String(l.source)
        const tg = String(l.target)
        if (!idSet.has(s) || !idSet.has(tg) || s === tg) return
        const onPath =
          !selected ||
          (hl.has(s) && hl.has(tg)) ||
          s === selected ||
          tg === selected
        const external = !!(l as any).external
        const edgeLabel = String((l as any).label || '').trim()
        cells.push(
          graph!.createEdge({
            id: `e-${s}-${tg}-${idx}`,
            shape: EDGE_NAME,
            source: { cell: s, port: 'out' },
            target: { cell: tg, port: 'in' },
            labels:
              external && edgeLabel && props.labelShow
                ? [
                    {
                      attrs: {
                        label: {
                          text: t('project.workflow.relation_external_edge', {
                            project: edgeLabel
                          }),
                          fill: '#64748b',
                          fontSize: 11,
                          fontWeight: 500
                        },
                        rect: {
                          fill: props.darkTheme ? '#1e293b' : '#f8fafc',
                          stroke: '#cbd5e1',
                          strokeWidth: 1,
                          rx: 4,
                          ry: 4
                        }
                      },
                      position: 0.5
                    }
                  ]
                : [],
            attrs: {
              line: {
                stroke: external
                  ? onPath && selected
                    ? '#6366f1'
                    : '#94a3b8'
                  : onPath && selected
                    ? '#2563eb'
                    : '#94a3b8',
                strokeWidth: onPath && selected ? 2.2 : 1.5,
                strokeOpacity: onPath ? 0.95 : 0.25,
                strokeDasharray: external ? '7 5' : undefined,
                targetMarker: { name: 'block', width: 8, height: 6 }
              }
            },
            zIndex: 1
          })
        )
      })

      graph.resetCells(cells)
      scheduleFit()
    }

    const ensureGraph = () => {
      if (!domRef.value) return null
      if (graph) return graph
      ensureRegistry()
      const w = Math.max(domRef.value.clientWidth, 320)
      const h = Math.max(domRef.value.clientHeight, 320)
      graph = new Graph({
        container: domRef.value,
        width: w,
        height: h,
        panning: true,
        mousewheel: {
          enabled: true,
          modifiers: [],
          factor: 1.08,
          maxScale: 2.2,
          minScale: 0.25
        },
        connecting: {
          connectionPoint: 'anchor',
          anchor: 'center'
        },
        interacting: {
          nodeMovable: true,
          edgeMovable: false,
          edgeLabelMovable: false
        },
        background: { color: props.darkTheme ? '#141418' : '#fafbfc' },
        grid: {
          size: 12,
          visible: true,
          type: 'dot',
          args: [{ color: props.darkTheme ? '#2a2a32' : '#e5eaf2', thickness: 1 }]
        }
      })
      graph.on('node:click', ({ node }) => emit('select', node.id))
      graph.on('node:dblclick', ({ node }) => emit('focus', node.id))
      return graph
    }

    const syncSizeAndRender = () => {
      if (!domRef.value) return
      const w = domRef.value.clientWidth
      const h = domRef.value.clientHeight
      if (w < 40 || h < 40) return
      if (!graph) ensureGraph()
      else graph.resize(w, h)
      renderGraph()
    }

    onMounted(() => {
      nextTick(() => {
        // wait layout: parent flex height may settle late
        const tryInit = (attempt = 0) => {
          const el = domRef.value
          if (!el) return
          if (el.clientWidth > 40 && el.clientHeight > 40) {
            syncSizeAndRender()
          } else if (attempt < 20) {
            window.setTimeout(() => tryInit(attempt + 1), 50)
          } else {
            // force min size then render
            el.style.minHeight = '480px'
            syncSizeAndRender()
          }
        }
        tryInit()
        if (domRef.value && typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(() => {
            if (!graph) syncSizeAndRender()
            else {
              const w = domRef.value!.clientWidth
              const h = domRef.value!.clientHeight
              if (w > 40 && h > 40) {
                graph.resize(w, h)
                scheduleFit()
              }
            }
          })
          ro.observe(domRef.value)
        }
      })
    })

    onBeforeUnmount(() => {
      if (fitTimer) window.clearTimeout(fitTimer)
      ro?.disconnect()
      ro = null
      graph?.dispose()
      graph = null
    })

    watch(
      () => [
        props.nodes,
        props.links,
        props.selectedId,
        props.highlightIds,
        props.labelShow
      ],
      () => {
        if (!graph) syncSizeAndRender()
        else renderGraph()
      },
      { deep: true }
    )

    watch(
      () => props.fitToken,
      () => scheduleFit()
    )

    watch(
      () => props.darkTheme,
      (dark) => {
        if (!graph) return
        graph.drawBackground({ color: dark ? '#141418' : '#fafbfc' })
        try {
          graph.drawGrid({
            type: 'mesh',
            args: [{ color: dark ? '#2a2a32' : '#e5eaf2', thickness: 1 }]
          })
        } catch {}
        renderGraph()
      }
    )

    return { domRef }
  },
  render() {
    return (
      <div
        ref='domRef'
        style={{
          width: '100%',
          height: '100%',
          minHeight: '480px',
          position: 'relative'
        }}
      />
    )
  }
})

export default TopologyGraph
