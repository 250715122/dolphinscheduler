import { defineComponent, PropType, computed, ref, watch } from 'vue'
import {
  NCollapse,
  NCollapseItem,
  NTag,
  NSpace,
  NButton,
  NEmpty,
  NCheckbox
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  resolveWorkflowGroup,
  type WorkflowGroupRule,
  type WorkflowGroupOverrides
} from '@/views/projects/workflow/common/workflow-group'

const GroupedList = defineComponent({
  name: 'WorkflowDefinitionGroupedList',
  props: {
    data: { type: Array as PropType<any[]>, default: () => [] },
    rules: {
      type: Array as PropType<WorkflowGroupRule[]>,
      default: () => []
    },
    overrides: {
      type: Object as PropType<WorkflowGroupOverrides>,
      default: () => ({})
    },
    groupFilter: { type: String as PropType<string | null>, default: null },
    checkedRowKeys: {
      type: Array as PropType<Array<string | number>>,
      default: () => []
    }
  },
  emits: ['update:checkedRowKeys'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const router = useRouter()
    const expanded = ref<string[]>([])
    const checkedSet = computed(
      () => new Set(props.checkedRowKeys.map((k) => String(k)))
    )

    const buckets = computed(() => {
      const map = new Map<string, { color: string; items: any[] }>()
      ;(props.data || []).forEach((row) => {
        const g = resolveWorkflowGroup(
          { name: row.name, description: row.description, code: row.code },
          props.rules,
          props.overrides
        )
        if (props.groupFilter && g.name !== props.groupFilter) return
        if (!map.has(g.name)) map.set(g.name, { color: g.color, items: [] })
        map.get(g.name)!.items.push({ ...row, _group: g })
      })
      const keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b))
      if (expanded.value.length === 0 && keys.length) {
        expanded.value = keys
      }
      return keys.map((k) => ({
        name: k,
        color: map.get(k)!.color,
        items: map.get(k)!.items
      }))
    })

    watch(
      () => buckets.value.map((b) => b.name).join(','),
      () => {
        const keys = buckets.value.map((b) => b.name)
        if (keys.length && !expanded.value.length) expanded.value = keys
      }
    )

    const openDetail = (code: number) => {
      const routeUrl = router.resolve({
        name: 'workflow-definition-detail',
        params: { code }
      })
      window.open(routeUrl.href, '_blank')
    }

    const toggleOne = (code: string | number, checked: boolean) => {
      const key = String(code)
      const next = new Set(checkedSet.value)
      if (checked) next.add(key)
      else next.delete(key)
      emit(
        'update:checkedRowKeys',
        Array.from(next).map((k) => {
          const n = Number(k)
          return Number.isFinite(n) && String(n) === k ? n : k
        })
      )
    }

    const toggleGroup = (items: any[], checked: boolean) => {
      const next = new Set(checkedSet.value)
      items.forEach((row) => {
        const key = String(row.code)
        if (checked) next.add(key)
        else next.delete(key)
      })
      emit(
        'update:checkedRowKeys',
        Array.from(next).map((k) => {
          const n = Number(k)
          return Number.isFinite(n) && String(n) === k ? n : k
        })
      )
    }

    const groupCheckState = (items: any[]) => {
      const total = items.length
      const n = items.filter((r) => checkedSet.value.has(String(r.code))).length
      return {
        checked: total > 0 && n === total,
        indeterminate: n > 0 && n < total
      }
    }

    return () => {
      if (!buckets.value.length) {
        return (
          <NEmpty
            description={t(
              'project.workflow.workflow_relation_no_data_result_title'
            )}
          />
        )
      }
      return (
        <NCollapse
          displayDirective='show'
          expandedNames={expanded.value}
          onUpdate:expandedNames={(v: string[]) => (expanded.value = v)}
        >
          {buckets.value.map((b) => {
            const gs = groupCheckState(b.items)
            return (
              <NCollapseItem
                key={b.name}
                name={b.name}
                title={`${b.name} (${b.items.length})`}
                v-slots={{
                  header: () => (
                    <NSpace align='center' size={8} onClick={(e: Event) => e.stopPropagation()}>
                      <NCheckbox
                        checked={gs.checked}
                        indeterminate={gs.indeterminate}
                        onUpdateChecked={(v: boolean) => toggleGroup(b.items, v)}
                      />
                      <NTag
                        size='small'
                        style={{
                          background: b.color,
                          color: '#fff',
                          border: 'none'
                        }}
                      >
                        {b.name}
                      </NTag>
                      <span style='color:#64748b;font-size:12px'>
                        {b.items.length}
                      </span>
                    </NSpace>
                  )
                }}
              >
                <div style='display:flex;flex-direction:column;gap:6px;padding:4px 0 8px'>
                  {b.items.map((row) => (
                    <div
                      key={row.code}
                      style='display:flex;align-items:center;gap:10px;padding:8px 10px;background:#f8fafc;border-radius:8px;border:1px solid #e5eaf2'
                    >
                      <NCheckbox
                        checked={checkedSet.value.has(String(row.code))}
                        onUpdateChecked={(v: boolean) =>
                          toggleOne(row.code, v)
                        }
                      />
                      <div style='flex:1;display:flex;flex-direction:column;gap:2px;min-width:0'>
                        <NButton
                          text
                          type='primary'
                          onClick={() => openDetail(row.code)}
                        >
                          {row.name}
                        </NButton>
                        <span style='font-size:11px;color:#94a3b8'>
                          {row._group?.source === 'manual'
                            ? t('project.workflow.group_source_manual')
                            : row._group?.source === 'rule'
                              ? t('project.workflow.group_source_rule')
                              : t('project.workflow.group_source_prefix')}
                          {row.userName ? ` · ${row.userName}` : ''}
                          {row.description
                            ? ` · ${String(row.description).slice(0, 60)}`
                            : ''}
                        </span>
                      </div>
                      <NSpace>
                        <NTag
                          size='small'
                          type={
                            row.releaseState === 'ONLINE'
                              ? 'success'
                              : 'warning'
                          }
                        >
                          {row.releaseState === 'ONLINE'
                            ? t('project.workflow.up_line')
                            : t('project.workflow.down_line')}
                        </NTag>
                        {row.scheduleReleaseState ? (
                          <NTag
                            size='small'
                            type={
                              row.scheduleReleaseState === 'ONLINE'
                                ? 'success'
                                : 'default'
                            }
                          >
                            {row.scheduleReleaseState === 'ONLINE'
                              ? t('project.workflow.time_up_line')
                              : t('project.workflow.time_down_line')}
                          </NTag>
                        ) : null}
                      </NSpace>
                    </div>
                  ))}
                </div>
              </NCollapseItem>
            )
          })}
        </NCollapse>
      )
    }
  }
})

export default GroupedList
