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

import { Ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCustomCellBuilder } from './dag-hooks'
import type { Graph } from '@antv/x6'
import { WorkflowDefinition } from './types'

interface Options {
  graph: Ref<Graph | undefined>
  definition: Ref<WorkflowDefinition | undefined>
}

/**
 * Backfill workflow into graph
 */
export function useGraphBackfill(options: Options) {
  const { graph, definition } = options
  const route = useRoute()

  const { buildGraph } = useCustomCellBuilder()

  // Deep link from global task search: ?taskCode=xxx selects and centers that node once.
  let focused = false
  const focusTaskFromQuery = () => {
    const code = route.query.taskCode
    if (focused || !code || !graph.value) return
    const cell = graph.value.getCellById(String(code))
    if (!cell) return
    focused = true
    graph.value.cleanSelection()
    graph.value.select(cell)
    graph.value.scrollToCell(cell, { animation: { duration: 600 } })
  }

  watch([graph, definition], () => {
    if (graph.value && definition.value) {
      graph.value.fromJSON(buildGraph(definition.value))
      focusTaskFromQuery()
    }
  })

  return {}
}
