
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

import { defineComponent } from 'vue'
import {
  NButton,
  NDatePicker,
  NSelect,
  NSpin,
  NSwitch
} from 'naive-ui'
import { useDashboard } from './composables/use-dashboard'
import MetricCard from './components/metric-card'
import InstanceWorkbench from './components/instance-workbench'
import UpcomingSchedules from './components/upcoming-schedules'
import ServiceSummary from './components/service-summary'
import DefinitionCard from './components/definition-card'
import { GROUP_COLORS } from './adapters/status-groups'
import styles from './styles/dashboard.module.scss'
import type { MetricCardModel, TimePreset } from './types/dashboard'

export default defineComponent({
  name: 'home',
  setup() {
    return useDashboard()
  },
  render() {
    const {
      t,
      scope,
      projects,
      loading,
      asOf,
      metrics,
      statusChips,
      compactMode,
      workbenchTab,
      instances,
      instanceTotal,
      schedules,
      service,
      keyword,
      refresh,
      setPreset,
      setTab,
      openInstance,
      openMonitor,
      periodTotal
    } = this

    const projectOptions = [
      { label: t('home.ops_all_projects'), value: null as any },
      ...projects
    ]

    const presetOptions: Array<{ label: string; value: TimePreset }> = [
      { label: t('home.ops_preset_1h'), value: '1h' },
      { label: t('home.ops_preset_24h'), value: '24h' },
      { label: t('home.ops_preset_today'), value: 'today' },
      { label: t('home.ops_preset_7d'), value: '7d' },
      { label: t('home.ops_preset_custom'), value: 'custom' }
    ]

    const tabCounts = {
      failure: metrics.find((m: MetricCardModel) => m.key === 'failure')?.value,
      running: metrics.find((m: MetricCardModel) => m.key === 'running')?.value,
      waiting: metrics.find((m: MetricCardModel) => m.key === 'waiting')?.value,
      all: periodTotal
    }

    const scopeHint =
      workbenchTab === 'running' || workbenchTab === 'waiting'
        ? t('home.ops_scope_snapshot')
        : t('home.ops_scope_period')

    return (
      <div class={styles.page}>
        <div class={styles.header}>
          <div>
            <h1 class={styles.title}>{t('home.ops_title')}</h1>
            <p class={styles.subtitle}>{t('home.ops_subtitle')}</p>
          </div>
          <div class={styles.headerMeta}>
            <span>
              {t('home.ops_updated_at')} {asOf || '—'}
            </span>
            <span style='display:inline-flex;align-items:center;gap:6px'>
              {t('home.ops_auto_refresh')}
              <NSwitch
                size='small'
                value={scope.autoRefreshSec > 0}
                onUpdateValue={(v: boolean) => {
                  scope.autoRefreshSec = v ? 30 : 0
                }}
              />
            </span>
            <NButton size='small' loading={loading} onClick={() => refresh()}>
              {t('home.ops_refresh')}
            </NButton>
          </div>
        </div>

        <div class={styles.filterBar}>
          <NSelect
            style='width: 200px'
            size='small'
            value={scope.projectCode as any}
            options={projectOptions}
            onUpdateValue={(v: number | null) => {
              scope.projectCode = v
              scope.projectName =
                projects.find((p: any) => p.value === v)?.label || ''
            }}
          />
          <NSelect
            style='width: 150px'
            size='small'
            value={scope.entityType}
            options={[
              { label: t('home.ops_entity_workflow'), value: 'WORKFLOW' },
              { label: t('home.ops_entity_task'), value: 'TASK' }
            ]}
            onUpdateValue={(v: 'WORKFLOW' | 'TASK') => {
              scope.entityType = v
            }}
          />
          <NSelect
            style='width: 140px'
            size='small'
            value={scope.timePreset}
            options={presetOptions}
            onUpdateValue={(v: TimePreset) => setPreset(v)}
          />
          <NDatePicker
            size='small'
            type='datetimerange'
            clearable={false}
            value={scope.dateRange}
            onUpdateValue={(v: [number, number] | null) => {
              if (!v) return
              scope.timePreset = 'custom'
              scope.dateRange = v
            }}
          />
        </div>

        <NSpin show={loading}>
          <div class={styles.metricGrid}>
            {metrics.map((m: MetricCardModel) => (
              <MetricCard
                model={m}
                active={!!m.clickTab && workbenchTab === m.clickTab}
                onClick={(card: MetricCardModel) => {
                  if (card.clickTab) setTab(card.clickTab)
                }}
              />
            ))}
          </div>

          <div class={styles.statusSummary} style='margin-bottom:16px'>
            {statusChips.map((chip: { key: keyof typeof GROUP_COLORS; count: number }) => (
              <span class={styles.statusChip}>
                <i
                  class={styles.statusDot}
                  style={`background:${GROUP_COLORS[chip.key]}`}
                />
                {t(`home.ops_group_${chip.key}`)} {chip.count}
              </span>
            ))}
            {compactMode && (
              <span class={styles.statusChip} style='color:var(--ops-text-muted)'>
                {t('home.ops_compact_hint')}
              </span>
            )}
          </div>

          <div class={styles.mainGrid}>
            <div class={styles.main}>
              <InstanceWorkbench
                tab={workbenchTab}
                counts={tabCounts as any}
                rows={instances}
                total={instanceTotal}
                loading={loading}
                keyword={keyword}
                scopeHint={scopeHint}
                entityLabel={
                  scope.entityType === 'WORKFLOW'
                    ? t('home.ops_entity_workflow')
                    : t('home.ops_entity_task')
                }
                onUpdateTab={(tab: any) => setTab(tab)}
                onUpdateKeyword={(v: string) => {
                  this.keyword = v
                }}
                onOpen={openInstance}
              />
            </div>
            <div class={styles.aside}>
              <UpcomingSchedules rows={schedules} />
              <ServiceSummary model={service} onOpen={openMonitor} />
            </div>
          </div>

          {!compactMode && (
            <div class={styles.bottomGrid}>
              <DefinitionCard title={t('home.workflow_definition_statistics')} />
            </div>
          )}
          {compactMode && periodTotal <= 5 && (
            <div class={styles.card}>
              <h3 class={styles.cardTitle}>{t('home.ops_trend')}</h3>
              <div class={styles.emptyHint}>{t('home.ops_trend_sparse')}</div>
            </div>
          )}
        </NSpin>
      </div>
    )
  }
})
