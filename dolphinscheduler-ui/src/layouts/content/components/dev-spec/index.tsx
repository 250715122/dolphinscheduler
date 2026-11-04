/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { defineComponent, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NIcon,
  NModal,
  NScrollbar,
  NInput,
  NSpace,
  NSpin,
  NPopconfirm,
  useMessage
} from 'naive-ui'
import { FileTextOutlined } from '@vicons/antd'
import { axios } from '@/service/service'
import { defaultSpec, renderMarkdown } from './spec-data'
import styles from './index.module.scss'

interface SpecRes {
  content: string | null
  updateTime: string | null
  updater: string | null
  editable: boolean
}

const DevSpec = defineComponent({
  name: 'DevSpec',
  setup() {
    const { t } = useI18n()
    const message = useMessage()
    const show = ref(false)
    const loading = ref(false)
    const saving = ref(false)
    const editing = ref(false)
    const editable = ref(false)
    const content = ref(defaultSpec)
    const draft = ref('')
    const meta = ref('')

    const html = computed(() => renderMarkdown(editing.value ? draft.value : content.value))

    const load = async () => {
      loading.value = true
      try {
        const res = (await axios({ url: '/system-settings/dev-spec', method: 'get' })) as unknown as SpecRes
        editable.value = !!res.editable
        content.value = res.content && res.content.trim() ? res.content : defaultSpec
        meta.value = res.updater && res.updateTime ? `${res.updater} · ${res.updateTime}` : ''
      } catch (e) {
        // older backend or network error: fall back to the built-in content, read only
        editable.value = false
        content.value = defaultSpec
      } finally {
        loading.value = false
      }
    }

    const open = () => {
      show.value = true
      editing.value = false
      load()
    }

    const startEdit = () => {
      draft.value = content.value
      editing.value = true
    }

    const save = async (value: string) => {
      saving.value = true
      try {
        await axios({ url: '/system-settings/dev-spec', method: 'put', data: { content: value } })
        message.success(t('menu.dev_spec_saved'))
        editing.value = false
        await load()
      } finally {
        saving.value = false
      }
    }

    return () => (
      <>
        <NButton quaternary onClick={open}>
          {{
            icon: () => (
              <NIcon size='16'>
                <FileTextOutlined />
              </NIcon>
            ),
            default: () => t('menu.dev_spec')
          }}
        </NButton>
        <NModal
          show={show.value}
          onUpdateShow={(v: boolean) => (show.value = v)}
          preset='card'
          title={t('menu.dev_spec_title')}
          style={editing.value ? 'width: min(1200px, 96vw)' : 'width: min(820px, 94vw)'}
          segmented={{ content: true, footer: 'soft' }}
          maskClosable={!editing.value}
        >
          {{
            'header-extra': () =>
              editable.value && !editing.value ? (
                <NButton size='small' type='primary' secondary onClick={startEdit}>
                  {t('menu.dev_spec_edit')}
                </NButton>
              ) : null,
            default: () => (
              <NSpin show={loading.value}>
                {editing.value ? (
                  <div class={styles.editor}>
                    <NInput
                      type='textarea'
                      value={draft.value}
                      onUpdateValue={(v: string) => (draft.value = v)}
                      placeholder={t('menu.dev_spec_placeholder')}
                      style='height: 62vh; font-family: Menlo, Consolas, monospace; font-size: 13px'
                    />
                    <NScrollbar style='height: 62vh'>
                      <div class={styles.md} innerHTML={html.value} />
                    </NScrollbar>
                  </div>
                ) : (
                  <NScrollbar style='max-height: 66vh'>
                    <div class={styles.md} innerHTML={html.value} />
                  </NScrollbar>
                )}
              </NSpin>
            ),
            footer: () =>
              editing.value ? (
                <NSpace justify='space-between'>
                  <NPopconfirm onPositiveClick={() => save('')}>
                    {{
                      trigger: () => (
                        <NButton size='small' quaternary type='warning'>
                          {t('menu.dev_spec_reset')}
                        </NButton>
                      ),
                      default: () => t('menu.dev_spec_reset_confirm')
                    }}
                  </NPopconfirm>
                  <NSpace>
                    <NButton size='small' onClick={() => (editing.value = false)}>
                      {t('menu.dev_spec_cancel')}
                    </NButton>
                    <NButton size='small' type='primary' loading={saving.value} onClick={() => save(draft.value)}>
                      {t('menu.dev_spec_save')}
                    </NButton>
                  </NSpace>
                </NSpace>
              ) : meta.value ? (
                <div class={styles.meta}>
                  {t('menu.dev_spec_updated')}：{meta.value}
                </div>
              ) : null
          }}
        </NModal>
      </>
    )
  }
})

export default DevSpec
