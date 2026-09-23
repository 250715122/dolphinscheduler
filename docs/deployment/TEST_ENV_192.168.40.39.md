# 测试环境部署计划（192.168.40.39）

目标：将 `feat/local-dev`（基于 3.4.1）部署到测试机，并保证**可快速回滚**。

## 0. 范围与原则

| 项 | 说明 |
|----|------|
| 代码分支 | `feat/local-dev` @ fork `250715122/dolphinscheduler` |
| 目标机 | `192.168.40.39`（现网已在跑 DS，告警样例中的 master host） |
| 不改 | 生产库；开发机 `56.101` 仅作构建 |
| 必做 | 部署前全量备份安装目录 + 元数据库 dump；失败立刻回滚 |
| 密钥 | Casdoor / DB 密码**只写目标机 conf**，不进 Git |

> 部署前需确认：SSH 账号、现网安装路径（常见 `/opt/dolphinscheduler` 或 `/home/*/dolphinscheduler`）、是否 cluster（api/master/worker/alert 分进程）还是 standalone、JDK 版本（建议 11/17 与现网一致）、元库是否本机 PG/MySQL。

---

## 1. 部署前检查清单

1. **基线一致**：目标机 `t_ds_version` = `3.4.1`（或与当前包一致）；禁止跨大版本无升级脚本硬上。
2. **窗口**：选低峰；通知使用测试环境的同事。
3. **Casdoor**：应用 `application_dolphinscheduler` 的 redirect 已含：
   - `http://192.168.40.39:12345/dolphinscheduler/ui/login`（端口以现网为准）
4. **本机构建机**能拉代码、能 `mvn package`、能 `pnpm build:prod`。
5. **回滚包预留目录**：目标机例如 `/data/ds-backup/YYYYMMDD-HHMM/` 空间充足（安装目录体积 ×2 + dump）。

---

## 2. 备份（失败可恢复的关键）

在目标机执行（路径按现网调整，下文用 `$DS_HOME`）：

```bash
export DS_HOME=/path/to/dolphinscheduler   # 现网根目录
export BK=/data/ds-backup/$(date +%Y%m%d-%H%M%S)
mkdir -p "$BK"

# 2.1 停服前先记下进程与端口
ss -lntp | tee "$BK/ports.txt"
ps -ef | grep -i dolphin | grep -v grep | tee "$BK/procs.txt"

# 2.2 元数据库全量 dump（PostgreSQL 示例）
pg_dump -Fc -h <db_host> -U <user> -d dolphinscheduler -f "$BK/dolphinscheduler.dump"
# 或 MySQL:
# mysqldump -h ... -u ... -p --single-transaction --routines dolphinscheduler > "$BK/dolphinscheduler.sql"

# 2.3 安装目录与 conf（含密钥，权限收紧）
tar -C "$(dirname "$DS_HOME")" -czf "$BK/ds-home.tgz" "$(basename "$DS_HOME")"
cp -a "$DS_HOME"/bin "$BK/bin" 2>/dev/null || true
find "$DS_HOME" -name 'application.yaml' -o -name 'common.properties' | tee "$BK/conf-list.txt"
# 单独再拷一份 conf，方便差量回滚
mkdir -p "$BK/conf"
find "$DS_HOME" -type f \( -name 'application.yaml' -o -name 'common.properties' -o -name 'jvm_args_env.sh' \) \
  -exec cp --parents -a {} "$BK/conf/" \;

chmod -R go-rwx "$BK"
echo "$BK" > /tmp/ds-last-backup.txt
```

**验收**：`$BK/dolphinscheduler.dump`（或 sql）非空；`$BK/ds-home.tgz` 可 `tar -tzf` 列出。

---

## 3. 构建发布包（在 56.101 或 CI）

```bash
cd /home/gt/Codes/dolphinscheduler
git fetch origin && git checkout feat/local-dev && git pull --ff-only origin feat/local-dev

# JDK 与现网一致（开发环境常用 11）
source ~/Codes/ds-dev/ds-dev.env   # 若有

mvn -T 1C clean package -Dmaven.test.skip=true -Dspotless.check.skip=true

# UI
cd dolphinscheduler-ui && pnpm install && pnpm run build:prod && cd ..

# 组装产物目录（cluster 建议官方 dist；standalone 可拷 target）
# 推荐使用官方装配包：
PKG=dolphinscheduler-dist/target/apache-dolphinscheduler-*-bin.tar.gz
ls -lh "$PKG"
```

将 `$PKG` + `dolphinscheduler-ui/dist`（若需单独替换 ui）传到目标机 `/tmp/ds-release/`。

若现网是**已解压的 cluster 布局**，也可只替换变更模块 jar + ui（灰度更小）：

| 模块 | 替换对象 |
|------|----------|
| api | `api-server/libs/dolphinscheduler-api-*.jar` |
| service | 各 server `libs/dolphinscheduler-service-*.jar` |
| dao | 各 server `libs/dolphinscheduler-dao-*.jar` |
| ui | `api-server/ui` 或 `standalone-server/ui` ← `dist/` |

---

## 4. 停服 → 部署 → 改 conf → 启服

### 4.1 停服

