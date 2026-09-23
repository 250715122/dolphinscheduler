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

import { defineComponent, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  NButton,
  NSelect,
  NDatePicker,
  NSpin,
  NSwitch
} from 'naive-ui'
import { useDashboard } from '@/views/home/composables/use-dashboard'
import MetricCard from '@/views/home/components/metric-card'
import InstanceWorkbench from '@/views/home/components/instance-workbench'
import UpcomingSchedules from '@/views/home/components/upcoming-schedules'
import ServiceSummary from '@/views/home/components/service-summary'
import TrendPanel from '@/views/home/components/trend-panel'
import DurationRank from '@/views/home/components/duration-rank'
import styles from '@/views/home/styles/dashboard.module.scss'
import { useThemeStore } from '@/store/theme/theme'
import type { MetricCardModel, TimePreset } from '@/views/home/types/dashboard'

const ProjectOverview = defineComponent({
  name: 'project-overview',
  setup() {
    const route = useRoute()
    const themeStore = useThemeStore()
    const dash = useDashboard({
      mode: 'project',
      fixedProjectCode: () => Number(route.params.projectCode),
      fixedProjectName: () => String(route.query.projectName || '')
    })

    watch(
      () => [route.params.projectCode, route.query.projectName],
      () => {
        dash.scope.projectCode = Number(route.params.projectCode) || null
        dash.scope.projectName = String(route.query.projectName || '')
        dash.refresh()
      }
    )

    return { ...dash, themeStore }
  },
  render() {
    const {
      t,
      scope,
      loading,
      asOf,
      metrics,
      workbenchTab,
      instances,
      instanceTotal,
      instancePage,
      instancePageSize,
      schedules,
      scheduleTotal,
      schedulePage,
      schedulePageSize,
      service,
      keyword,
      trendPoints,
      trendMode,
      durationPageRows,
      durationTotal,
      durationPage,
      durationPageSize,
      refresh,
      setPreset,
      onMetricClick,
      openInstance,
      openMonitor,
      hasAuthorizedProjects,
      showService
    } = this

    const presetOptions: Array<{ label: string; value: TimePreset }> = [
      { label: t('home.ops_preset_1h'), value: '1h' },
      { label: t('home.ops_preset_24h'), value: '24h' },
      { label: t('home.ops_preset_today'), value: 'today' },
      { label: t('home.ops_preset_7d'), value: '7d' },
      { label: t('home.ops_preset_custom'), value: 'custom' }
    ]

    const scopeHint =
      workbenchTab === 'running' || workbenchTab === 'waiting'
        ? t('home.ops_scope_snapshot')
        : t('home.ops_scope_period')

    return (
      <div
        class={[
          styles.page,
          this.themeStore.darkTheme ? styles.pageDark : null
        ]}
      >
        <div class={styles.header}>
          <div class={styles.headerTop}>
            <h1 class={styles.title}>
              {t('home.ops_project_title', {
                name: scope.projectName || t('home.ops_project_fallback')
              })}
            </h1>
            <div class={styles.headerMeta}>
              {showService && (
                <ServiceSummary
                  model={service}
                  compact
                  onOpen={openMonitor}
                />
              )}
              <span>
                {t('home.ops_updated_short')} {asOf || '—'}
              </span>
              <span style='display:inline-flex;align-items:center;gap:6px'>
                {t('home.ops_auto_refresh')}
                <NSwitch
                  size='small'
                  value={scope.autoRefreshSec > 0}
                  onUpdateValue={(v: boolean) => {
                    scope.autoRefreshSec = v ? 300 : 0
                  }}
                />
              </span>
              <NButton size='small' loading={loading} onClick={() => refresh()}>
                {t('home.ops_refresh')}
              </NButton>
            </div>
          </div>
          <div class={styles.headerFilters}>
            <span class={styles.headerMeta} style='margin-right:8px'>
              {t('home.ops_project_locked')}:{' '}
              {scope.projectName || scope.projectCode}
            </span>
            <NSelect
              style='width: 130px'
              size='small'
              value={scope.timePreset}
              options={presetOptions}
              onUpdateValue={(v: TimePreset) => setPreset(v)}
            />
            <NDatePicker
              size='small'
              type='datetimerange'
              clearable={false}
              style='width: 320px'
              value={scope.dateRange}
              onUpdateValue={(v: [number, number] | null) => {
                if (!v) return
                scope.timePreset = 'custom'
                scope.dateRange = v
              }}
            />
          </div>
        </div>

        <div class={styles.contentGrow}>
          <NSpin show={loading} class={styles.spinFill}>
            {!hasAuthorizedProjects ? (
              <div class={styles.card} style='margin-bottom:12px'>
                <div class={styles.emptyHint}>
                  {t('home.ops_no_project_access')}
                </div>
              </div>
            ) : null}

            <div
              class={styles.metricRow}
              style={
                !hasAuthorizedProjects
                  ? 'opacity:0.45;pointer-events:none'
                  : undefined
              }
            >
              <div class={styles.metricGrid}>
                {metrics.map((m: MetricCardModel) => (
                  <MetricCard
                    model={m}
                    active={
                      !!m.clickTab &&
                      workbenchTab === m.clickTab &&
                      (!m.entityType || scope.entityType === m.entityType)
                    }
                    onClick={(card: MetricCardModel) => onMetricClick(card)}
                  />
                ))}
              </div>
            </div>

            <div class={styles.mainGrid}>
              <div class={styles.colWorkbench}>
                <InstanceWorkbench
                  tab={workbenchTab}
                  rows={instances}
                  total={instanceTotal}
                  page={instancePage}
                  pageSize={instancePageSize}
                  loading={loading}
                  keyword={keyword}
                  scopeHint={scopeHint}
                  entityLabel={
                    workbenchTab === 'workflow' ||
                    scope.entityType === 'WORKFLOW'
                      ? t('home.ops_entity_workflow')
                      : t('home.ops_entity_task')
                  }
                  onUpdateKeyword={(v: string) => {
                    this.keyword = v
                  }}
                  onUpdate:page={(p: number) => (this.instancePage = p)}
                  onOpen={openInstance}
                />
              </div>
              <div class={styles.colUpcoming}>
                <UpcomingSchedules
                  rows={schedules}
                  total={scheduleTotal}
                  page={schedulePage}
                  pageSize={schedulePageSize}
                  onUpdate:page={(p: number) => (this.schedulePage = p)}
                />
              </div>
              <div class={styles.colDuration}>
                <DurationRank
                  rows={durationPageRows}
                  total={durationTotal}
                  page={durationPage}
                  pageSize={durationPageSize}
                  loading={loading}
                  onUpdate:page={(p: number) => (this.durationPage = p)}
                  onOpen={openInstance}
                />
              </div>
            </div>

            <div class={styles.trendBottom}>
              <TrendPanel
                points={trendPoints}
                mode={trendMode}
                onUpdate:mode={(m: any) => (this.trendMode = m)}
              />
            </div>
          </NSpin>
        </div>
      </div>
    )
  }
})

export default ProjectOverview
