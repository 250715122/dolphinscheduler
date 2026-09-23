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

import { SearchOutlined } from '@vicons/antd'
import {
  NButton,
  NDataTable,
  NIcon,
  NPagination,
  NSpace,
  NTooltip,
  NPopconfirm,
  NSelect,
  NDatePicker
} from 'naive-ui'
import {
  defineComponent,
  getCurrentInstance,
  onMounted,
  toRefs,
  watch,
  ref,
  computed
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useTable } from './use-table'
import { useRouter, useRoute } from 'vue-router'
import { useUISettingStore } from '@/store/ui-setting/ui-setting'
import Card from '@/components/card'
import StartModal from './components/start-modal'
import TimingModal from './components/timing-modal'
import VersionModal from './components/version-modal'
import CopyModal from './components/copy-modal'
import BatchGroupModal from './components/batch-group-modal'
import type { Router } from 'vue-router'
import DependenciesModal from '@/views/projects/components/dependencies/dependencies-modal'
import totalCount from '@/utils/tableTotalCount'
import { queryProjectPreferenceByProjectCode } from '@/service/modules/projects-preference'
import { queryListPaging } from '@/service/modules/workflow-definition'
import {
  collectGroups,
  resolveWorkflowGroup,
  stripGroupFromDescription
} from '@/views/projects/workflow/common/workflow-group'

