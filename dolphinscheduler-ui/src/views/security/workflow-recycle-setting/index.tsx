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

import { defineComponent, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAlert, NButton, NInputNumber, NSpace } from 'naive-ui'
import Card from '@/components/card'
import {
  getRecycleRetention,
  updateRecycleRetention
} from '@/service/modules/workflow-recycle'

const WorkflowRecycleSetting = defineComponent({
  name: 'workflow-recycle-setting',
  setup() {
    const { t } = useI18n()
    const state = reactive({
      days: 60 as number | null,
      saved: 60,
      saving: false
    })

    const load = async () => {
      const res = await getRecycleRetention()
      state.days = res.retentionDays
      state.saved = res.retentionDays
    }

    const save = async () => {
      if (!state.days || state.days < 1) {
        window.$message.warning(t('security.recycle_setting_invalid'))
        return
      }
      state.saving = true
      try {
        await updateRecycleRetention(state.days)
        state.saved = state.days
        window.$message.success(t('security.recycle_setting_saved'))
      } catch (e) {
        /* handled by interceptor */
      } finally {
        state.saving = false
      }
    }

    onMounted(load)
    return { t, state, save }
  },
  render() {
    const { t, state } = this
    return (
      <Card title={t('security.recycle_setting_title')}>
        <NSpace vertical size={16}>
          <NAlert type='info' showIcon={false}>
            {t('security.recycle_setting_tip')}
          </NAlert>
          <NSpace align='center'>
            <span>{t('security.recycle_setting_label')}</span>
            <NInputNumber
              v-model:value={state.days}
              min={1}
              max={3650}
              precision={0}
              style='width: 160px'
            >
              {{ suffix: () => t('security.recycle_setting_unit') }}
            </NInputNumber>
            <NButton
              type='primary'
              loading={state.saving}
              disabled={state.days === state.saved}
              onClick={this.save}
            >
              {t('security.recycle_setting_save')}
            </NButton>
          </NSpace>
        </NSpace>
      </Card>
    )
  }
})

export default WorkflowRecycleSetting
