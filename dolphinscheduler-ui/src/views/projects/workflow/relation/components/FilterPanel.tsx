import { defineComponent, PropType } from 'vue'
import { NCheckboxGroup, NCheckbox, NInput, NSelect, NSpace } from 'naive-ui'
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
    'update:onlyIsolated'
  ],
  setup(props, { emit }) {
    const { t } = useI18n()
    return () => (
      <div class={styles.panel}>
        <h3 class={styles.panelTitle}>{t('project.workflow.relation_filters')}</h3>
        <div class={styles.filterGroup}>
          <div class={styles.filterLabel}>{t('project.workflow.relation_search')}</div>
          <NInput
            value={props.keyword}
            clearable
            size='small'
            placeholder={t('project.workflow.workflow_name')}
            onUpdateValue={(v) => emit('update:keyword', v)}
          />
        </div>
        {props.availableGroups.length > 0 && (
          <div class={styles.filterGroup}>
            <div class={styles.filterLabel}>
              {t('project.workflow.relation_biz_group')}
            </div>
            <NCheckboxGroup
              value={props.groups}
              onUpdateValue={(v) => emit('update:groups', v)}
            >
              <NSpace vertical size={4}>
                {props.availableGroups.map((g) => (
                  <NCheckbox value={g} label={g} />
                ))}
              </NSpace>
            </NCheckboxGroup>
          </div>
        )}
        <div class={styles.filterGroup}>
          <div class={styles.filterLabel}>{t('project.workflow.relation_status')}</div>
          <NCheckboxGroup
            value={props.status}
            onUpdateValue={(v) => emit('update:status', v)}
          >
            <NSpace vertical size={4}>
              <NCheckbox value='online' label={t('project.workflow.online')} />
              <NCheckbox
                value='workflow_offline'
                label={t('project.workflow.workflow_offline')}
              />
              <NCheckbox
                value='schedule_offline'
                label={t('project.workflow.schedule_offline')}
              />
            </NSpace>
          </NCheckboxGroup>
        </div>
        <div class={styles.filterGroup}>
          <div class={styles.filterLabel}>{t('project.workflow.relation_depth')}</div>
          <NSelect
            size='small'
            value={props.depth}
            options={[
              { label: t('project.workflow.relation_depth_self'), value: 0 },
              { label: t('project.workflow.relation_depth_1'), value: 1 },
              { label: t('project.workflow.relation_depth_2'), value: 2 },
              { label: t('project.workflow.relation_depth_all'), value: 99 }
            ]}
            onUpdateValue={(v) => emit('update:depth', v)}
          />
        </div>
        <div class={styles.filterGroup}>
          <NCheckbox
            checked={props.onlyIsolated}
            onUpdateChecked={(v) => emit('update:onlyIsolated', v)}
          >
            {t('project.workflow.relation_only_isolated')}
          </NCheckbox>
        </div>
      </div>
    )
  }
})

export default FilterPanel
