/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NAutoComplete } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { axios } from '@/service/service'
import styles from '../styles/dashboard.module.scss'

interface TaskHit {
  taskCode: string
  taskName: string
  taskType: string
  workflowCode: string
  workflowName: string
  projectCode: string
  projectName: string
}

// Global task filter in the header bar: dropdown lists tasks (name + project/workflow + "go to").
// Click the name -> filter task instances by that name; click "go to" -> open the task in its workflow DAG.
const TaskFilter = defineComponent({
  name: 'OpsTaskFilter',
  props: {
    value: { type: String, default: '' }
  },
  emits: ['update:value'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const router = useRouter()
    const text = ref(props.value)
    watch(
      () => props.value,
      (v) => {
        if (v !== text.value) text.value = v
      }
    )

    // ---- global task search (task definitions, across authorized projects) ----
    const hits = ref<TaskHit[]>([])
    const searching = ref(false)
    let timer: ReturnType<typeof setTimeout> | undefined
    let seq = 0

    const searchTasks = (kw: string) => {
      clearTimeout(timer)
      const key = kw.trim()
      if (key.length < 2) {
        hits.value = []
        searching.value = false
        return
      }
      searching.value = true
      timer = setTimeout(async () => {
        const mine = ++seq
        try {
          const res = (await axios({
            url: '/task-search',
            method: 'get',
            params: { keyword: key, limit: 20 }
          })) as unknown as TaskHit[]
          // drop out-of-order responses
          if (mine === seq) hits.value = res || []
        } catch (e) {
          if (mine === seq) hits.value = []
        } finally {
          if (mine === seq) searching.value = false
        }
      }, 250)
    }
    onBeforeUnmount(() => clearTimeout(timer))

    // click task name: filter task instances by this task name
    const filterByTask = (hit: TaskHit) => {
      clearTimeout(timer)
      seq++
      hits.value = []
      searching.value = false
      text.value = hit.taskName
      emit('update:value', hit.taskName)
    }

    const gotoTask = (hit: TaskHit) => {
      router.push({
        path: `/projects/${hit.projectCode}/workflow/definitions/${hit.workflowCode}`,
        query: { projectName: hit.projectName, taskCode: hit.taskCode }
      })
    }

    const options = computed(() =>
      hits.value.map((hit) => ({
        label: hit.taskName,
        // unique per task+workflow so a task name reused in several workflows stays selectable
        value: `${hit.workflowCode}:${hit.taskCode}`,
        hit
      }))
    )

    const renderOption = (info: { node: any; option: any }) => {
      const hit: TaskHit = info.option.hit
      return h(
        'div',
        {
          style:
            'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 12px',
          onMousedown: (e: MouseEvent) => e.preventDefault()
        },
        [
          h(
            'div',
            {
              style: 'min-width:0;flex:1;cursor:pointer',
              title: t('home.ops_task_filter_tip'),
              onClick: () => filterByTask(hit)
            },
            [
            h(
              'div',
              {
                style:
                  'font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
              },
              hit.taskName
            ),
            h(
              'div',
              {
                style:
                  'font-size:12px;opacity:.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
              },
              `${hit.projectName} / ${hit.workflowName}`
            )
          ]),
          h(
            'a',
            {
              class: styles.linkBtn,
              style: 'font-size:13px;flex:none',
              onClick: (e: MouseEvent) => {
                e.stopPropagation()
                gotoTask(hit)
              }
            },
            t('home.ops_goto')
          )
        ]
      )
    }

    return () => (
      <NAutoComplete
        value={text.value}
        size='small'
        clearable
        style='width: 260px'
        options={options.value}
        loading={searching.value}
        blur-after-select={false}
        onSelect={() => undefined}
        renderOption={renderOption as any}
        placeholder={t('home.ops_task_filter_placeholder')}
        onUpdateValue={(v: string | null) => {
          text.value = v || ''
          searchTasks(text.value)
          if (!text.value) emit('update:value', '')
        }}
        onKeyup={(e: KeyboardEvent) => {
          if (e.key === 'Enter') emit('update:value', text.value.trim())
        }}
      />
    )
  }
})

export default TaskFilter