```bash
# cluster 常见顺序：worker → master → api → alert（或按现网脚本）
cd "$DS_HOME"
bash bin/dolphinscheduler-daemon.sh stop worker-server
bash bin/dolphinscheduler-daemon.sh stop master-server
bash bin/dolphinscheduler-daemon.sh stop api-server
bash bin/dolphinscheduler-daemon.sh stop alert-server
# 确认无残留
pgrep -af dolphinscheduler || echo "stopped"
```

### 4.2 部署新版本（二选一）

**A. 整包替换（推荐测试首次）**

```bash
mv "$DS_HOME" "${DS_HOME}.prev"
mkdir -p "$DS_HOME"
tar -xzf /tmp/ds-release/apache-dolphinscheduler-*-bin.tar.gz -C "$DS_HOME" --strip-components=1
# 从备份恢复 conf / 数据源 / 注册中心等
cp -a "$BK"/conf/*/. "$DS_HOME"/   # 按实际备份结构调整
```

**B. 热替换 jar + ui（改动面小）**

```bash
# 先备份将被覆盖的 jar
mkdir -p "$BK/jars"
cp -a "$DS_HOME"/api-server/libs/dolphinscheduler-api-*.jar "$BK/jars/"
cp -a "$DS_HOME"/master-server/libs/dolphinscheduler-service-*.jar "$BK/jars/"
# ... dao 等同理
# 再拷贝新 jar 与 ui
rsync -a /tmp/ds-release/ui/ "$DS_HOME"/api-server/ui/
```

### 4.3 Schema

本次若含 `t_ds_project_preference` 等字段改为 TEXT：在**已备份**前提下执行现网对应升级 SQL（或确认 3.4.1 库已兼容）。无变更则跳过。

### 4.4 Casdoor（双登录）

参考仓库 `docs/deployment/application-casdoor.yaml.example`，合并进 **api-server**（及 standalone）`application.yaml`：

- `security.authentication.type: CASDOOR_SSO`
- `casdoor.*` 填测试环境真实值
- `redirect-url` 必须与 Casdoor 应用回调一致

**不要**把 client-secret 写回 Git。

### 4.5 启动

```bash
bash bin/dolphinscheduler-daemon.sh start alert-server
bash bin/dolphinscheduler-daemon.sh start master-server
bash bin/dolphinscheduler-daemon.sh start worker-server
bash bin/dolphinscheduler-daemon.sh start api-server
```

---

## 5. 验证清单

| # | 项 | 期望 |
|---|----|------|
| 1 | `actuator/health` | api/db/master/worker/alert UP |
| 2 | 登录页 | 先见「单点登录」「账号密码登录」两选项 |
| 3 | SSO | Casdoor 回调成功进系统 |
| 4 | 本地账号 | `admin` 或测试用户密码可登录 |
| 5 | 项目权限 | 单项目/多项目用户可见范围正确 |
| 6 | 项目偏好 | 业务分组目录可保存 |
| 7 | 血缘 | 跨项目虚线边可见 |
| 8 | 告警 | 故意失败一小工作流，钉钉/邮件标题为 `【调度失败】项目 / 实例名`，正文含【项目】【失败任务】 |

任一项失败 → 执行第 6 节回滚，不要继续「再改一点试试」拖垮窗口。

---

## 6. 回滚步骤（出问题必做）

```bash
export BK=$(cat /tmp/ds-last-backup.txt)   # 或手工指定备份目录

# 6.1 停新版本
cd "$DS_HOME" && bash bin/dolphinscheduler-daemon.sh stop all 2>/dev/null || true
pgrep -af dolphinscheduler | xargs -r kill || true

# 6.2 恢复安装目录
rm -rf "$DS_HOME"
tar -C "$(dirname "$DS_HOME")" -xzf "$BK/ds-home.tgz"
# 若用的是 .prev 方式：
# rm -rf "$DS_HOME"; mv "${DS_HOME}.prev" "$DS_HOME"

# 6.3 恢复数据库（仅当本次改过 schema / 数据错乱时）
# pg_restore -c -h ... -U ... -d dolphinscheduler "$BK/dolphinscheduler.dump"
# 注意：-c 会丢本次部署后产生的新实例数据；测试环境一般可接受

# 6.4 启旧版
cd "$DS_HOME"
# 按原顺序 start *

# 6.5 验证 health + 登录 + 一条调度
```

**回滚验收**：health UP；登录方式恢复为部署前行为；告警格式恢复旧样（可接受）。

---

## 7. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Casdoor 回调域名/端口不对 | 部署前改 Casdoor redirect；失败可先把 `type` 改回 `PASSWORD` 热启 api |
| jar 与插件版本混用 | 优先整包替换；或整组 api/service/dao 一起换 |
| schema 变更失败 | 先 dump；升级 SQL 单独事务；失败立刻 restore |
| 停服过久 | 预演在 56.101；测试机操作脚本化；回滚包已备好 |
| 密钥进错仓库 | conf 仅目标机；Git 只用 example |

---

## 8. 建议时间线

| 阶段 | 时长 | 内容 |
|------|------|------|
| T-1 | 0.5h | 检查清单 + Casdoor redirect + 备份目录 |
| T0 | 0.5h | dump + 打包传机 |
| T0+ | 0.5–1h | 停服部署启服 |
| T0++ | 0.5h | 验证清单 |
| 缓冲 | 0.5h | 预留回滚 |

总计约 **2–3 小时**窗口。
