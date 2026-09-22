import { defineComponent, PropType } from 'vue'
import { NButton, NInput, NSpace, NDataTable, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { WorkflowGroupRule } from '@/views/projects/workflow/common/workflow-group'
import { DEFAULT_GROUP_RULES } from '@/views/projects/workflow/common/workflow-group'

const GroupRulesEditor = defineComponent({
  name: 'GroupRulesEditor',
  props: {
    value: {
      type: Array as PropType<WorkflowGroupRule[]>,
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

    const update = (next: WorkflowGroupRule[]) => {
      emit('update:value', next)
    }

    const addRow = () => {
      update([...(props.value || []), { group: '', pattern: '' }])
    }

    const removeRow = (idx: number) => {
      const next = [...(props.value || [])]
      next.splice(idx, 1)
      update(next)
    }

    const patch = (idx: number, key: 'group' | 'pattern', val: string) => {
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
          <NButton size='small' disabled={props.disabled} onClick={addRow}>
            {t('project.preference.group_rule_add')}
          </NButton>
          <NButton size='small' secondary disabled={props.disabled} onClick={loadDefaults}>
            {t('project.preference.group_rule_defaults')}
          </NButton>
        </NSpace>
        <NDataTable
          size='small'
          bordered
          singleLine={false}
          data={(props.value || []).map((r, index) => ({ ...r, index }))}
          columns={[
            {
              title: t('project.preference.group_name'),
              key: 'group',
              render: (row: any) => (
                <NInput
                  size='small'
                  value={row.group}
                  disabled={props.disabled}
                  placeholder='采集'
                  onUpdateValue={(v) => patch(row.index, 'group', v)}
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
