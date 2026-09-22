import { defineComponent, PropType, h } from 'vue'
import { NDataTable, NPagination, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import styles from '../styles/dashboard.module.scss'
import { GROUP_COLORS, type DisplayGroup } from '../adapters/status-groups'
import { formatDurationSec } from '../adapters/duration'
import type { InstanceRow } from '../types/dashboard'

const DurationRank = defineComponent({
  name: 'OpsDurationRank',
  props: {
    rows: { type: Array as PropType<InstanceRow[]>, default: () => [] },
    total: { type: Number as PropType<number>, default: 0 },
    page: { type: Number as PropType<number>, default: 1 },
    pageSize: { type: Number as PropType<number>, default: 8 },
    loading: { type: Boolean as PropType<boolean>, default: false }
  },
  emits: ['update:page', 'open'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const groupLabel = (g: DisplayGroup, raw: string) => {
      const key = `home.ops_group_${g}`
      const mapped = t(key)
      return mapped === key ? raw : mapped
    }

    return () => (
      <div class={[styles.card, styles.fixedPanel]}>
        <div class={styles.panelHeader}>
          <div>
            <h3 class={styles.cardTitle}>{t('home.ops_duration_rank')}</h3>
            <p class={styles.cardDesc}>{t('home.ops_duration_rank_desc')}</p>
          </div>
        </div>
        <div class={styles.panelBody}>
          <div class={styles.tableFill}>
            <NDataTable
              loading={props.loading}
              size='small'
              single-line={true}
              flex-height={true}
              style='height: 100%'
              columns={[
                {
                  title: '#',
                  key: 'rank',
                  width: 44,
                  render: (_: any, index: number) =>
                    (props.page - 1) * props.pageSize + index + 1
                },
                {
                  title: t('home.ops_col_instance'),
                  key: 'name',
                  ellipsis: { tooltip: true },
                  render: (row: InstanceRow) =>
                    h(
                      'a',
                      {
                        class: styles.linkBtn,
                        onClick: () => emit('open', row)
                      },
                      row.name
                    )
                },
                {
                  title: t('home.ops_col_project'),
                  key: 'projectName',
                  width: 100,
                  ellipsis: { tooltip: true }
                },
                {
                  title: t('home.ops_col_duration'),
                  key: 'duration',
                  width: 90,
                  render: (row: InstanceRow) =>
                    row.duration || formatDurationSec(row.durationSec || 0)
                },
                {
                  title: t('home.ops_col_state'),
                  key: 'state',
                  width: 72,
                  render: (row: InstanceRow) =>
                    h(
                      NTag,
                      {
                        size: 'small',
                        bordered: false,
                        color: {
                          color: `${GROUP_COLORS[row.group]}18`,
                          textColor: GROUP_COLORS[row.group]
                        }
                      },
                      { default: () => groupLabel(row.group, row.state) }
                    )
                }
              ]}
              data={props.rows}
            />
          </div>
        </div>
        <div class={styles.panelFooter}>
          <span class={styles.panelMeta}>
            {t('home.ops_showing', {
              shown: props.rows.length,
              total: props.total
            })}
          </span>
          <NPagination
            size='small'
            page={props.page}
            pageSize={props.pageSize}
            itemCount={props.total}
            onUpdatePage={(p: number) => emit('update:page', p)}
          />
        </div>
      </div>
    )
  }
})

export default DurationRank
