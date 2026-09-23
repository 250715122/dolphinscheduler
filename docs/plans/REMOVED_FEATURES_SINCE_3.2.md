# 自 3.2.x → 3.4.1 被移除/砍掉的类似能力（对照官方 incompatible）

来源：`docs/docs/en/guide/upgrade/incompatible.md`（upstream / 本仓库同源说明）。

## 与「平台能力模块」同类（优先关注）

| 能力 | 移除版本 | 说明 |
|---|---|---|
| **Data Quality（数据质量/质量监控）** | 3.3.0 | PR #16794；本计划见 `RESTORE_DATA_QUALITY.md` |
| **资源中心 UDF 管理（udf-manage）** | 3.3.0 | PR #16209 |
| **任务插件 Pigeon** | 3.3.0 | PR #16218 |
| **任务插件 Dynamic** | 3.3.0 | PR #16482 / #16842；后续 3.4.3 清理遗留 API |
| **任务插件 Pytorch** | 3.4.0 | PR #17808 |
| **工作流定义导入/导出** | 3.4.1 | Issue #17940 |

## 偏重构/配置，不一定要「搬回」

- 3.3.0：`process` 统一改名 `workflow`；去掉 `registry-disconnect-strategy`；worker/master 线程池配置项更名  
- 3.2.0：Spark 任务去掉版本选择；资源中心接口字段调整；`PYTHON_HOME`/`DATAX_HOME` 改名等  
- 3.4.3：实例列表 API 瘦身（重字段改走详情接口）

## 建议

若业务强依赖，优先顺序建议：**数据质量 > 工作流导入导出 > UDF 管理 > Dynamic/Pigeon/Pytorch（按是否仍有存量任务）**。

