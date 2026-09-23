# 计划：将历史「数据质量 / 质量监控」合并回本项目（3.4.1 / feat/local-dev）

## 背景结论

| 项 | 结论 |
|---|---|
| 官方移除版本 | **3.3.0**（[DSIP-78](https://github.com/apache/dolphinscheduler/issues) / PR [#16794](https://github.com/apache/dolphinscheduler/pull/16794)） |
| 仍含完整模块的最后正式版 | **3.2.2**（tag `3.2.2`，含 `dolphinscheduler-data-quality` + task/UI/API/表结构） |
| 推荐移植基线 | **Apache DS 3.2.2**（功能最完整且是移除前最后稳定发布；比 3.1.x 更接近 3.4 的任务插件体系） |
| 社区态度 | 内置 DQ 维护成本高、有安全/发布阻塞；建议插件化或外部方案；官方关闭相关 bug 时指向商业产品 |

本仓库当前为 **3.4.1 + 本地增强**，树内已无 DQ 模块；升级脚本在 3.3.0 schema 中 **DROP** 了 8 张 `t_ds_dq_*` 表。

## 3.2.2 中 DQ 能力组成（移植范围）

1. **Spark 执行引擎**：`dolphinscheduler-data-quality/`（`DataQualityApplication` + Reader/Transformer/Writer）
2. **任务插件**：`dolphinscheduler-task-plugin/dolphinscheduler-task-dataquality/`（Worker 侧拉起 Spark DQ）
3. **API**：`DataQualityController` + Service/Mapper（规则 CRUD、执行结果查询）
4. **元数据表**：`t_ds_dq_rule`、`t_ds_dq_execute_result`、`t_ds_dq_comparison_type`、`t_ds_dq_rule_execute_sql`、`t_ds_dq_rule_input_entry`、`t_ds_dq_task_statistics_value`、两张 relation 表
5. **UI**：数据质量菜单 + 规则配置 + 任务节点「数据质量」表单（`format-data.ts` 等）
6. **Master 辅助**：`DataQualityResultOperator`（结果回写/告警衔接）
7. **文档**：`docs/docs/zh|en/guide/data-quality.md`

依赖前提（部署侧）：Worker 可提交 **Spark** 作业；`common.properties` 中 `data-quality.jar.dir`（3.2 曾改名）；结果库写回权限。

## 为何选 3.2.2 而非更早版本

- 3.2.x 已完成与当时 task-plugin / UI（Vue3）较完整的集成。
- 3.2.2 是 3.3 删除前的最后 GA；规则类型与 UI 问题在 3.2.x 仍有社区反馈，说明该版是「仍在用」的成熟形态。
- 直接从 3.0/3.1 搬，与 3.4 的 `workflow` 命名、SPI、鉴权差异更大，合并成本更高。

## 合并策略（建议分阶段）

### Phase 0 — 调研冻结（本阶段）

- [x] 确认移除点与推荐基线 tag `3.2.2`
- [ ] 列出 3.2.2 → 3.4.1 包名/API 冲突清单（`process`→`workflow`、DAO 插件化、Spring Boot 版本、UI 路由）
- [ ] 确认现网是否仍依赖 Spark / 是否接受「仅 JDBC 规则、无 Spark」的裁剪方案

### Phase 1 — 元数据与 API 最小闭环

1. 从 `3.2.2` 恢复 DQ 表的 **init + upgrade** SQL（注意：勿与 3.3.0 的 DROP 脚本打架，应新增 `3.4.1_local_dq` 升级目录）。
2. 移植 Mapper/Service/Controller；适配 3.4 的鉴权与 `projectCode` 路由。
3. 冒烟：规则 CRUD、结果列表 API。

### Phase 2 — 任务插件 + Spark 引擎

1. 恢复 `dolphinscheduler-task-dataquality` 与 `dolphinscheduler-data-quality` 模块进 BOM/装配。
2. 适配 3.4 Worker 任务 SPI（`ShellCommandExecutor` 重构、类路径）。
3. 打 DQ fat jar，配置 `data-quality.jar.dir`；在测试机跑一条「空值率/表行数」规则。

### Phase 3 — UI「质量监控」

1. 从 3.2.2 UI 移植数据质量页面与任务节点表单到当前 `dolphinscheduler-ui`。
2. 菜单、i18n、与项目侧栏对齐；修复已知问题（如 `logic_operator` 未提交，#16960）。
3. 与现有「运行总览」可后续做结果入口联动（非必须）。

### Phase 4 — 加固

- 告警：规则失败 → 可读告警（复用当前 WorkflowAlertManager 风格）
- 权限、多租户、SQL 注入审查（社区移除原因之一）
- 文档与测试环境部署说明

## 风险与备选

| 风险 | 缓解 |
|---|---|
| Spark/Hadoop 环境缺失 | Phase 2 可先做「SQL 规则在 Worker 直连 JDBC 执行」轻量实现，引擎后补 |
| 与 3.4 引擎不兼容 | 任务插件隔离模块，失败不影响主链路 |
| 社区不再维护 | 代码进本 fork 长期自维；保持与 tag 3.2.2 的可追溯 cherry-pick 记录 |
| 官方建议插件/外部 DQ | 若工期紧，可评估 DataQuality 外部引擎 + DS 只做调度封装（工作量可能更小） |

## 初步工作量（粗估）

- Phase 1：3–5 人日  
- Phase 2：5–10 人日（视 Spark 环境）  
- Phase 3：4–7 人日  
- Phase 4：2–4 人日  

## 下一步（需你确认后开工）

1. 是否接受 **以 3.2.2 为唯一移植基线**？  
2. 测试/生产是否具备 **Spark**？若无，是否先做 JDBC 轻量版？  
3. 目标形态：完整「质量监控」菜单，还是仅「数据质量任务节点」？

