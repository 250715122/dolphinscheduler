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

// Distilled from 《DolphinScheduler任务开发规范 v1.1》: conclusions only, no research narrative.
// level: M = 强制 (blocks go-live), R = 推荐

export interface SpecRule {
  level: 'M' | 'R'
  text: string
}

export interface SpecSection {
  key: string
  title: string
  intro?: string
  rules: SpecRule[]
  table?: { head: string[]; rows: string[][] }
}

export const specSections: SpecSection[] = [
  {
    key: 'naming',
    title: '命名',
    rules: [
      { level: 'M', text: '项目、工作流、任务节点、参数名只用小写字母、数字、下划线，字母开头，长度 ≤ 64；禁止中文、【】、连字符、空格、大写。中文说明写在 description。' },
      { level: 'M', text: '名字里不写环境（test/prod/测试/生产），开发与生产同名；也不写周期（hourly/daily），周期由 crontab 表达。' },
      { level: 'M', text: '禁止无语义名：裸层名（ods、dwd）、quality、test、aaa、zz_*、IP 地址作节点名。' },
      { level: 'M', text: '产出表的工作流：工作流名 = 目标表名（不带库名），加工节点名 = 目标表名。' },
      { level: 'M', text: '不落表的作业用固定前缀：dq_ 数据质量、mon_ 系统监控、sync_ 向外输出、master_ 总控重跑、tmp_YYYYMMDD_ 临时（到期必须清理）。' },
      { level: 'M', text: '发版/部署类作业不进 DS，应走 CI/CD。' },
      { level: 'M', text: '任务内临时表命名 _tmp_<目标表名>_<用途>，按目标表隔离，避免并行工作流互相 DROP。' },
      { level: 'R', text: '使用英文全称或约定缩写，不用拼音。' }
    ],
    table: {
      head: ['场景', '命名', '示例'],
      rows: [
        ['日常加工', '<表名>', 'ads_hems_device_report_day'],
        ['重算近 N 天兜迟到', '<表名>_repair', 'ods_iot_data_raw_hour_repair'],
        ['历史回补（不建调度）', '<表名>_backfill', 'ads_xxx_backfill'],
        ['对数补数', '<表名>_fix', 'ods_xxx_fix'],
        ['维护（压缩、清理）', '<表名>_compact / _cleanup', 'ods_iot_data_raw_ops_compact'],
        ['依赖等待节点', '固定 wait_upstream', 'wait_upstream'],
        ['内嵌质量校验节点', 'dq_<表名>', 'dq_ads_hems_device_report_day']
      ]
    }
  },
  {
    key: 'project',
    title: '项目划分',
    rules: [
      { level: 'M', text: '项目 = 业务域，项目名用英文域代号，中文名写在项目描述里。' },
      { level: 'M', text: 'ads_<域>_* 只能在同名项目里产出，看表名即可定位项目。' },
      { level: 'M', text: '跨项目依赖用 DEPENDENT，禁止把上游工作流复制到本项目。' },
      { level: 'M', text: '开发与生产的项目名、工作流名、节点名、参数名保持一致，环境差异只体现在数据源。' },
      { level: 'R', text: '只被一个域使用的 ODS/DWS 跟随该业务项目；被第二个域复用时迁入公共层 dw。' }
    ]
  },
  {
    key: 'structure',
    title: '工作流结构与任务类型',
    rules: [
      { level: 'M', text: '一个工作流只产出一张目标表（多表强耦合例外，须在 description 写明理由）。' },
      { level: 'M', text: '有 DS 内上游的工作流，首节点为唯一的 wait_upstream。' },
      { level: 'M', text: '禁止单一大 DAG 串全层；禁止用 SUB_PROCESS 串联日常链路（仅 master_ 工作流可用）。' },
      { level: 'M', text: '写同一目标表的工作流执行策略设为串行等待（SERIAL_WAIT），防止并发写；高频任务尤其注意。' },
      { level: 'M', text: 'SHELL 节点首行 set -euo pipefail；只靠退出码不够的工具要同时 grep 日志判定。' },
      { level: 'R', text: '节点只做一件事：抽数、加工、校验、推进水位分节点，失败可单独重跑。' },
      { level: 'R', text: '失败策略默认 END；节点间确实独立（如多表同步）才用 CONTINUE，并在 description 说明。' },
      { level: 'R', text: '库内 SQL 优先用 SQL 节点 + DS 数据源；复杂逻辑调用受版本管理的固定目录脚本，禁止节点内嵌上百行脚本。' }
    ]
  },
  {
    key: 'time',
    title: '时间参数',
    rules: [
      { level: 'M', text: '禁止用 now()、current_date()、curdate() 判断业务时间，一律用 DS 调度时间参数，否则补数会算成执行当天的数据（create_time/update_time 审计时间可用 NOW()）。' },
      { level: 'M', text: '时间窗口一律左闭右开 [start, end)。' },
      { level: 'M', text: '参数值已带 00:00:00 时，SQL 里只写 \'${param}\'，不再拼时分秒。' },
      { level: 'M', text: 'DS 调度时区统一 Asia/Shanghai；按设备当地时区统计的口径在 SQL 内显式换算并注释。' },
      { level: 'R', text: '参数放节点 localParams；多节点共用的放 globalParams。' }
    ],
    table: {
      head: ['参数名', '取值', '语义'],
      rows: [
        ['biz_date', '$[yyyy-MM-dd-1]', '天任务业务日期（昨天）'],
        ['snapshot_date', '$[yyyy-MM-dd]', '快照日期（当天）'],
        ['start_time / end_time', '$[yyyy-MM-dd HH-1/24]:00:00 / $[yyyy-MM-dd HH]:00:00', '小时任务加工窗口，左闭右开'],
        ['sched_time', '$[yyyy-MM-dd HH:mm:ss]', '调度时间本身（水位增量类）'],
        ['lookback_start', '$[yyyy-MM-dd-1]', '迟到回看下限']
      ]
    }
  },
  {
    key: 'idempotent',
    title: '幂等与 SQL',
    rules: [
      { level: 'M', text: '同一窗口重跑任意次，结果必须一致。三选一：主键表 upsert；INSERT OVERWRITE 指定分区；同节点内先 DELETE 窗口再 INSERT。' },
      { level: 'M', text: 'StarRocks 无 PARTITION 子句的 INSERT OVERWRITE 须先 SET dynamic_overwrite = true，否则会清空全表。' },
      { level: 'M', text: '禁止位置式 INSERT，必须写 INSERT INTO t (列清单) SELECT ...；目标表加列必须同步修改 DS 中的 SQL。' },
      { level: 'M', text: '主键表 partial update 必须 JOIN 目标表主键，否则会插入残行；上游可能重复时先去重或先聚合。' },
      { level: 'M', text: '禁止 SELECT * 写入目标表；禁止无分区/时间条件扫描大表；一个 SQL 节点只写一个目标表。' },
      { level: 'M', text: 'SQL 文件头注释：目标表、来源表、粒度、口径要点、参数说明、作者/日期。' },
      { level: 'R', text: '高频增量用水位表 etl_*_watermark，水位推进放最后一个节点，前序失败不推进。' },
      { level: 'R', text: '上线前 EXPLAIN 确认分区裁剪生效；单位（kW/MW）、精度、正负含义写进表 COMMENT。' }
    ]
  },
  {
    key: 'dependency',
    title: '依赖',
    rules: [
      { level: 'M', text: '表间血缘用 DEPENDENT 表达，禁止靠 crontab 错峰来猜上游完成。' },
      { level: 'M', text: '每个工作流至多一个 wait_upstream 且放首位；多个上游放在同一节点内 AND 组合，不要串联多个 DEPENDENT。' },
      { level: 'M', text: '依赖周期要与两端调度周期对齐（见下表）。最常见的错：上游在同一天更早时刻跑，却用了 last1Days。' },
      { level: 'M', text: 'DEPENDENT 节点：重试 0；超时开启且策略为 WARNFAILED（只用 WARN 时补数会无声干等）。' },
      { level: 'M', text: '失败策略 DEPENDENT_FAILURE_WAITING，等待时间为正整数（小时链路 20~30 分钟，不能跨过下一周期；天链路 60 分钟）。' },
      { level: 'M', text: '上游在 DS 之外（Flink、外部库、API）的，description 写明来源，并配就绪检查兜底。' },
      { level: 'R', text: '依赖到任务级；上游拆分/重建导致任务 code 变化后必须同步更新依赖。' }
    ],
    table: {
      head: ['场景', 'cycle + dateValue'],
      rows: [
        ['小时 ← 小时', 'hour + currentHour'],
        ['天 ← 同一天更早时刻的天任务', 'day + today'],
        ['天 ← 昨天的天任务', 'day + last1Days'],
        ['天 ← 小时（昨天 24 个实例全成功）', 'day + last1Days']
      ]
    }
  },
  {
    key: 'runtime',
    title: '重试、超时、告警',
    rules: [
      { level: 'M', text: '非 DEPENDENT 节点必须开启超时，超时值按近 7 天 P95 耗时 × 3 设置；高频任务（≤ 15 分钟）超时必须小于调度周期。' },
      { level: 'M', text: '有调度的工作流告警类型必须为 FAILURE 或 ALL，禁止 NONE，告警组不能为空。' },
      { level: 'M', text: '工作流启动参数与调度（schedule）两处告警都要配：手动触发看前者，定时触发看后者。' },
      { level: 'R', text: '默认重试：ODS 同步 2 次（间隔 1~3 分钟）、SQL 加工 1 次（间隔 1~5 分钟）、dq_ 与 mon_ 0 次、_backfill 2 次。' },
      { level: 'R', text: '任务优先级：线上加工 MEDIUM，回补 LOW，确需插队才用 HIGH。' }
    ]
  },
  {
    key: 'dq',
    title: '数据质量',
    rules: [
      { level: 'R', text: '被下游或外部应用使用的表，至少配主键唯一、产出行数 > 0 两条强规则。' },
      { level: 'M', text: '校验 SQL 返回违规行数，> 0 即 exit 1；校验同样使用调度时间参数，可补数。' },
      { level: 'R', text: '强规则（失败阻断下游）放在加工节点之后，节点名 dq_<表名>；弱规则（只告警）用于波动类检查。' },
      { level: 'R', text: '对外提供服务的表配就绪检查：最新分区是否按时到达、最近 N 个点是否全为空。数据没到不等于任务失败。' }
    ]
  },
  {
    key: 'backfill',
    title: '补数与迟到数据',
    rules: [
      { level: 'M', text: '补数先上游后下游分两次发起；级联补数前确认下游全部幂等。' },
      { level: 'M', text: '_backfill 工作流不建调度；长跨度回补串行（并行度 1）、业务低峰执行。' },
      { level: 'M', text: '迟到数据：小时任务取最近 N 小时窗口，另建 _repair 工作流重算近 1~3 天，不要在日常工作流里加分支。' },
      { level: 'M', text: '与上游约定迟到范围并写进 description；超出约定的历史补采按人工补数处理。' },
      { level: 'M', text: '修改工作流定义前先确认没有运行中或补数中的实例，下线会打断它们。' }
    ]
  },
  {
    key: 'release',
    title: '发布与变更',
    rules: [
      { level: 'M', text: '工作流即代码：SQL、脚本、结构入 Git；生产禁止在界面直接改 SQL，紧急修复后 24 小时内回写 Git。' },
      { level: 'M', text: '先开发后生产，两边名称、参数一致，只有数据源不同。' },
      { level: 'M', text: '更新工作流须先下线（会连带下线调度）；部署后必须核对工作流与调度都已重新上线。' },
      { level: 'M', text: '避开调度触发时刻变更（下线期间错过的触发不会补跑）。' },
      { level: 'M', text: '拆分/重构：先建新、验证一个批次、再下线旧，不留空窗。改名就地修改以保留工作流 code 与历史实例。' },
      { level: 'M', text: '下线后先保留观察不少于 7 天再删除；已删除的工作流可在项目管理的回收站中恢复。' }
    ]
  },
  {
    key: 'security',
    title: '安全与运维',
    rules: [
      { level: 'M', text: '密码、AK/SK 不得明文出现在节点脚本或 description；SQL 用 DS 数据源，脚本读 worker 本地 chmod 600 的凭据文件。' },
      { level: 'M', text: '生产任务用专用账号，不用 root。' },
      { level: 'M', text: '失败告警当天处理；同一任务连续 3 次失败须记录根因。' },
      { level: 'M', text: 'tmp_ 作业、_tmp_ 孤儿表、到期 bak_ 表定期清理；备份表命名 bak_YYYYMMDD_<原表名>，保留 ≤ 30 天。' },
      { level: 'R', text: '工作流与任务实例保留 90 天并定期清理；每月全量盘点一次违规项。' }
    ]
  }
]

