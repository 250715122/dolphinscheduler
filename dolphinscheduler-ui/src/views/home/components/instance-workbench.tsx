
import { defineComponent, PropType, h } from 'vue'
import { NButton, NDataTable, NInput, NSpace, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import styles from '../styles/dashboard.module.scss'
import { GROUP_COLORS, type DisplayGroup } from '../adapters/status-groups'
import type { InstanceRow, WorkbenchTab } from '../types/dashboard'

const TAB_KEYS: WorkbenchTab[] = ['failure', 'running', 'waiting', 'all']

const InstanceWorkbench = defineComponent({
  name: 'OpsInstanceWorkbench',
  props: {
    tab: { type: String as PropType<WorkbenchTab>, required: true },
    counts: {
      type: Object as PropType<Record<string, number>>,
      default: () => ({})
    },
    rows: { type: Array as PropType<InstanceRow[]>, default: () => [] },
    total: { type: Number as PropType<number>, default: 0 },
    loading: { type: Boolean as PropType<boolean>, default: false },
    keyword: { type: String as PropType<string>, default: '' },
    scopeHint: { type: String as PropType<string>, default: '' },
    entityLabel: { type: String as PropType<string>, default: '' }
  },
  emits: ['update:tab', 'update:keyword', 'open'],
  setup(props, { emit }) {
    const { t } = useI18n()

    const groupLabel = (g: DisplayGroup, raw: string) => {
      const key = `home.ops_group_${g}`
      const mapped = t(key)
      return mapped === key ? raw : mapped
    }

    return () => (
      <div class={styles.card} style='min-height: 340px'>
        <div style='display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px;flex-wrap:wrap;'>
          <div>
            <h3 class={styles.cardTitle}>{t('home.ops_workbench')}</h3>
            <p class={styles.cardDesc}>{props.scopeHint}</p>
          </div>
          <NInput
            value={props.keyword}
            size='small'
            clearable
            style='width: 220px'
            placeholder={t('home.ops_search_instance')}
            onUpdateValue={(v: string) => emit('update:keyword', v)}
          />
        </div>
        <NSpace style='margin-bottom: 12px'>
          {TAB_KEYS.map((key) => (
            <NButton
              size='small'
              type={props.tab === key ? 'primary' : 'default'}
              secondary={props.tab !== key}
              onClick={() => emit('update:tab', key)}
            >
              {t(`home.ops_tab_${key}`)}
              {props.counts[key] != null ? ` ${props.counts[key]}` : ''}
            </NButton>
          ))}
        </NSpace>
        <NDataTable
          loading={props.loading}
          size='small'
          single-line={false}
          columns={[
            {
              title: props.entityLabel || t('home.ops_col_instance'),
              key: 'name',
              ellipsis: { tooltip: true },
              render: (row: InstanceRow) =>
                h('div', [
                  h(
                    'a',
                    {
                      class: styles.linkBtn,
                      style: 'font-size:13px;font-weight:500',
                      onClick: () => emit('open', row)
                    },
                    row.name
                  ),
                  h(
                    'div',
                    { style: 'color:var(--ops-text-muted);font-size:12px' },
                    `ID ${row.id}`
                  )
                ])
            },
            {
              title: t('home.ops_col_project'),
              key: 'projectName',
              width: 120,
              ellipsis: { tooltip: true }
            },
            {
              title: t('home.ops_col_state'),
              key: 'state',
              width: 110,
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
              title: t('home.ops_col_duration'),
              key: 'duration',
              width: 120,
              render: (row: InstanceRow) =>
                row.duration || row.endTime || row.startTime || '—'
            },
            {
              title: t('home.ops_col_action'),
              key: 'action',
              width: 90,
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
        <div
          style='margin-top:10px;display:flex;justify-content:space-between;color:var(--ops-text-muted);font-size:12px'
        >
          <span>
            {t('home.ops_showing', {
              shown: props.rows.length,
              total: props.total
            })}
          </span>
        </div>
      </div>
    )
  }
})

export default InstanceWorkbench
