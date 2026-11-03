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

import { defineComponent, h, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NAlert,
  NButton,
  NDataTable,
  NPagination,
  NPopconfirm,
  NSpace,
  NTag
} from 'naive-ui'
import Card from '@/components/card'
import Search from '@/components/input-search'
import {
  queryWorkflowRecycle,
  restoreWorkflowRecycle,
  purgeWorkflowRecycle,
  type RecycleItem
} from '@/service/modules/workflow-recycle'

const WorkflowRecycle = defineComponent({
  name: 'workflow-recycle',
  setup() {
    const { t } = useI18n()
    const route = useRoute()
    const projectCode = String(route.params.projectCode)

    const state = reactive({
      loading: false,
      rows: [] as RecycleItem[],
      total: 0,
      page: 1,
      pageSize: 10,
      searchVal: '',
      retentionDays: 60
    })
    const busyId = ref<number | null>(null)

    const load = async () => {
      state.loading = true
      try {
        const res = await queryWorkflowRecycle(projectCode, {
          pageNo: state.page,
          pageSize: state.pageSize,
          searchVal: state.searchVal
        })
        state.rows = res.page.totalList
        state.total = res.page.total
        state.retentionDays = res.retentionDays
      } finally {
        state.loading = false
      }
    }

    const restore = async (row: RecycleItem) => {
      busyId.value = row.id
      try {
        await restoreWorkflowRecycle(projectCode, row.id)
        window.$message.success(t('project.recycle.restore_success'))
        await load()
      } catch (e) {
        /* error message already shown by the axios interceptor */
      } finally {
        busyId.value = null
      }
    }

    const purge = async (row: RecycleItem) => {
      busyId.value = row.id
      try {
        await purgeWorkflowRecycle(projectCode, row.id)
        window.$message.success(t('project.recycle.purge_success'))
        await load()
      } catch (e) {
        /* handled by interceptor */
      } finally {
        busyId.value = null
      }
    }

    onMounted(load)

    return { t, state, busyId, load, restore, purge }
  },
  render() {
    const { t, state } = this
    const columns = [
      { title: t('project.recycle.name'), key: 'workflowName', ellipsis: { tooltip: true } },
      {
        title: t('project.recycle.task_count'),
        key: 'taskCount',
        width: 90
      },
      {
        title: t('project.recycle.delete_time'),
        key: 'deleteTime',
        width: 170
      },
      {
        title: t('project.recycle.remaining'),
        key: 'remainingDays',
        width: 130,
        render: (row: RecycleItem) =>
          h(
            NTag,
            {
              size: 'small',
              bordered: false,
              type: row.remainingDays <= 7 ? 'error' : 'default'
            },
            { default: () => t('project.recycle.days', { n: row.remainingDays }) }
          )
      },
      {
        title: t('project.recycle.operation'),
        key: 'op',
        width: 170,
        render: (row: RecycleItem) =>
          h(NSpace, { size: 8 }, {
            default: () => [
              h(
                NPopconfirm,
                { onPositiveClick: () => this.restore(row) },
                {
                  trigger: () =>
                    h(
                      NButton,
                      { text: true, type: 'primary', size: 'small', disabled: this.busyId === row.id },
                      { default: () => t('project.recycle.restore') }
                    ),
                  default: () => t('project.recycle.restore_confirm')
                }
              ),
              h(
                NPopconfirm,
                { onPositiveClick: () => this.purge(row) },
                {
                  trigger: () =>
                    h(
                      NButton,
                      { text: true, type: 'error', size: 'small', disabled: this.busyId === row.id },
                      { default: () => t('project.recycle.purge') }
                    ),
                  default: () => t('project.recycle.purge_confirm')
                }
              )
            ]
          })
      }
    ]

    return (
      <NSpace vertical>
        <NAlert type='info' showIcon={false}>
          {t('project.recycle.tip', { n: state.retentionDays })}
        </NAlert>
        <Card>
          <NSpace justify='end'>
            <Search
              v-model:value={state.searchVal}
              placeholder={t('project.recycle.search')}
              onSearch={() => {
                state.page = 1
                this.load()
              }}
            />
          </NSpace>
        </Card>
        <Card title={t('menu.workflow_recycle_bin')}>
          <NSpace vertical>
            <NDataTable
              loading={state.loading}
              columns={columns as any}
              data={state.rows}
              row-key={(r: RecycleItem) => r.id}
              size='small'
            />
            <NSpace justify='center'>
              <NPagination
                v-model:page={state.page}
                v-model:page-size={state.pageSize}
                item-count={state.total}
                show-size-picker
                page-sizes={[10, 30, 50]}
                onUpdatePage={() => this.load()}
                onUpdatePageSize={() => {
                  state.page = 1
                  this.load()
                }}
              />
            </NSpace>
          </NSpace>
        </Card>
      </NSpace>
    )
  }
})

export default WorkflowRecycle