export const checklist: string[] = [
  '命名符合规范，所在项目与业务域一致',
  'description 含：中文名、产出表、来源、口径要点、上游/迟到约定、负责人',
  '无 now() 参与业务时间判断；窗口左闭右开；INSERT 带显式列清单',
  '同一窗口重跑两次结果一致；补数 1 天结果正确',
  '有 DS 内上游的已配 wait_upstream，周期对齐，超时策略 WARNFAILED',
  '重试、超时、告警组已配（工作流定义与调度两处）',
  '写同一张表的工作流为串行等待（SERIAL_WAIT）',
  '凭据未明文；生产未使用 root',
  '代码已入 Git，部署脚本可重放'
]

export const pitfalls: Array<[string, string]> = [
  ['更新工作流须先下线，DS 连带下线调度', '部署后无条件核对并恢复调度为上线'],
  ['位置式 INSERT 在加列后报列数不匹配', '写显式列清单'],
  ['主键表整行 upsert 会把未列出的列置 NULL', '加列同步改 SQL'],
  ['同名临时表被并行工作流互删', '临时表名带目标表名'],
  ['DEPENDENT 判定上游 FAILED 后即冻结', '上游修复后连同下游一起重跑'],
  ['无 PARTITION 子句的 INSERT OVERWRITE 清空全表', 'SET dynamic_overwrite = true'],
  ['ROUND / GREATEST(x,0) 把小负荷值压成 0', '不随意截断精度与符号'],
  ['分区表主键必须包含分区列', 'PRIMARY KEY(id, collect_time)'],
  ['任务成功但上游停写，产出全为空', '配置就绪检查']
]
