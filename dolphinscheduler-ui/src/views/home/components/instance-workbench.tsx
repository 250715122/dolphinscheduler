import { defineComponent, PropType, h } from 'vue'
import { NButton, NDataTable, NInput, NPagination, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import styles from '../styles/dashboard.module.scss'
import { GROUP_COLORS, type DisplayGroup } from '../adapters/status-groups'
import type { InstanceRow, WorkbenchTab } from '../types/dashboard'

const InstanceWorkbench = defineComponent({
  name: 'OpsInstanceWorkbench',
  props: {
    tab: { type: String as PropType<WorkbenchTab>, required: true },
    rows: { type: Array as PropType<InstanceRow[]>, default: () => [] },
    total: { type: Number as PropType<number>, default: 0 },
    page: { type: Number as PropType<number>, default: 1 },
    pageSize: { type: Number as PropType<number>, default: 8 },
    loading: { type: Boolean as PropType<boolean>, default: false },
    keyword: { type: String as PropType<string>, default: '' },
    scopeHint: { type: String as PropType<string>, default: '' },
    entityLabel: { type: String as PropType<string>, default: '' }
  },
  emits: ['update:keyword', 'update:page', 'open'],
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
            <h3 class={styles.cardTitle}>{t('home.ops_workbench')}</h3>
            <p class={styles.cardDesc}>{props.scopeHint}</p>
          </div>
          <NInput
            value={props.keyword}
            size='small'
            clearable
            style='width: 200px'
            placeholder={t('home.ops_search_instance')}
            onUpdateValue={(v: string) => emit('update:keyword', v)}
          />
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
                  title: props.entityLabel || t('home.ops_col_instance'),
                  key: 'name',
                  ellipsis: { tooltip: true },
                  render: (row: InstanceRow) =>
                    h(
                      'a',
                      {
                        class: styles.linkBtn,
                        style: 'font-size:13px;font-weight:500',
                        title: `ID ${row.id}`,
                        onClick: () => emit('open', row)
                      },
                      row.name
                    )
                },
                {
                  title: t('home.ops_col_project'),
                  key: 'projectName',
                  width: 110,
                  ellipsis: { tooltip: true }
                },
                {
                  title: t('home.ops_col_state'),
                  key: 'state',
                  width: 90,
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
                },
                {
                  title: t('home.ops_col_time'),
                  key: 'startTime',
                  width: 150,
                  ellipsis: { tooltip: true },
                  render: (row: InstanceRow) => row.startTime || '—'
                },
                {
                  title: t('home.ops_col_duration'),
                  key: 'duration',
                  width: 90,
                  ellipsis: { tooltip: true },
                  render: (row: InstanceRow) => row.duration || '—'
                },
                {
                  title: t('home.ops_col_action'),
                  key: 'action',
                  width: 72,
                  render: (row: InstanceRow) =>
                    h(
                      NButton,
                      {
                        text: true,
                        type: 'primary',
                        size: 'small',
                        onClick: () => emit('open', row)
                      },
                      { default: () => t('home.ops_open_detail') }
                    )
                }
              ]}
              data={props.rows}
            />
          </div>
          {props.rows.length > 0 && props.rows.length <= 3 ? (
            <div class={styles.softStatus}>
              <div class={styles.softStatusStrong}>
                {t('home.ops_workbench_few', {
                  n: props.rows.length,
                  entity: props.entityLabel || t('home.ops_col_instance')
                })}
              </div>
              <div>{t('home.ops_workbench_ok')}</div>
            </div>
          ) : null}
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

export default InstanceWorkbench
