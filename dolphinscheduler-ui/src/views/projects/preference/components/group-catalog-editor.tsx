import { computed, defineComponent, PropType, ref } from 'vue'
import {
  NButton,
  NDataTable,
  NInput,
  NModal,
  NSpace,
  NTag
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { WorkflowBizGroup } from '@/views/projects/workflow/common/workflow-group'
import {
  BIZ_GROUP_COLORS,
  defaultBizGroups,
  groupColor,
  mergeBizGroupNames,
  newBizGroupId
} from '@/views/projects/workflow/common/workflow-group'

const GroupCatalogEditor = defineComponent({
  name: 'GroupCatalogEditor',
  props: {
    value: {
      type: Array as PropType<WorkflowBizGroup[]>,
      default: () => []
    },
    disabled: {
      type: Boolean as PropType<boolean>,
      default: false
    },
    suggestNames: {
      type: Array as PropType<string[]>,
      default: () => []
    }
  },
  emits: ['update:value', 'rename', 'remove'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const keyword = ref('')
    const showModal = ref(false)
    const editingId = ref<string | null>(null)
    const form = ref<{ name: string; color: string; description: string }>({
      name: '',
      color: BIZ_GROUP_COLORS[0],
      description: ''
    })

    const filtered = computed(() => {
      const q = keyword.value.trim().toLowerCase()
      const list = props.value || []
      if (!q) return list
      return list.filter(
        (g) =>
          String(g.name || '')
            .toLowerCase()
            .includes(q) ||
          String(g.description || '')
            .toLowerCase()
            .includes(q)
      )
    })

    const update = (next: WorkflowBizGroup[]) => emit('update:value', next)

    const openCreate = () => {
      editingId.value = null
      form.value = { name: '', color: BIZ_GROUP_COLORS[0], description: '' }
      showModal.value = true
    }

    const snapColor = (c?: string): string => {
      const hex = String(c || '').toLowerCase()
      const hit = BIZ_GROUP_COLORS.find((x) => x.toLowerCase() === hex)
      return hit || BIZ_GROUP_COLORS[0]
    }

    const openEdit = (row: WorkflowBizGroup) => {
      editingId.value = row.id
      form.value = {
        name: row.name,
        color: snapColor(row.color || groupColor(row.name)),
        description: row.description || ''
      }
      showModal.value = true
    }

    const saveForm = () => {
      const name = form.value.name.trim()
      if (!name) {
        window.$message?.warning(t('project.preference.group_name_required'))
        return
      }
      const list = [...(props.value || [])]
      const dup = list.find(
        (g) =>
          g.id !== editingId.value &&
          String(g.name || '').trim().toLowerCase() === name.toLowerCase()
      )
      if (dup) {
        window.$message?.warning(t('project.preference.group_name_duplicate'))
        return
      }
      if (editingId.value) {
        const idx = list.findIndex((g) => g.id === editingId.value)
        if (idx >= 0) {
          const prev = list[idx]
          list[idx] = {
            ...prev,
            name,
            color: form.value.color || groupColor(name),
            description: form.value.description.trim()
          }
          if (prev.name !== name) {
            emit('rename', { from: prev.name, to: name })
          }
        }
      } else {
        list.push({
          id: newBizGroupId(),
          name,
          color: form.value.color || groupColor(name),
          description: form.value.description.trim()
        })
      }
      update(list)
      showModal.value = false
    }

    const removeRow = (row: WorkflowBizGroup) => {
      const ok = window.confirm(
        t('project.preference.group_delete_confirm', { name: row.name })
      )
      if (!ok) return
      emit('remove', { name: row.name })
      update((props.value || []).filter((g) => g.id !== row.id))
    }

    const loadDefaults = () => {
      update(defaultBizGroups())
    }

    const syncExisting = () => {
      const names = [
        ...(props.suggestNames || []),
        ...(props.value || []).map((g) => g.name)
      ]
      const next = mergeBizGroupNames(props.value || [], names)
      update(next)
      window.$message?.success(
        t('project.preference.group_sync_done', { n: next.length })
      )
    }

    return () => (
      <div style='padding: 0 30px 12px'>
        <div style='margin-bottom: 8px; color: #667085; font-size: 13px'>
          {t('project.preference.group_catalog_hint')}
        </div>
        <NSpace style='margin-bottom: 10px' align='center'>
          <NInput
            size='small'
            clearable
            style='width: 220px'
            value={keyword.value}
            placeholder={t('project.preference.group_search')}
            onUpdateValue={(v) => (keyword.value = v)}
          />
          <NButton
            size='small'
            type='primary'
            disabled={props.disabled}
            onClick={openCreate}
          >
            {t('project.preference.group_add')}
          </NButton>
          <NButton
            size='small'
            secondary
            disabled={props.disabled}
            onClick={loadDefaults}
          >
            {t('project.preference.group_load_defaults')}
          </NButton>
          <NButton
            size='small'
            secondary
            disabled={props.disabled || !(props.suggestNames || []).length}
            onClick={syncExisting}
          >
            {t('project.preference.group_sync_existing')}
          </NButton>
        </NSpace>
        <NDataTable
          size='small'
          bordered
          data={filtered.value}
          columns={[
            {
              title: t('project.preference.group_color'),
              key: 'color',
              width: 64,
              render: (row: WorkflowBizGroup) => (
                <span
                  style={{
                    display: 'inline-block',
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    background: row.color || groupColor(row.name),
                    verticalAlign: 'middle'
                  }}
                />
              )
            },
            {
              title: t('project.preference.group_name'),
              key: 'name',
              render: (row: WorkflowBizGroup) => (
                <NTag size='small' type='info'>
                  {row.name}
                </NTag>
              )
            },
            {
              title: t('project.preference.group_desc'),
              key: 'description',
              ellipsis: { tooltip: true },
              render: (row: WorkflowBizGroup) => row.description || '—'
            },
            {
              title: t('project.preference.group_actions'),
              key: 'actions',
              width: 140,
              render: (row: WorkflowBizGroup) => (
                <NSpace size={6}>
                  <NButton
                    size='tiny'
                    tertiary
                    disabled={props.disabled}
                    onClick={() => openEdit(row)}
                  >
                    {t('project.preference.group_edit')}
                  </NButton>
                  <NButton
                    size='tiny'
                    tertiary
                    type='error'
                    disabled={props.disabled}
                    onClick={() => removeRow(row)}
                  >
                    {t('project.preference.group_rule_remove')}
                  </NButton>
                </NSpace>
              )
            }
          ]}
        />
        {(props.value || []).length === 0 && (
          <div style='margin-top: 8px'>
            <NTag size='small' type='warning'>
              {t('project.preference.group_catalog_empty')}
            </NTag>
          </div>
        )}

        <NModal
          show={showModal.value}
          preset='card'
          style='width: 480px'
          title={
            editingId.value
              ? t('project.preference.group_edit')
              : t('project.preference.group_add')
          }
          bordered
          onClose={() => {
            showModal.value = false
          }}
          onUpdateShow={(v: boolean) => {
            showModal.value = v
          }}
          v-slots={{
            footer: () => (
              <NSpace justify='end'>
                <NButton onClick={() => (showModal.value = false)}>
                  {t('project.preference.cancel')}
                </NButton>
                <NButton type='primary' onClick={saveForm}>
                  {t('project.preference.submit')}
                </NButton>
              </NSpace>
            )
          }}
        >
          <NSpace vertical size={12}>
            <div>
              <div style='margin-bottom: 4px; font-size: 13px'>
                {t('project.preference.group_name')}
              </div>
              <NInput
                value={form.value.name}
                placeholder='采集'
                onUpdateValue={(v) => (form.value.name = v)}
              />
            </div>
            <div>
              <div style='margin-bottom: 4px; font-size: 13px'>
                {t('project.preference.group_color')}
              </div>
              <div style='display:flex; flex-wrap:wrap; gap:10px; align-items:center'>
                {BIZ_GROUP_COLORS.map((c) => {
                  const selected =
                    String(form.value.color || '').toLowerCase() ===
                    c.toLowerCase()
                  return (
                    <button
                      type='button'
                      key={c}
                      title={c}
                      onClick={() => (form.value.color = c)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        border: selected
                          ? '2px solid #111827'
                          : '2px solid transparent',
                        outline: selected
                          ? '2px solid rgba(37,99,235,0.35)'
                          : 'none',
                        outlineOffset: '1px',
                        background: c,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    />
                  )
                })}
              </div>
              <div style='margin-top:6px;color:#94a3b8;font-size:12px'>
                {t('project.preference.group_color_preset_hint')}
              </div>
            </div>
            <div>
              <div style='margin-bottom: 4px; font-size: 13px'>
                {t('project.preference.group_desc')}
              </div>
              <NInput
                type='textarea'
                rows={2}
                value={form.value.description}
                placeholder={t('project.preference.group_desc_placeholder')}
                onUpdateValue={(v) => (form.value.description = v)}
              />
            </div>
          </NSpace>
        </NModal>
      </div>
    )
  }
})

export default GroupCatalogEditor
