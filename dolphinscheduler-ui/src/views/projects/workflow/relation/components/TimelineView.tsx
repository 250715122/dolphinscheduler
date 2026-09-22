import { defineComponent, PropType, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RelationNode, RelationLink } from '../utils/layout'
import { crontabToDayWindow, minutesToPct } from '../utils/schedule'
import styles from '../styles/relation.module.scss'

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24]

const TimelineView = defineComponent({
  name: 'RelationTimelineView',
  props: {
    nodes: { type: Array as PropType<RelationNode[]>, default: () => [] },
    links: { type: Array as PropType<RelationLink[]>, default: () => [] },
    selectedId: {
      type: [String, Number] as PropType<string | number | null>,
      default: null
    },
    highlightIds: { type: Array as PropType<string[]>, default: () => [] }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const { t } = useI18n()

    const nameById = computed(() => {
      const m = new Map<string, string>()
      props.nodes.forEach((n) => m.set(String(n.id), n.name))
      return m
    })

    const upstreamMap = computed(() => {
      const m = new Map<string, string[]>()
      props.links.forEach((l) => {
        const tg = String(l.target)
        const s = String(l.source)
        if (!m.has(tg)) m.set(tg, [])
        m.get(tg)!.push(nameById.value.get(s) || s)
      })
      return m
    })

    const rows = computed(() => {
      const hl = new Set(props.highlightIds.map(String))
      const selected =
        props.selectedId != null ? String(props.selectedId) : null
      return [...props.nodes]
        .map((n, idx) => {
          const win = crontabToDayWindow(n.crontab)
          const fallbackStart =
            ((n.topoLevel ?? 0) * 100 + (idx % 5) * 25) % (22 * 60)
          const startMin = win?.startMin ?? fallbackStart
          const durationMin = win?.durationMin ?? 70
          const dimmed =
            selected != null &&
            !hl.has(String(n.id)) &&
            String(n.id) !== selected
          return {
            node: n,
            startMin,
            durationMin,
            endMin: Math.min(24 * 60, startMin + durationMin),
            cycle: win?.cycle || 'unknown',
            label: win?.label || t('project.workflow.relation_timeline_no_cron'),
            hasCron: !!win,
            dimmed,
            upstream: upstreamMap.value.get(String(n.id)) || []
          }
        })
        .sort((a, b) => {
          const ga = String(a.node.bizGroup || a.node.prefix || '')
          const gb = String(b.node.bizGroup || b.node.prefix || '')
          if (ga !== gb) return ga.localeCompare(gb)
          const la = a.node.topoLevel ?? 0
          const lb = b.node.topoLevel ?? 0
          if (la !== lb) return la - lb
          if (a.startMin !== b.startMin) return a.startMin - b.startMin
          return String(a.node.name).localeCompare(String(b.node.name))
        })
    })

    const sections = computed(() => {
      const list: Array<{
        group: string
        color: string
        rows: typeof rows.value
      }> = []
      let cur: (typeof list)[0] | null = null
      rows.value.forEach((r) => {
        const g = String(r.node.bizGroup || r.node.prefix || 'other')
        const color = String(r.node.bizGroupColor || '#64748b')
        if (!cur || cur.group !== g) {
          cur = { group: g, color, rows: [] }
          list.push(cur)
        }
        cur.rows.push(r)
      })
      return list
    })

    const barStyle = (r: (typeof rows.value)[0]) => {
      const left = minutesToPct(r.startMin)
      const width = Math.max(1.5, minutesToPct(r.endMin) - left)
      const wp = Number(r.node.workFlowPublishStatus)
      const sp = Number(r.node.schedulePublishStatus)
      let bg = String(r.node.bizGroupColor || '#64748b')
      if (wp === 0) bg = '#94a3b8'
      else if (sp === 0) bg = '#b45309'
      const selected = String(r.node.id) === String(props.selectedId)
      return {
        left: `${left}%`,
        width: `${width}%`,
        background: bg,
        boxShadow: selected ? '0 0 0 2px #2563eb' : undefined,
        opacity: r.dimmed ? 0.22 : r.hasCron ? 1 : 0.65
      }
    }

    return () => (
      <div class={styles.timelineWrap} onClick={(e: MouseEvent) => {
        if ((e.target as HTMLElement).classList?.contains(styles.timelineWrap) ||
            (e.target as HTMLElement).classList?.contains(styles.timelineBody)) {
          /* blank click handled by parent via toggle on same node */
        }
      }}>
        <div class={styles.timelineHint}>
          {t('project.workflow.relation_timeline_hint')}
        </div>
        <div class={styles.timelineAxis}>
          <div class={styles.timelineAxisLabel}>
            {t('project.workflow.relation_timeline_axis')}
          </div>
          <div class={styles.timelineAxisTrack}>
            {HOURS.map((h) => (
              <span style={{ left: `${(h / 24) * 100}%` }}>
                {`${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
        </div>
        <div class={styles.timelineBody}>
          {sections.value.map((sec) => (
            <div key={sec.group}>
              <div class={styles.groupHeader}>
                <i
                  class={styles.dot}
                  style={{ background: sec.color, marginRight: '6px' }}
                />
                <strong>{sec.group}</strong>
                <span style='color:#94a3b8;margin-left:6px;font-size:11px'>
                  ({sec.rows.length})
                </span>
              </div>
              {sec.rows.map((r) => {
                const selected = String(r.node.id) === String(props.selectedId)
                return (
                  <div
                    class={[
                      styles.timelineRow,
                      selected ? styles.timelineRowActive : ''
                    ].join(' ')}
                    onClick={() => emit('select', r.node.id)}
                  >
                    <div class={styles.timelineName} title={r.node.name}>
                      <span class={styles.levelBadge}>
                        L{r.node.topoLevel ?? 0}
                      </span>
                      <span class={styles.timelineWfName}>{r.node.name}</span>
                      {r.upstream.length > 0 && (
                        <span
                          class={styles.depHint}
                          title={r.upstream.join(' → ')}
                        >
                          ← {r.upstream.length}
                        </span>
                      )}
                    </div>
                    <div class={styles.barTrack}>
                      {HOURS.slice(1, -1).map((h) => (
                        <i
                          class={styles.gridLine}
                          style={{ left: `${(h / 24) * 100}%` }}
                        />
                      ))}
                      <div
                        class={styles.bar}
                        style={barStyle(r)}
                        title={`${r.label} · ${r.cycle}`}
                      >
                        <span class={styles.barLabel}>{r.label}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          {rows.value.length === 0 && (
            <div class={styles.empty}>
              {t('project.workflow.workflow_relation_no_data_result_title')}
            </div>
          )}
        </div>
      </div>
    )
  }
})

export default TimelineView
