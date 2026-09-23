import { defineComponent, PropType, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RelationNode, RelationLink } from '../utils/layout'
import {
  crontabToDaySchedule,
  minutesToPct,
  type DayFire
} from '../utils/schedule'
import styles from '../styles/relation.module.scss'

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24]
/** below this count: draw each fire as a tick; above: draw a dense band */
const TICK_LIMIT = 48

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
        .map((n) => {
          const sched = crontabToDaySchedule(n.crontab)
          const fires: DayFire[] = sched?.fires || []
          const dimmed =
            selected != null &&
            !hl.has(String(n.id)) &&
            String(n.id) !== selected
          const firstMin = fires.length ? fires[0].startMin : null
          return {
            node: n,
            fires,
            cycle: sched?.cycle || 'unknown',
            summary:
              sched?.summary ||
              t('project.workflow.relation_timeline_no_cron'),
            hasCron: fires.length > 0,
            dimmed,
            firstMin,
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
          // scheduled first, earlier first; no-cron last
          if (a.hasCron !== b.hasCron) return a.hasCron ? -1 : 1
          const am = a.firstMin ?? 99999
          const bm = b.firstMin ?? 99999
          if (am !== bm) return am - bm
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

    const markerColor = (r: (typeof rows.value)[0]) => {
      const wp = Number(r.node.workFlowPublishStatus)
      const sp = Number(r.node.schedulePublishStatus)
      if (wp === 0) return '#94a3b8'
      if (sp === 0) return '#b45309'
      return String(r.node.bizGroupColor || '#64748b')
    }

    const bandStyle = (r: (typeof rows.value)[0]) => {
      if (!r.fires.length) return null
      const left = minutesToPct(r.fires[0].startMin)
      const right = minutesToPct(r.fires[r.fires.length - 1].startMin)
      const width = Math.max(2, right - left + 0.4)
      const selected = String(r.node.id) === String(props.selectedId)
      return {
        left: `${left}%`,
        width: `${width}%`,
        background: markerColor(r),
        boxShadow: selected ? '0 0 0 2px #2563eb' : undefined,
        opacity: r.dimmed ? 0.22 : 0.85
      }
    }

    const tickStyle = (r: (typeof rows.value)[0], fire: DayFire) => {
      const selected = String(r.node.id) === String(props.selectedId)
      return {
        left: `${minutesToPct(fire.startMin)}%`,
        ['--fire-color' as any]: markerColor(r),
        boxShadow: selected ? '0 0 0 2px #2563eb' : undefined,
        opacity: r.dimmed ? 0.22 : 1
      }
    }

    return () => (
      <div class={styles.timelineWrap}>
        <div class={styles.timelineHint}>
          {t('project.workflow.relation_timeline_hint')}
        </div>
        <div class={styles.timelineAxis}>
          <div class={styles.timelineAxisLabel}>
            {t('project.workflow.relation_timeline_axis')}
          </div>
          <div class={styles.timelineAxisTrack}>
            {HOURS.map((h) => (
              <span
                class={h === 24 ? styles.axisEnd : undefined}
                style={{ left: `${(h / 24) * 100}%` }}
              >
                {`${String(h).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          <div class={styles.timelineSummaryCol} />
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
                const useBand = r.fires.length > TICK_LIMIT
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
                      {!r.hasCron && (
                        <span class={styles.noCronHint}>
                          {t('project.workflow.relation_timeline_no_cron')}
                        </span>
                      )}
                      {r.hasCron && useBand && (
                        <div
                          class={[styles.bar, styles.barDense].join(' ')}
                          style={bandStyle(r) || undefined}
                          title={`${r.summary} · ${r.node.crontab || ''}`}
                        >
                          <span class={styles.barLabel}>{r.summary}</span>
                        </div>
                      )}
                      {r.hasCron &&
                        !useBand &&
                        r.fires.map((f) => (
                          <div
                            key={f.startMin}
                            class={styles.fireMark}
                            style={tickStyle(r, f)}
                            title={`${f.label} · ${r.summary}`}
                          >
                            <span class={styles.fireTime}>{f.label}</span>
                            <i class={styles.fireTick} />
                          </div>
                        ))}
                    </div>
                    <div
                      class={styles.timelineSummaryCol}
                      title={
                        r.hasCron && !useBand
                          ? r.fires.map((f) => f.label).join(', ')
                          : r.hasCron
                            ? `${r.summary} · ${r.node.crontab || ''}`
                            : undefined
                      }
                    >
                      {r.hasCron && !useBand ? (
                        <span class={styles.fireSummary}>{r.summary}</span>
                      ) : null}
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
