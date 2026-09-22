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
    },
    compact: {
      type: Boolean as PropType<boolean>,
      default: false
    }
  },
  emits: ['open'],
  setup(props, { emit }) {
    const { t } = useI18n()
    return () => {
      if (props.compact) {
        const ok =
          props.model.databaseOk !== false &&
          (props.model.masterOnline == null || props.model.masterOnline > 0) &&
          (props.model.workerOnline == null || props.model.workerOnline > 0)
        const bad = props.model.databaseOk === false
        const label = bad
          ? t('home.ops_service_bad_short')
          : ok
            ? t('home.ops_service_ok_short')
            : t('home.ops_service')
        const tip = `M ${props.model.masterOnline ?? '—'} · W ${
          props.model.workerOnline ?? '—'
        } · DB ${
          props.model.databaseOk == null
            ? '—'
            : props.model.databaseOk
              ? t('home.ops_db_ok')
              : t('home.ops_db_bad')
        }${props.model.error ? ` · ${props.model.error}` : ''}`
        return (
          <span
            class={styles.serviceInline}
            title={tip}
            style='cursor:pointer'
            onClick={() => emit('open')}
          >
            <span
              class={[
                styles.statusDot,
                bad
                  ? styles.serviceDotBad
                  : ok
                    ? styles.serviceDotOk
                    : styles.serviceDotUnknown
              ]}
            />
            <span>{label}</span>
          </span>
        )
      }
      return (
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
  }
})

export default ServiceSummary
