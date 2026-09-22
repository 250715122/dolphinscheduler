import { defineComponent, PropType, ref, watch, computed } from 'vue'
import {
  NModal,
  NCard,
  NSpace,
  NButton,
  NSelect,
  NAlert
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import {
  queryProjectPreferenceByProjectCode,
  updateProjectPreference
} from '@/service/modules/projects-preference'
import type { WorkflowGroupOverrides } from '@/views/projects/workflow/common/workflow-group'

const BatchGroupModal = defineComponent({
  name: 'BatchGroupModal',
  props: {
    show: { type: Boolean as PropType<boolean>, default: false },
    projectCode: { type: Number as PropType<number>, required: true },
    codes: {
      type: Array as PropType<Array<string | number>>,
      default: () => []
    },
    groupOptions: {
      type: Array as PropType<Array<{ label: string; value: string }>>,
      default: () => []
    }
  },
  emits: ['update:show', 'success'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const groupName = ref<string | null>(null)
    const saving = ref(false)
    const options = ref<Array<{ label: string; value: string }>>([])

    watch(
      () => props.show,
      (v) => {
        if (v) {
          groupName.value = null
          options.value = [...props.groupOptions]
        }
      }
    )

    const selectOptions = computed(() => {
      const map = new Map<string, { label: string; value: string }>()
      ;[...options.value, ...props.groupOptions].forEach((o) => {
        if (o?.value) map.set(o.value, o)
      })
      return Array.from(map.values())
    })

    const close = () => emit('update:show', false)

    const onCreate = (val: string) => {
      const name = String(val || '').trim()
      const opt = { label: name, value: name }
      if (name && !options.value.find((o) => o.value === name)) {
        options.value = [...options.value, opt]
      }
      groupName.value = name || null
      return opt
    }

    const confirm = async () => {
      const name = String(groupName.value || '').trim()
      if (!name) {
        window.$message.warning(t('project.workflow.batch_group_required'))
        return
      }
      if (!props.codes.length) {
        window.$message.warning(t('project.workflow.batch_group_empty'))
        return
      }
      saving.value = true
      try {
        const result = await queryProjectPreferenceByProjectCode(
          props.projectCode
        )
        const pref =
          result?.preferences && typeof result.preferences === 'string'
            ? JSON.parse(result.preferences)
            : result?.preferences && typeof result.preferences === 'object'
              ? { ...result.preferences }
              : {}
        const overrides: WorkflowGroupOverrides = {
          ...(pref.workflowGroupOverrides || {})
        }
        props.codes.forEach((c) => {
          overrides[String(c)] = name
        })
        pref.workflowGroupOverrides = overrides
        await updateProjectPreference(
          {
            projectPreferences: JSON.stringify(pref),
            code: props.projectCode
          } as any,
          props.projectCode
        )
        window.$message.success(t('project.workflow.success'))
        emit('success')
        close()
      } catch (e: any) {
        window.$message.error(
          e?.message || t('project.workflow.request_failed')
        )
      } finally {
        saving.value = false
      }
    }

    return () => (
      <NModal
        show={props.show}
        onUpdateShow={(v: boolean) => emit('update:show', v)}
      >
        <NCard
          title={t('project.workflow.batch_group')}
          style={{ width: '480px' }}
          bordered={false}
          size='huge'
          role='dialog'
          aria-modal='true'
        >
          <NSpace vertical>
            <NAlert type='info' showIcon>
              {`${t('project.workflow.batch_group_tip')} (${props.codes.length})`}
            </NAlert>
            <NSelect
              filterable
              tag
              clearable
              placeholder={t('project.workflow.batch_group_placeholder')}
              options={selectOptions.value}
              value={groupName.value}
              onUpdateValue={(v: string | null) => (groupName.value = v)}
              onCreate={onCreate}
            />
            <NSpace justify='end'>
              <NButton onClick={close}>{t('project.workflow.cancel')}</NButton>
              <NButton
                type='primary'
                loading={saving.value}
                onClick={confirm}
              >
                {t('project.workflow.confirm')}
              </NButton>
            </NSpace>
          </NSpace>
        </NCard>
      </NModal>
    )
  }
})

export default BatchGroupModal
