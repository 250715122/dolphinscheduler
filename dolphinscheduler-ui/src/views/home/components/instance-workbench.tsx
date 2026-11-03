import {
  computed,
  defineComponent,
  PropType,
  h,
  onBeforeUnmount,
  ref
} from 'vue'
import { useRouter } from 'vue-router'
import {
  NAutoComplete,
  NButton,
  NDataTable,
  NPagination,
  NTag
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { axios } from '@/service/service'
import styles from '../styles/dashboard.module.scss'
import { GROUP_COLORS, type DisplayGroup } from '../adapters/status-groups'
import type { InstanceRow, WorkbenchTab } from '../types/dashboard'

interface TaskHit {
  taskCode: string
  taskName: string
  taskType: string
  workflowCode: string
  workflowName: string
  projectCode: string
  projectName: string
}

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
    const router = useRouter()

    const groupLabel = (g: DisplayGroup, raw: string) => {
      const key = `home.ops_group_${g}`
      const mapped = t(key)
      return mapped === key ? raw : mapped
    }

    // ---- global task search (task definitions, across authorized projects) ----
    const hits = ref<TaskHit[]>([])
    const searching = ref(false)
    let timer: ReturnType<typeof setTimeout> | undefined
    let seq = 0

    const searchTasks = (kw: string) => {
      clearTimeout(timer)
      const key = kw.trim()
      if (key.length < 2) {
        hits.value = []
        searching.value = false
        return
      }
      searching.value = true
      timer = setTimeout(async () => {
        const mine = ++seq
        try {
          const res = (await axios({
            url: '/task-search',
            method: 'get',
            params: { keyword: key, limit: 20 }
          })) as unknown as TaskHit[]
          // drop out-of-order responses
          if (mine === seq) hits.value = res || []
        } catch (e) {
          if (mine === seq) hits.value = []
        } finally {
          if (mine === seq) searching.value = false
        }
      }, 250)
    }
    onBeforeUnmount(() => clearTimeout(timer))

    const gotoTask = (hit: TaskHit) => {
      router.push({
        path: `/projects/${hit.projectCode}/workflow/definitions/${hit.workflowCode}`,
        query: { projectName: hit.projectName, taskCode: hit.taskCode }
      })
    }

    const options = computed(() =>
      hits.value.map((hit) => ({
        label: hit.taskName,
        // unique per task+workflow so a task name reused in several workflows stays selectable
        value: `${hit.workflowCode}:${hit.taskCode}`,
        hit
      }))
    )

    const renderOption = (info: { node: any; option: any }) => {
      const hit: TaskHit = info.option.hit
      return h(
        'div',
        {
          style:
            'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 12px;cursor:default',
          onMousedown: (e: MouseEvent) => e.preventDefault()
        },
        [
          h('div', { style: 'min-width:0;flex:1' }, [
            h(
              'div',
              {
                style:
                  'font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
              },
              hit.taskName
            ),
            h(
              'div',
              {
                style:
                  'font-size:12px;opacity:.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
              },
              `${hit.projectName} / ${hit.workflowName}`
            )
          ]),
          h(
            'a',
            {
              class: styles.linkBtn,
              style: 'font-size:13px;flex:none',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                gotoTask(hit)
              }
            },
            t('home.ops_goto')
          )
        ]
      )
    }

    return () => (
      <div class={[styles.card, styles.fixedPanel]}>
        <div class={styles.panelHeader}>
          <div>
            <h3 class={styles.cardTitle}>{t('home.ops_workbench')}</h3>
            <p class={styles.cardDesc}>{props.scopeHint}</p>
          </div>
          <NAutoComplete
            value={props.keyword}
            size='small'
            clearable
            style='width: 300px'
            options={options.value}
            loading={searching.value}
            blur-after-select={false}
            // the dropdown is only a task finder; picking a row must not rewrite the keyword
            onSelect={() => undefined}
            renderOption={renderOption as any}
            placeholder={t('home.ops_search_instance')}
            onUpdateValue={(v: string) => {
              emit('update:keyword', v)
              searchTasks(v || '')
            }}
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
