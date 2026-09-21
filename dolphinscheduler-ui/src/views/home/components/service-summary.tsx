
import { defineComponent, PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import styles from '../styles/dashboard.module.scss'
import type { ServiceSummaryModel } from '../types/dashboard'

const ServiceSummary = defineComponent({
  name: 'OpsServiceSummary',
  props: {
    model: {
      type: Object as PropType<ServiceSummaryModel>,
      required: true
    }
  },
  emits: ['open'],
  setup(props, { emit }) {
    const { t } = useI18n()
    return () => (
      <div class={styles.card} style='min-height: 116px'>
        <h3 class={styles.cardTitle}>{t('home.ops_service')}</h3>
        <p class={styles.cardDesc}>{t('home.ops_service_desc')}</p>
        {props.model.error ? (
          <div class={styles.emptyHint}>{props.model.error}</div>
        ) : (
          <div>
            <div class={styles.serviceRow}>
              <span>Master</span>
              <span>
                {t('home.ops_online')} {props.model.masterOnline ?? '—'}
              </span>
            </div>
            <div class={styles.serviceRow}>
              <span>Worker</span>
              <span>
                {t('home.ops_online')} {props.model.workerOnline ?? '—'}
              </span>
            </div>
            <div class={styles.serviceRow}>
              <span>{t('home.ops_metadb')}</span>
              <span>
                {props.model.databaseOk == null
                  ? '—'
                  : props.model.databaseOk
                    ? t('home.ops_db_ok')
                    : t('home.ops_db_bad')}
              </span>
            </div>
            <div style='margin-top:8px'>
              <a class={styles.linkBtn} onClick={() => emit('open')}>
                {t('home.ops_goto_monitor')}
              </a>
            </div>
          </div>
        )}
      </div>
    )
  }
})

export default ServiceSummary
