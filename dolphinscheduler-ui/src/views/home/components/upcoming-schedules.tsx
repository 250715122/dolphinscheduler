
import { defineComponent, PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import styles from '../styles/dashboard.module.scss'
import type { ScheduleRow } from '../types/dashboard'

const UpcomingSchedules = defineComponent({
  name: 'OpsUpcomingSchedules',
  props: {
    rows: { type: Array as PropType<ScheduleRow[]>, default: () => [] }
  },
  setup(props) {
    const { t } = useI18n()
    return () => (
      <div class={styles.card} style='min-height: 208px'>
        <h3 class={styles.cardTitle}>{t('home.ops_upcoming')}</h3>
        <p class={styles.cardDesc}>{t('home.ops_upcoming_desc')}</p>
        {props.rows.length === 0 ? (
          <div class={styles.emptyHint}>{t('home.ops_no_schedule')}</div>
        ) : (
          <div class={styles.asideStack}>
            {props.rows.map((row) => (
              <div class={styles.scheduleItem}>
                <div class={styles.scheduleTime}>{row.time}</div>
                <div>
                  <div class={styles.scheduleName}>{row.name}</div>
                  <div class={styles.scheduleMeta}>
                    {row.projectName}
                    {row.crontab ? ` · ${row.crontab}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
})

export default UpcomingSchedules
