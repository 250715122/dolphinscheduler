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

import { axios } from '@/service/service'

export interface RecycleItem {
  id: number
  workflowCode: string
  workflowName: string
  projectCode: string
  description?: string
  taskCount: number
  deleteTime: string
  expireTime: string
  remainingDays: number
}

export function queryWorkflowRecycle(
  projectCode: number | string,
  params: { pageNo: number; pageSize: number; searchVal?: string }
): Promise<{
  retentionDays: number
  page: { totalList: RecycleItem[]; total: number }
}> {
  return axios({
    url: `/projects/${projectCode}/workflow-recycle`,
    method: 'get',
    params
  }) as any
}

export function restoreWorkflowRecycle(
  projectCode: number | string,
  id: number
): any {
  return axios({
    url: `/projects/${projectCode}/workflow-recycle/${id}/restore`,
    method: 'post'
  })
}

export function purgeWorkflowRecycle(
  projectCode: number | string,
  id: number
): any {
  return axios({
    url: `/projects/${projectCode}/workflow-recycle/${id}`,
    method: 'delete'
  })
}

export function getRecycleRetention(): Promise<{ retentionDays: number }> {
  return axios({
    url: '/system-settings/workflow-recycle',
    method: 'get'
  }) as any
}

export function updateRecycleRetention(retentionDays: number): any {
  return axios({
    url: '/system-settings/workflow-recycle',
    method: 'put',
    data: { retentionDays }
  })
}
