import { defineComponent, PropType } from 'vue'
import {
  NButton,
  NCheckbox,
  NInput,
  NSelect,
  NSpace
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import styles from '../styles/relation.module.scss'

const FilterPanel = defineComponent({
  name: 'RelationFilterPanel',
  props: {
    keyword: { type: String as PropType<string>, default: '' },
    groups: { type: Array as PropType<string[]>, default: () => [] },
    availableGroups: { type: Array as PropType<string[]>, default: () => [] },
    status: { type: Array as PropType<string[]>, default: () => [] },
    depth: { type: Number as PropType<number>, default: 99 },
    onlyIsolated: { type: Boolean as PropType<boolean>, default: false }
  },
  emits: [
    'update:keyword',
    'update:groups',
    'update:status',
    'update:depth',
    'update:onlyIsolated',
    'collapse'
  ],
  setup(props, { emit }) {
    const { t } = useI18n()
    return () => (
      <div class={styles.filterBar}>
        <span class={styles.filterBarTitle}>
          {t('project.workflow.relation_filters')}
        </span>
        <NInput
          value={props.keyword}
          clearable
          size='small'
          style='width:160px'
          placeholder={t('project.workflow.workflow_name')}
          onUpdateValue={(v) => emit('update:keyword', v)}
        />
        {props.availableGroups.length > 0 ? (
          <NSelect
            size='small'
            multiple
            maxTagCount={1}
            style='min-width:140px;max-width:220px'
            placeholder={t('project.workflow.relation_biz_group')}
            value={props.groups}
            options={props.availableGroups.map((g) => ({ label: g, value: g }))}
            onUpdateValue={(v: string[]) => emit('update:groups', v || [])}
          />
        ) : null}
        <NSelect
          size='small'
          multiple
          maxTagCount={1}
          style='min-width:140px;max-width:220px'
          placeholder={t('project.workflow.relation_publish_status')}
          value={props.status}
          options={[
            { label: t('project.workflow.online'), value: 'online' },
            {
              label: t('project.workflow.workflow_offline'),
              value: 'workflow_offline'
            },
            {
              label: t('project.workflow.schedule_offline'),
              value: 'schedule_offline'
            }
          ]}
          onUpdateValue={(v: string[]) => emit('update:status', v || [])}
        />
        <NSelect
          size='small'
          style='width:140px'
          value={props.depth}
          options={[
            { label: t('project.workflow.relation_depth_self'), value: 0 },
            { label: t('project.workflow.relation_depth_1'), value: 1 },
            { label: t('project.workflow.relation_depth_2'), value: 2 },
            { label: t('project.workflow.relation_depth_3'), value: 3 },
            { label: t('project.workflow.relation_depth_all'), value: 99 }
          ]}
          onUpdateValue={(v) => emit('update:depth', v)}
        />
        <NCheckbox
          checked={props.onlyIsolated}
          onUpdateChecked={(v) => emit('update:onlyIsolated', v)}
        >
          {t('project.workflow.relation_only_isolated')}
        </NCheckbox>
        <NButton size='small' quaternary onClick={() => emit('collapse')}>
          {t('project.workflow.relation_filter_collapse')}
        </NButton>
      </div>
    )
  }
})

export default FilterPanel
