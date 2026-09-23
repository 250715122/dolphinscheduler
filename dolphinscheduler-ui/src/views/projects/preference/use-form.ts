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
import { onMounted, reactive, ref, Ref, toRaw } from 'vue'
import getElementByJson from '@/components/form/get-elements-by-json'
import type {
  IFormItem,
  IJsonItem,
  INodeData
} from '../task/components/node/types'
import * as Fields from '@/views/projects/task/components/node/fields'
import { Router, useRouter } from 'vue-router'
import {
  queryProjectPreferenceByProjectCode,
  updateProjectPreference,
  updateProjectPreferenceState
} from '@/service/modules/projects-preference'
import { useI18n } from 'vue-i18n'
import {
  UpdateProjectPreferenceReq,
  UpdateProjectPreferenceStateReq
} from '@/service/modules/projects-preference/types'
import { useWarningType } from '@/views/projects/preference/components/use-warning-type'
import { useTenant } from '@/views/projects/preference/components/use-tenant'
import { useAlertGroup } from '@/views/projects/preference/components/use-alert-group'
import { mergeBizGroupNames } from '@/views/projects/workflow/common/workflow-group'

export function useForm() {
  const router: Router = useRouter()
  const { t } = useI18n()

  const projectCode = Number(router.currentRoute.value.params.projectCode)

  const formRef = ref()
  const jsonRef = ref([]) as Ref<IJsonItem[]>
  const elementsRef = ref([]) as Ref<IFormItem[]>
  const rulesRef = ref({})
  const formProps = ref({})
  const groupSavingRef = ref(false)
  const stateRef = ref(0)

  formProps.value = {
    labelPlacement: 'left',
    labelWidth: 'auto',
    size: 'large'
  }

  const data = reactive({
    model: {
      taskPriority: 'MEDIUM',
      workerGroup: 'default',
      environmentCode: null,
      failRetryTimes: 0,
      failRetryInterval: 1,
      cpuQuota: -1,
      memoryMax: -1,
      timeoutFlag: false,
      timeoutNotifyStrategy: ['WARN'],
      timeout: 30,
      workflowBizGroups: [] as Array<{
        id: string
        name: string
        color: string
        description?: string
      }>,
      workflowGroupRules: [] as Array<{ group: string; pattern: string }>,
      workflowGroupOverrides: {} as Record<string, string>,
      workflowGroupAutoMatch: true
    } as INodeData & {
      workflowBizGroups: Array<{
        id: string
        name: string
        color: string
        description?: string
      }>
      workflowGroupRules: Array<{ group: string; pattern: string }>
      workflowGroupOverrides: Record<string, string>
      workflowGroupAutoMatch: boolean
    }
  })

  const setValues = (initialValues: { [field: string]: any }) => {
    Object.assign(data.model, initialValues)
  }

  const initProjectPreference = async () => {
    if (projectCode) {
      const result = await queryProjectPreferenceByProjectCode(projectCode)
      if (result?.preferences) {
        const pref =
          typeof result.preferences === 'string'
            ? JSON.parse(result.preferences)
            : result.preferences
        const rules = pref.workflowGroupRules || []
        const overrides = pref.workflowGroupOverrides || {}
        let catalog = pref.workflowBizGroups || []
        if (!catalog.length) {
          const names = [
            ...rules.map((r: any) => r?.group),
            ...Object.values(overrides)
          ]
          catalog = mergeBizGroupNames([], names)
        }
        setValues({
          ...pref,
          workflowBizGroups: catalog,
          workflowGroupRules: rules,
          workflowGroupOverrides: overrides,
          workflowGroupAutoMatch:
            pref.workflowGroupAutoMatch !== undefined
              ? !!pref.workflowGroupAutoMatch
              : true
        })
        stateRef.value = result.state
      }
    }
  }

  onMounted(() => {
    initProjectPreference()
  })


  const PREFERENCE_KEYS = [
    'taskPriority',
    'tenant',
    'workerGroup',
    'environmentCode',
    'failRetryTimes',
    'failRetryInterval',
    'warningType',
    'alertGroups',
    'cpuQuota',
    'memoryMax',
    'timeoutFlag',
    'timeoutNotifyStrategy',
    'timeout',
    'workflowBizGroups',
    'workflowGroupRules',
    'workflowGroupOverrides',
    'workflowGroupAutoMatch'
  ] as const

  const buildPreferencesJson = () => {
    const raw = toRaw(data.model) as Record<string, any>
    const out: Record<string, any> = {}
    for (const k of PREFERENCE_KEYS) {
      if (raw[k] !== undefined) {
        out[k] = raw[k]
      }
    }
    out.workflowBizGroups = raw.workflowBizGroups || []
    out.workflowGroupRules = raw.workflowGroupRules || []
    out.workflowGroupOverrides = raw.workflowGroupOverrides || {}
    out.workflowGroupAutoMatch = !!raw.workflowGroupAutoMatch
    return JSON.stringify(out)
  }

  /** Persist biz-group settings (debounced; no model mutation → no update loops). */
  let groupSaveTimer: ReturnType<typeof setTimeout> | null = null
  let groupSaveWaiters: Array<{
    resolve: () => void
    reject: (e: any) => void
  }> = []
  const flushGroupSave = async () => {
    const waiters = groupSaveWaiters
    groupSaveWaiters = []
    groupSavingRef.value = true
    try {
      await updateProjectPreference(
        {
          projectPreferences: buildPreferencesJson()
        } as UpdateProjectPreferenceReq,
        projectCode
      )
      window.$message.success(t('project.preference.group_saved'))
      waiters.forEach((w) => w.resolve())
    } catch (e: any) {
      window.$message.error(
        e?.message || t('project.preference.group_save_failed')
      )
      waiters.forEach((w) => w.reject(e))
    } finally {
      groupSavingRef.value = false
    }
  }
  const saveGroupPreferences = () => {
    if (!projectCode) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
      groupSaveWaiters.push({ resolve, reject })
      groupSavingRef.value = true
      if (groupSaveTimer) clearTimeout(groupSaveTimer)
      groupSaveTimer = setTimeout(() => {
        groupSaveTimer = null
        void flushGroupSave()
      }, 400)
    })
  }

  const handleUpdate = () => {
    const requestData = {
      projectPreferences: buildPreferencesJson()
    } as UpdateProjectPreferenceReq
    updateProjectPreference(requestData, projectCode).then(() => {
      window.$message.success(t('project.preference.success'))
    })
  }

  const handleUpdateState = (value: number) => {
    const requestData = {
      state: value
    } as UpdateProjectPreferenceStateReq

    updateProjectPreferenceState(requestData, projectCode).then(() => {
      window.$message.success(t('project.preference.success'))
    })
  }

  const preferencesItems: IJsonItem[] = [
    Fields.useTaskPriority(),
    useTenant(),
    Fields.useWorkerGroup(projectCode),
    Fields.useEnvironmentName(data.model, true),
    ...Fields.useFailed(),
    useWarningType(),
    useAlertGroup(),
    ...Fields.useResourceLimit()
  ]

  const restructurePreferencesItems = (preferencesItems: any) => {
    for (const item of preferencesItems) {
      if (item.validate?.required) {
        item.validate.required = false
        item.span = 12
      }
      if (item.type === 'select') {
        Object.assign(item, {
          props: { style: 'width: 250px', clearable: true }
        })
      } else {
        Object.assign(item, { props: { style: 'width: 250px' } })
      }
    }
    return preferencesItems
  }

  jsonRef.value = restructurePreferencesItems(preferencesItems)

  const getElements = () => {
    const { rules, elements } = getElementByJson(jsonRef.value, data.model)
    elementsRef.value = elements
    rulesRef.value = rules
  }

  getElements()

  return {
    formRef,
    elementsRef,
    rulesRef,
    model: data.model,
    stateRef,
    groupSavingRef,
    formProps,
    t,
    handleUpdate,
    handleUpdateState,
    saveGroupPreferences
  }
}