export default defineComponent({
  name: 'WorkflowDefinitionList',
  setup() {
    const router: Router = useRouter()
    const route = useRoute()
    const projectCode = Number(route.params.projectCode)
    const uiSettingStore = useUISettingStore()

    const {
      variables,
      createColumns,
      getTableData,
      batchDeleteWorkflow,
      batchCopyWorkflow
    } = useTable()

    const batchGroupShowRef = ref(false)

    const filters = ref({
      bizGroup: null as string | null,
      name: null as string | null,
      releaseState: null as string | null,
      scheduleReleaseState: null as string | null,
      createTimeRange: null as [number, number] | null,
      updateTimeRange: null as [number, number] | null,
      userName: null as string | null,
      description: null as string | null
    })

    const filterSource = ref<any[]>([])

    const loadFilterSource = async () => {
      try {
        const res: any = await queryListPaging(
          { pageNo: 1, pageSize: 2000, searchVal: '' },
          projectCode
        )
        filterSource.value = res?.totalList || res?.data?.totalList || []
      } catch {
        filterSource.value = []
      }
    }

    const loadGroupRules = async () => {
      try {
        const result = await queryProjectPreferenceByProjectCode(projectCode)
        if (result?.preferences) {
          const pref = JSON.parse(result.preferences)
          variables.groupRules = pref.workflowGroupRules || []
          variables.groupOverrides = pref.workflowGroupOverrides || {}
          variables.groupCatalog = pref.workflowBizGroups || []
          variables.groupAutoMatch =
            pref.workflowGroupAutoMatch !== undefined
              ? !!pref.workflowGroupAutoMatch
              : true
        } else {
          variables.groupRules = []
          variables.groupOverrides = {}
          variables.groupCatalog = []
          variables.groupAutoMatch = true
        }
      } catch {
        variables.groupRules = []
        variables.groupOverrides = {}
        variables.groupCatalog = []
        variables.groupAutoMatch = true
      }
    }

    const filterRows = computed(() =>
      filterSource.value.length ? filterSource.value : variables.tableData || []
    )

    const availableGroups = computed(() =>
      collectGroups(
        filterRows.value.map((r: any) => ({
          name: r.name,
          description: r.description,
          code: r.code
        })),
        variables.groupRules,
        variables.groupOverrides,
        variables.groupCatalog,
        variables.groupAutoMatch
      ).map((g) => ({ label: g, value: g }))
    )

    const toOptions = (values: string[]) =>
      Array.from(new Set(values.filter((v) => v && String(v).trim())))
        .sort((a, b) => a.localeCompare(b))
        .map((v) => ({ label: v, value: v }))

    const nameOptions = computed(() =>
      toOptions(filterRows.value.map((r: any) => String(r.name || '')))
    )
    const userNameOptions = computed(() =>
      toOptions(filterRows.value.map((r: any) => String(r.userName || '')))
    )
    const descriptionOptions = computed(() =>
      toOptions(
        filterRows.value.map((r: any) =>
          stripGroupFromDescription(r.description)
        )
      )
    )

    const inRange = (timeStr: string | undefined, range: [number, number] | null) => {
      if (!range || range.length !== 2) return true
      if (!timeStr) return false
      const t = new Date(timeStr.replace(/-/g, '/')).getTime()
      if (Number.isNaN(t)) return false
      let [a, b] = range
      const end = new Date(b)
      if (
        end.getHours() === 0 &&
        end.getMinutes() === 0 &&
        end.getSeconds() === 0
      ) {
        b = new Date(b).setHours(23, 59, 59, 999)
      }
      return t >= a && t <= b
    }

    const filteredTableData = computed(() => {
      const f = filters.value
      return (variables.tableData || []).filter((row: any) => {
        if (f.bizGroup) {
          const g = resolveWorkflowGroup(
            { name: row.name, description: row.description, code: row.code },
            variables.groupRules,
            variables.groupOverrides,
            variables.groupCatalog,
            variables.groupAutoMatch
          )
          if (g.name !== f.bizGroup) return false
        }
        if (f.name && String(row.name || '') !== f.name) return false
        if (f.releaseState && row.releaseState !== f.releaseState) return false
        if (f.scheduleReleaseState) {
          if (f.scheduleReleaseState === 'NONE') {
            if (row.scheduleReleaseState) return false
          } else if (row.scheduleReleaseState !== f.scheduleReleaseState) {
            return false
          }
        }
        if (f.userName && String(row.userName || '') !== f.userName) return false
        if (
          f.description &&
          stripGroupFromDescription(row.description) !== f.description
        )
          return false
        if (!inRange(row.createTime, f.createTimeRange)) return false
        if (!inRange(row.updateTime, f.updateTimeRange)) return false
        return true
      })
    })

    const requestData = () => {
      getTableData({
        pageSize: variables.pageSize,
        pageNo: variables.page,
        searchVal: filters.value.name || variables.searchVal || ''
      })
    }

    const handleUpdateList = async () => {
      await loadFilterSource()
      requestData()
    }

    const handleCopyUpdateList = async () => {
      variables.checkedRowKeys = []
      await loadFilterSource()
      requestData()
    }

    const handleSearch = () => {
      variables.page = 1
      variables.searchVal = filters.value.name || ''
      requestData()
    }

    const onClearSearch = () => {
      filters.value = {
        bizGroup: null,
        name: null,
        releaseState: null,
        scheduleReleaseState: null,
        createTimeRange: null,
        updateTimeRange: null,
        userName: null,
        description: null
      }
      variables.page = 1
      variables.searchVal = ''
      requestData()
    }

    const handleChangePageSize = () => {
      variables.page = 1
      requestData()
    }

    const createDefinition = () => {
      router.push({
        path: `/projects/${projectCode}/workflow/definitions/create`
      })
    }

    const createDefinitionDynamic = () => {
      router.push({
        path: `/projects/${projectCode}/workflow/definitions/create`,
        query: {
          dynamic: 'true'
        }
      })
    }

    const onBatchGroupSuccess = async () => {
      variables.checkedRowKeys = []
      await loadGroupRules()
      await loadFilterSource()
      requestData()
    }

    const trim = getCurrentInstance()?.appContext.config.globalProperties.trim

    watch(useI18n().locale, () => {
      createColumns(variables)
    })

    onMounted(async () => {
      await loadGroupRules()
      await loadFilterSource()
      createColumns(variables)
      requestData()
    })

    return {
      requestData,
      handleSearch,
      onClearSearch,
      handleUpdateList,
      createDefinition,
      createDefinitionDynamic,
      handleChangePageSize,
      batchDeleteWorkflow,
      batchCopyWorkflow,
      handleCopyUpdateList,
      onBatchGroupSuccess,
      ...toRefs(variables),
      filters,
      filteredTableData,
      availableGroups,
      nameOptions,
      userNameOptions,
      descriptionOptions,
      batchGroupShowRef,
      uiSettingStore,
      projectCode,
      trim
    }
  },
  render() {
    const { t } = useI18n()
    const { loadingRef } = this

    const releaseOptions = [
      { label: t('project.workflow.up_line'), value: 'ONLINE' },
      { label: t('project.workflow.down_line'), value: 'OFFLINE' }
    ]
    const scheduleOptions = [
      { label: t('project.workflow.time_up_line'), value: 'ONLINE' },
      { label: t('project.workflow.time_down_line'), value: 'OFFLINE' },
      { label: t('project.workflow.schedule_none'), value: 'NONE' }
    ]

    return (
      <NSpace vertical>
        <Card>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%'
            }}
          >
            <NButton
              type='primary'
              size='small'
              onClick={this.createDefinition}
              class='btn-create-workflow'
              style={{ flexShrink: 0 }}
            >
              {t('project.workflow.create_workflow')}
            </NButton>
            {this.uiSettingStore.getDynamicTask && (
              <NButton
                type='warning'
                size='small'
                onClick={this.createDefinitionDynamic}
                style={{ flexShrink: 0 }}
              >
                {t('project.workflow.create_workflow_dynamic')}
              </NButton>
            )}
            <NSelect
              size='small'
              clearable
              filterable
              style={{ width: '140px', flex: '0 1 140px' }}
              placeholder={t('project.workflow.biz_group')}
              options={this.availableGroups}
              value={this.filters.bizGroup}
              onUpdateValue={(v: any) => (this.filters.bizGroup = v)}
            />
            <NSelect
              size='small'
              clearable
              filterable
              style={{ minWidth: '180px', flex: '1 1 220px' }}
              placeholder={t('project.workflow.workflow_name')}
              options={this.nameOptions}
              value={this.filters.name}
              onUpdateValue={(v: any) => (this.filters.name = v)}
            />
            <NSelect
              size='small'
              clearable
              style={{ width: '100px', flex: '0 0 100px' }}
              placeholder={t('project.workflow.status')}
              options={releaseOptions}
              value={this.filters.releaseState}
              onUpdateValue={(v: any) => (this.filters.releaseState = v)}
            />
            <NSelect
              size='small'
              clearable
              style={{ width: '110px', flex: '0 0 110px' }}
              placeholder={t('project.workflow.schedule_publish_status')}
              options={scheduleOptions}
              value={this.filters.scheduleReleaseState}
              onUpdateValue={(v: any) =>
                (this.filters.scheduleReleaseState = v)
              }
            />
            <NDatePicker
              size='small'
              type='daterange'
              clearable
              style={{ width: '240px', flex: '0 1 240px' }}
              startPlaceholder={t('project.workflow.create_time')}
              endPlaceholder={t('project.workflow.create_time')}
              value={this.filters.createTimeRange}
              onUpdateValue={(v: any) => (this.filters.createTimeRange = v)}
            />
            <NDatePicker
              size='small'
              type='daterange'
              clearable
              style={{ width: '240px', flex: '0 1 240px' }}
              startPlaceholder={t('project.workflow.update_time')}
              endPlaceholder={t('project.workflow.update_time')}
              value={this.filters.updateTimeRange}
              onUpdateValue={(v: any) => (this.filters.updateTimeRange = v)}
            />
            <NSelect
              size='small'
              clearable
              filterable
              style={{ minWidth: '120px', flex: '0 1 140px' }}
              placeholder={t('project.workflow.create_user')}
              options={this.userNameOptions}
              value={this.filters.userName}
              onUpdateValue={(v: any) => (this.filters.userName = v)}
            />
            <NSelect
              size='small'
              clearable
              filterable
              style={{ minWidth: '140px', flex: '1 1 180px' }}
              placeholder={t('project.workflow.description')}
              options={this.descriptionOptions}
              value={this.filters.description}
              onUpdateValue={(v: any) => (this.filters.description = v)}
            />
            <div style={{ flex: '1 1 auto', minWidth: '8px' }} />
            <NButton
              type='primary'
              size='small'
              onClick={this.handleSearch}
              style={{ flexShrink: 0 }}
            >
              <NIcon>
                <SearchOutlined />
              </NIcon>
              {t('project.workflow.query')}
            </NButton>
            <NButton
              size='small'
              onClick={this.onClearSearch}
              style={{ flexShrink: 0 }}
            >
              {t('project.workflow.reset')}
            </NButton>
          </div>
        </Card>
        <Card title={t('project.workflow.workflow_definition')}>
          <NSpace vertical>
            <NDataTable
              loading={loadingRef}
              rowKey={(row) => row.code}
              columns={this.columns}
              data={this.filteredTableData}
              striped
              v-model:checked-row-keys={this.checkedRowKeys}
              row-class-name='items'
              scrollX={this.tableWidth}
            />
            <NSpace justify='space-between'>
              <NSpace>
                <NTooltip>
                  {{
                    default: () => t('project.workflow.batch_delete'),
                    trigger: () => (
                      <NPopconfirm onPositiveClick={this.batchDeleteWorkflow}>
                        {{
                          default: () => t('project.workflow.delete_confirm'),
                          trigger: () => (
                            <NButton
                              tag='div'
                              size='small'
                              type='primary'
                              disabled={this.checkedRowKeys.length <= 0}
                              class='btn-delete-all'
                            >
                              {t('project.workflow.batch_delete')}
                            </NButton>
                          )
                        }}
                      </NPopconfirm>
                    )
                  }}
                </NTooltip>
                <NTooltip>
                  {{
                    default: () => t('project.workflow.batch_copy'),
                    trigger: () => (
                      <NButton
                        tag='div'
                        size='small'
                        type='primary'
                        disabled={this.checkedRowKeys.length <= 0}
                        onClick={() => (this.copyShowRef = true)}
                        class='btn-delete-all'
                      >
                        {t('project.workflow.batch_copy')}
                      </NButton>
                    )
                  }}
                </NTooltip>
                <NTooltip>
                  {{
                    default: () => t('project.workflow.batch_group'),
                    trigger: () => (
                      <NButton
                        tag='div'
                        size='small'
                        type='primary'
                        disabled={this.checkedRowKeys.length <= 0}
                        onClick={() => (this.batchGroupShowRef = true)}
                      >
                        {t('project.workflow.batch_group')}
                      </NButton>
                    )
                  }}
                </NTooltip>
              </NSpace>
              <NPagination
                v-model:page={this.page}
                v-model:page-size={this.pageSize}
                show-size-picker
                page-sizes={[10, 30, 50]}
                show-quick-jumper
                onUpdatePage={this.requestData}
                onUpdatePageSize={this.handleChangePageSize}
                itemCount={this.totalCount}
                prefix={totalCount}
              />
            </NSpace>
          </NSpace>
        </Card>
        <StartModal
          v-model:row={this.row}
          v-model:show={this.startShowRef}
          onUpdateList={this.handleUpdateList}
        />
        <TimingModal
          v-model:row={this.row}
          v-model:show={this.timingShowRef}
          v-model:type={this.timingType}
          v-model:state={this.timingState}
          onUpdateList={this.handleUpdateList}
        />
        <VersionModal
          v-model:row={this.row}
          v-model:show={this.versionShowRef}
          onUpdateList={this.handleUpdateList}
        />
        <CopyModal
          v-model:codes={this.checkedRowKeys}
          v-model:show={this.copyShowRef}
          onUpdateList={this.handleCopyUpdateList}
        />
        <BatchGroupModal
          v-model:show={this.batchGroupShowRef}
          projectCode={this.projectCode}
          codes={this.checkedRowKeys}
          groupOptions={this.availableGroups}
          onSuccess={this.onBatchGroupSuccess}
        />
        <DependenciesModal
          v-model:row={this.row}
          v-model:show={this.dependenciesData.showRef}
          v-model:taskLinks={this.dependenciesData.taskLinks}
          required={this.dependenciesData.required}
          content={this.dependenciesData.tip}
          onConfirm={this.dependenciesData.action}
        />
      </NSpace>
    )
  }
})
