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

import { defineComponent, h, unref } from 'vue'
import { NSelect } from 'naive-ui'
import { isFunction } from 'lodash'
import type { IJsonItem } from '../types'

export function renderSelect(
  item: IJsonItem,
  fields: { [field: string]: any }
) {
  return h(
    defineComponent({
      name: 'FormSelect',
      setup() {
        return () => {
          const merged = isFunction(item) ? item() : item
          const { props = {}, field, options = [] } = merged
          return h(NSelect, {
            ...props,
            value: fields[field],
            onUpdateValue: (value: any) => {
              void (fields[field] = value)
              if (props?.onUpdateValue) props.onUpdateValue(value)
            },
            options: unref(options)
          })
        }
      }
    })
  )
}
