
import { reactive } from 'vue'
import * as Fields from '../fields/index'
import type { IJsonItem, INodeData } from '../types'
import { ITaskData } from '../types'

export function useSqlCheck({
  projectCode,
  from = 0,
  readonly,
  data
}: {
  projectCode: number
  from?: number
  readonly?: boolean
  data?: ITaskData
}) {
  const model = reactive({
    name: '',
    taskType: 'SQL_CHECK',
    flag: 'YES',
    description: '',
    timeoutFlag: false,
    localParams: [],
    environmentCode: null,
    failRetryInterval: 1,
    failRetryTimes: 0,
    workerGroup: 'default',
    delayTime: 0,
    timeout: 30,
    type: 'STARROCKS',
    sql: '',
    operator: 'GT',
    threshold: 0,
    checkName: '',
    timeoutNotifyStrategy: ['WARN']
  } as unknown as INodeData)

  return {
    json: [
      Fields.useName(from),
      ...Fields.useTaskDefinition({ projectCode, from, readonly, data, model }),
      Fields.useRunFlag(),
      Fields.useDescription(),
      Fields.useTaskPriority(),
      Fields.useWorkerGroup(projectCode),
      Fields.useEnvironmentName(model, !data?.id),
      ...Fields.useTaskGroup(model, projectCode),
      ...Fields.useFailed(),
      Fields.useDelayTime(model),
      ...Fields.useTimeoutAlarm(model),
      ...Fields.useDatasource(model),
      ...Fields.useSqlCheck(model),
      Fields.usePreTasks()
    ] as IJsonItem[],
    model
  }
}
