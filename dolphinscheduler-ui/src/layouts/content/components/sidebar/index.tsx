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

import { defineComponent, ref, PropType, h } from 'vue'
import { NLayoutSider, NMenu, NButton, NIcon, NTooltip } from 'naive-ui'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@vicons/antd'
import { useI18n } from 'vue-i18n'
import { useMenuClick } from './use-menuClick'
import styles from './index.module.scss'

const SIDEBAR_WIDTH = 240
const SIDEBAR_COLLAPSED_WIDTH = 64

const Sidebar = defineComponent({
  name: 'Sidebar',
  props: {
    sideMenuOptions: {
      type: Array as PropType<any>,
      default: []
    },
    sideKey: {
      type: String as PropType<string>,
      default: ''
    }
  },
  setup() {
    const collapsedRef = ref(false)
    const defaultExpandedKeys = [
      'workflow',
      'task',
      'service-manage',
      'statistical-manage',
      'task-group-manage'
    ]

    const { t } = useI18n()
    const { handleMenuClick } = useMenuClick()

    const toggleCollapsed = () => {
      collapsedRef.value = !collapsedRef.value
    }

    return {
      collapsedRef,
      defaultExpandedKeys,
      handleMenuClick,
      toggleCollapsed,
      t
    }
  },
  render() {
    const collapseIcon = this.collapsedRef
      ? MenuUnfoldOutlined
      : MenuFoldOutlined
    const collapseTip = this.collapsedRef
      ? this.t('menu.expand_sidebar')
      : this.t('menu.collapse_sidebar')

    return (
      <NLayoutSider
        bordered
        nativeScrollbar={false}
        collapse-mode='width'
        collapsed={this.collapsedRef}
        width={SIDEBAR_WIDTH}
        collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
        onCollapse={() => (this.collapsedRef = true)}
        onExpand={() => (this.collapsedRef = false)}
      >
        <div
          class={[
            styles['collapse-bar'],
            this.collapsedRef ? styles['collapse-bar-collapsed'] : null
          ]}
        >
          <NTooltip placement='right' trigger='hover'>
            {{
              trigger: () => (
                <NButton
                  quaternary
                  circle
                  size='small'
                  aria-label={collapseTip}
                  onClick={this.toggleCollapsed}
                >
                  {{
                    icon: () =>
                      h(NIcon, { size: 18 }, {
                        default: () => h(collapseIcon)
                      })
                  }}
                </NButton>
              ),
              default: () => collapseTip
            }}
          </NTooltip>
        </div>
        <NMenu
          class='tab-vertical'
          value={this.sideKey}
          options={this.sideMenuOptions}
          defaultExpandedKeys={this.defaultExpandedKeys}
          collapsed={this.collapsedRef}
          collapsedWidth={SIDEBAR_COLLAPSED_WIDTH}
          collapsedIconSize={22}
          onUpdateValue={this.handleMenuClick}
        />
      </NLayoutSider>
    )
  }
})

export default Sidebar
