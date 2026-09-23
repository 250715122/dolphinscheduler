import { defineComponent, PropType, computed } from 'vue'
import { NButton, NInput, NSpace, NDataTable, NTag, NSelect } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type {
  WorkflowBizGroup,
  WorkflowGroupRule
} from '@/views/projects/workflow/common/workflow-group'
import {
  DEFAULT_GROUP_RULES,
  groupColor
} from '@/views/projects/workflow/common/workflow-group'

const GroupRulesEditor = defineComponent({
  name: 'GroupRulesEditor',
  props: {
    value: {
      type: Array as PropType<WorkflowGroupRule[]>,
      default: () => []
    },
    groups: {
      type: Array as PropType<WorkflowBizGroup[]>,
      default: () => []
    },
    disabled: {
      type: Boolean as PropType<boolean>,
      default: false
    }
  },
  emits: ['update:value'],
  setup(props, { emit }) {
    const { t } = useI18n()

    const groupOptions = computed(() =>
      (props.groups || [])
        .filter((g) => String(g.name || '').trim())
        .map((g) => ({
          label: g.name,
          value: g.name
        }))
    )

    const update = (next: WorkflowGroupRule[]) => emit('update:value', next)

    const addRow = () => {
      const first = groupOptions.value[0]?.value || ''
      update([...(props.value || []), { group: first, pattern: '' }])
    }

    const removeRow = (idx: number) => {
      const next = [...(props.value || [])]
      next.splice(idx, 1)
      update(next)
    }

    const patch = (
      idx: number,
      key: 'group' | 'pattern',
      val: string
    ) => {
      const next = [...(props.value || [])].map((r, i) =>
        i === idx ? { ...r, [key]: val } : r
      )
      update(next)
    }

    const loadDefaults = () => {
      update(DEFAULT_GROUP_RULES.map((r) => ({ ...r })))
    }

    return () => (
      <div style='padding: 0 30px 20px'>
        <div style='margin-bottom: 8px; color: #667085; font-size: 13px'>
          {t('project.preference.group_rules_hint')}
        </div>
        <div style='margin-bottom: 10px; color: #94a3b8; font-size: 12px'>
          {t('project.preference.group_manual_hint')}
        </div>
        <NSpace style='margin-bottom: 10px'>
          <NButton
            size='small'
            disabled={props.disabled || groupOptions.value.length === 0}
            onClick={addRow}
          >
            {t('project.preference.group_rule_add')}
          </NButton>
          <NButton
            size='small'
            secondary
            disabled={props.disabled}
            onClick={loadDefaults}
          >
            {t('project.preference.group_rule_defaults')}
          </NButton>
        </NSpace>
        {groupOptions.value.length === 0 && (
          <div style='margin-bottom: 8px'>
            <NTag size='small' type='warning'>
              {t('project.preference.group_rules_need_catalog')}
            </NTag>
          </div>
        )}
        <NDataTable
          size='small'
          bordered
          singleLine={false}
          data={(props.value || []).map((r, index) => ({ ...r, index }))}
          columns={[
            {
              title: t('project.preference.group_color'),
              key: 'color',
              width: 56,
              render: (row: any) => (
                <span
                  style={{
                    display: 'inline-block',
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    background: groupColor(row.group || 'other', props.groups),
                    verticalAlign: 'middle'
                  }}
                />
              )
            },
            {
              title: t('project.preference.group_name'),
              key: 'group',
              width: 180,
              render: (row: any) => (
                <NSelect
                  size='small'
                  filterable
                  tag={false}
                  value={row.group || null}
                  options={groupOptions.value}
                  disabled={props.disabled}
                  placeholder={t('project.preference.group_name')}
                  onUpdateValue={(v: string) => patch(row.index, 'group', v || '')}
                />
              )
            },
            {
              title: t('project.preference.group_pattern'),
              key: 'pattern',
              render: (row: any) => (
                <NInput
                  size='small'
                  value={row.pattern}
                  disabled={props.disabled}
                  placeholder='^collect_'
                  onUpdateValue={(v) => patch(row.index, 'pattern', v)}
                />
              )
            },
            {
              title: '',
              key: 'actions',
              width: 80,
              render: (row: any) => (
                <NButton
                  size='tiny'
                  tertiary
                  type='error'
                  disabled={props.disabled}
                  onClick={() => removeRow(row.index)}
                >
                  {t('project.preference.group_rule_remove')}
                </NButton>
              )
            }
          ]}
        />
        {(props.value || []).length === 0 && (
          <div style='margin-top: 8px'>
            <NTag size='small' type='warning'>
              {t('project.preference.group_rules_empty')}
            </NTag>
          </div>
        )}
      </div>
    )
  }
})

export default GroupRulesEditor
