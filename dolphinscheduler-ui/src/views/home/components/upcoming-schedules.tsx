import { defineComponent, PropType, h } from 'vue'
import { NDataTable, NPagination } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import styles from '../styles/dashboard.module.scss'
import { humanizeCrontab } from '../adapters/cron-humanize'
import type { ScheduleRow } from '../types/dashboard'

const UpcomingSchedules = defineComponent({
  name: 'OpsUpcomingSchedules',
  props: {
    rows: { type: Array as PropType<ScheduleRow[]>, default: () => [] },
    total: { type: Number as PropType<number>, default: 0 },
    page: { type: Number as PropType<number>, default: 1 },
    pageSize: { type: Number as PropType<number>, default: 6 }
  },
  emits: ['update:page'],
  setup(props, { emit }) {
    const { t } = useI18n()
    return () => (
      <div class={[styles.card, styles.fixedPanel]}>
        <div class={styles.panelHeader}>
          <div>
            <h3 class={styles.cardTitle}>{t('home.ops_upcoming')}</h3>
            <p class={styles.cardDesc}>{t('home.ops_upcoming_desc')}</p>
          </div>
        </div>
        <div class={styles.panelBody}>
          {props.rows.length === 0 ? (
            <div class={styles.emptyHint}>{t('home.ops_no_schedule')}</div>
          ) : (
            <div class={styles.tableFill}>
              <NDataTable
                size='small'
                single-line={true}
                flex-height={true}
                style='height: 100%'
                columns={[
                  {
                    title: t('home.ops_col_instance'),
                    key: 'name',
                    ellipsis: { tooltip: true },
                    render: (row: ScheduleRow) => {
                      const tip = row.crontab
                        ? `${row.name} · ${row.crontab}`
                        : row.name
                      return h(
                        'span',
                        { title: tip },
                        row.name
                      )
                    }
                  },
                  {
                    title: t('home.ops_col_project'),
                    key: 'projectName',
                    width: 110,
                    ellipsis: { tooltip: true }
                  },
                  {
                    title: t('home.ops_col_schedule_time'),
                    key: 'time',
                    width: 120,
                    render: (row: ScheduleRow) => {
                      const human = humanizeCrontab(row.crontab, t as any)
                      const tip = row.crontab
                        ? `${row.time} · ${human} · ${row.crontab}`
                        : `${row.time} · ${human}`
                      return h(
                        'span',
                        {
                          title: tip,
                          style:
                            'font-variant-numeric:tabular-nums;font-weight:600;color:var(--ops-primary)'
                        },
                        row.time
                      )
                    }
                  }
                ]}
                data={props.rows}
              />
            </div>
          )}
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

export default UpcomingSchedules
