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

import { defineComponent } from 'vue'
import Form from '@/components/form'
import { useForm } from './use-form'
import { NButton, NDivider, NSpace, NSwitch } from 'naive-ui'
import GroupRulesEditor from './components/group-rules-editor'
import GroupCatalogEditor from './components/group-catalog-editor'

const PreferenceForm = defineComponent({
  name: 'PreferenceForm',
  setup() {
    const {
      formRef,
      elementsRef,
      rulesRef,
      model,
      stateRef,
      groupSavingRef,
      formProps,
      t,
      handleUpdate,
      handleUpdateState,
      saveGroupPreferences
    } = useForm()

    const enabled = () => stateRef.value === 1

    const persistGroups = async () => {
      if (!enabled()) return
      // ignore nested saves while a save is already in-flight/queued
      await saveGroupPreferences()
    }

    return () => (
      <div>
        <div style={{ marginLeft: '30px' }}>
          <NSwitch
            size={'large'}
            round={false}
            v-model:value={stateRef.value}
            checkedValue={1}
            uncheckedValue={0}
            onUpdateValue={handleUpdateState}
          >
            {{
              checked: () => t('project.preference.enabled'),
              unchecked: () => t('project.preference.disabled')
            }}
          </NSwitch>
        </div>
        <div>
          <div style={{ margin: '30px' }}>
            {t('project.preference.instruction_tips')}
          </div>
          <NDivider />
          <Form
            ref={formRef}
            meta={{
              model,
              disabled: stateRef.value === 1 ? false : true,
              rules: rulesRef.value,
              elements: elementsRef.value,
              ...formProps.value
            }}
            layout={{
              xGap: 10
            }}
            style={{ marginLeft: '150px' }}
          />
          <NSpace justify='center' style={{ marginBottom: '12px' }}>
            <NButton v-show={stateRef.value} type='info' onClick={handleUpdate}>
              {t('project.preference.submit')}
            </NButton>
          </NSpace>
          <div
            style={{
              margin: '0 30px 8px',
              color: '#94a3b8',
              fontSize: '12px'
            }}
          >
            {t('project.preference.submit_task_only_hint')}
          </div>
          <NDivider />
          <div
            style={{
              margin: '0 30px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {t('project.preference.group_catalog_title')}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>
              {groupSavingRef.value
                ? t('project.preference.group_saving')
                : t('project.preference.group_autosave_hint')}
            </span>
          </div>
          <GroupCatalogEditor
            value={(model as any).workflowBizGroups || []}
            disabled={!enabled()}
            suggestNames={(() => {
              const names: string[] = []
              ;((model as any).workflowGroupRules || []).forEach((r: any) => {
                if (r?.group) names.push(String(r.group))
              })
              Object.values(
                ((model as any).workflowGroupOverrides || {}) as Record<
                  string,
                  string
                >
              ).forEach((g) => {
                if (g) names.push(String(g))
              })
              return Array.from(new Set(names))
            })()}
            onUpdate:value={async (v: any) => {
              ;(model as any).workflowBizGroups = v
              await persistGroups()
            }}
            onRename={({ from, to }: { from: string; to: string }) => {
              const rules = ((model as any).workflowGroupRules || []).map(
                (r: any) => (r.group === from ? { ...r, group: to } : r)
              )
              ;(model as any).workflowGroupRules = rules
              const ov = { ...((model as any).workflowGroupOverrides || {}) }
              Object.keys(ov).forEach((k) => {
                if (ov[k] === from) ov[k] = to
              })
              ;(model as any).workflowGroupOverrides = ov
            }}
            onRemove={({ name }: { name: string }) => {
              const n = String(name || '').trim()
              if (!n) return
              ;(model as any).workflowGroupRules = (
                (model as any).workflowGroupRules || []
              ).filter((r: any) => r.group !== n)
              const ov = { ...((model as any).workflowGroupOverrides || {}) }
              Object.keys(ov).forEach((k) => {
                if (ov[k] === n) delete ov[k]
              })
              ;(model as any).workflowGroupOverrides = ov
            }}
          />
          <NDivider />
          <div
            style={{
              margin: '0 30px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {t('project.preference.group_rules_title')}
            </span>
            <NSpace align='center'>
              <span style={{ fontSize: '13px', color: '#667085' }}>
                {t('project.preference.group_auto_match_label')}
              </span>
              <NSwitch
                size='small'
                disabled={!enabled()}
                value={!!(model as any).workflowGroupAutoMatch}
                onUpdateValue={async (v: boolean) => {
                  ;(model as any).workflowGroupAutoMatch = v
                  await persistGroups()
                }}
              >
                {{
                  checked: () => t('project.preference.group_auto_match_on'),
                  unchecked: () => t('project.preference.group_auto_match_off')
                }}
              </NSwitch>
            </NSpace>
          </div>
          <div style={{ margin: '0 30px 8px', color: '#667085', fontSize: '13px' }}>
            {t('project.preference.group_auto_match_hint')}
          </div>
          <GroupRulesEditor
            value={(model as any).workflowGroupRules || []}
            groups={(model as any).workflowBizGroups || []}
            disabled={!enabled() || !(model as any).workflowGroupAutoMatch}
            onUpdate:value={async (v: any) => {
              ;(model as any).workflowGroupRules = v
              await persistGroups()
            }}
          />
        </div>
      </div>
    )
  }
})

export default PreferenceForm
