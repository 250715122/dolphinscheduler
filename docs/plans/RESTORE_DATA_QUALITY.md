# 数据质量（轻量 SQL_CHECK）实现说明

## 方案（已实现）

不以 Apache 3.2.2 Spark DQ 为运行时依赖。在 **当前 3.4.1** 上新增任务类型 **`SQL_CHECK`**：

1. 选择数据源（StarRocks / MySQL / PostgreSQL 等，复用现有数据源插件）
2. 编写自定义对比 SQL（须返回**一行一列数值**）
3. 配置失败条件：`运算符` + `阈值`（当「实际值 运算符 阈值」为真时任务失败）
4. 任务失败 → 工作流失败告警（现有可读告警）
5. 二期：运行总览「数据质量」面板 + 「质量检查失败」指标；结果摘要写入任务 `appLink`

## 模块

- `dolphinscheduler-task-plugin/dolphinscheduler-task-sql-check`
- UI：`use-sql-check` 节点表单
- 首页：`quality-rank.tsx`

## 判定约定

例：差异行数检查

```sql
SELECT COUNT(*) FROM ( ... EXCEPT ... ) t
```

运算符 `GT`，阈值 `0` → 有差异则失败。

## 与社区 DQ 差异

| | 社区 3.2.2 DQ | 本实现 |
|---|---|---|
| 引擎 | Spark | JDBC |
| 规则 | 模板规则库 | 自定义 SQL |
| 依赖 | Spark/Hive | 仅数据源 JDBC |
