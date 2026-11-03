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

import { defineComponent, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NButton,
  NIcon,
  NModal,
  NTag,
  NTabs,
  NTabPane,
  NScrollbar,
  NInput
} from 'naive-ui'
import { FileTextOutlined } from '@vicons/antd'
import { specSections, checklist, pitfalls } from './spec-data'
import styles from './index.module.scss'

const DevSpec = defineComponent({
  name: 'DevSpec',
  setup() {
    const { t } = useI18n()
    const show = ref(false)
    const keyword = ref('')
    const tab = ref('naming')

    const kw = computed(() => keyword.value.trim().toLowerCase())
    const match = (s: string) => !kw.value || s.toLowerCase().includes(kw.value)

    const filteredSections = computed(() =>
      specSections
        .map((sec) => ({
          ...sec,
          rules: sec.rules.filter((r) => match(r.text) || match(sec.title))
        }))
        .filter((sec) => sec.rules.length > 0)
    )

    const renderRule = (level: 'M' | 'R', text: string, idx: number) => (
      <li key={idx} class={styles.rule}>
        <NTag
          size='small'
          bordered={false}
          type={level === 'M' ? 'error' : 'info'}
          style='flex:none;margin-right:8px'
        >
          {level === 'M' ? t('menu.dev_spec_must') : t('menu.dev_spec_should')}
        </NTag>
        <span>{text}</span>
      </li>
    )

    const renderTable = (head: string[], rows: string[][]) => (
      <table class={styles.table}>
        <thead>
          <tr>
            {head.map((h) => (
              <th>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr>
              {r.map((c) => (
                <td>
                  <code>{c}</code>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )

    return () => (
      <>
        <NButton quaternary onClick={() => (show.value = true)}>
          {{
            icon: () => (
              <NIcon size='16'>
                <FileTextOutlined />
              </NIcon>
            ),
            default: () => t('menu.dev_spec')
          }}
        </NButton>
        <NModal
          show={show.value}
          onUpdateShow={(v: boolean) => (show.value = v)}
          preset='card'
          title={t('menu.dev_spec_title')}
          style='width: min(980px, 94vw)'
          segmented={{ content: true }}
        >
          <div class={styles.tip}>
            {t('menu.dev_spec_tip')}
            <NTag size='small' bordered={false} type='error' style='margin:0 4px'>
              {t('menu.dev_spec_must')}
            </NTag>
            {t('menu.dev_spec_tip_must')}
            <NTag size='small' bordered={false} type='info' style='margin:0 4px'>
              {t('menu.dev_spec_should')}
            </NTag>
            {t('menu.dev_spec_tip_should')}
          </div>
          <NInput
            value={keyword.value}
            clearable
            size='small'
            placeholder={t('menu.dev_spec_search')}
            style='margin-bottom:10px'
            onUpdateValue={(v: string) => (keyword.value = v)}
          />
          {kw.value ? (
            <NScrollbar style='max-height: 62vh'>
              {filteredSections.value.length === 0 ? (
                <div class={styles.empty}>{t('menu.dev_spec_empty')}</div>
              ) : (
                filteredSections.value.map((sec) => (
                  <div class={styles.section}>
                    <h4>{sec.title}</h4>
                    <ul>{sec.rules.map((r, i) => renderRule(r.level, r.text, i))}</ul>
                  </div>
                ))
              )}
            </NScrollbar>
          ) : (
            <NTabs
              type='line'
              animated
              value={tab.value}
              onUpdateValue={(v: string) => (tab.value = v)}
            >
              {specSections.map((sec) => (
                <NTabPane name={sec.key} tab={sec.title}>
                  <NScrollbar style='max-height: 58vh'>
                    <ul class={styles.list}>
                      {sec.rules.map((r, i) => renderRule(r.level, r.text, i))}
                    </ul>
                    {sec.table ? renderTable(sec.table.head, sec.table.rows) : null}
                  </NScrollbar>
                </NTabPane>
              ))}
              <NTabPane name='checklist' tab={t('menu.dev_spec_checklist')}>
                <NScrollbar style='max-height: 58vh'>
                  <div class={styles.tip}>{t('menu.dev_spec_checklist_tip')}</div>
                  <ul class={styles.list}>
                    {checklist.map((c, i) => (
                      <li key={i} class={styles.rule}>
                        <span style='margin-right:8px'>☐</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </NScrollbar>
              </NTabPane>
              <NTabPane name='pitfalls' tab={t('menu.dev_spec_pitfalls')}>
                <NScrollbar style='max-height: 58vh'>
                  {renderTable(
                    [t('menu.dev_spec_pitfall'), t('menu.dev_spec_countermeasure')],
                    pitfalls.map((p) => [p[0], p[1]])
                  )}
                </NScrollbar>
              </NTabPane>
            </NTabs>
          )}
        </NModal>
      </>
    )
  }
})

export default DevSpec
