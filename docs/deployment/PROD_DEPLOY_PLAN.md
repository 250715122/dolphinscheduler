# 生产环境部署执行计划（数据中台 DolphinScheduler 3.4.1）

> 基于测试机 `192.168.40.39` 已验证路径编写。生产主机/端口/元库以现网确认结果为准（文中用占位符）。  
> 代码：`feat/local-dev` @ fork `250715122/dolphinscheduler`（部署前锁定 commit）。  
> 构建机：`gt@192.168.56.101`。

## 0. 目标与原则

| 项 | 说明 |
|----|------|
| 目标 | 将测试已验收功能上生产：Casdoor 双登录、首页运维看板、血缘/时间线、业务分组、SQL_CHECK、中文用户名等 |
| 布局 | 预期与测试一致：**Standalone**（若生产为 cluster，停启顺序与 jar 路径按 4.B 调整） |
| 不改 | 生产密钥不进 Git；不在生产直接编译；不跳过备份 |
| 必做 | 安装目录备份 + 元库 dump；Casdoor redirect 先加生产 URL；失败按 §6 回滚 |
| 窗口 | 低峰；提前通知业务；预留 ≥60 分钟（含验证与回滚） |

### 0.1 部署前必须填实的现网信息

| 项 | 占位 | 确认方式 |
|----|------|----------|
| 生产主机 | `$PROD_HOST` | SSH / 资产台账 |
| SSH 账号 | `$PROD_USER` | 通常与测试同体系 |
| 安装目录 | `$DS_HOME`（测试为 `/opt/apache-dolphinscheduler-3.4.1-bin`） | `ps`/`readlink` |
| UI 入口 | `http://$PROD_HOST:$PORT/dolphinscheduler/ui/` | 浏览器 |
| 元库 | `$DB_HOST:$DB_PORT/$DB_NAME` | `bin/env/dolphinscheduler_env.sh` |
| JDK | `$JAVA_HOME` | 与现网一致（测试 JDK11） |
| 部署形态 | Standalone / Cluster | 进程列表 |

---

## 1. 准入条件（全部满足再动生产）

1. **测试验收通过**：`192.168.40.39` 上功能清单签字（见 §5 对照表）。
2. **版本一致**：生产 `t_ds_version` = `3.4.1`（禁止无脚本跨大版本）。
3. **分支锁定**：记录 commit：`git rev-parse HEAD`（建议 ≥ 含 SSO/首页/时间线主题修复的最新提交）。
4. **Casdoor**：应用 `application_dolphinscheduler` 已追加生产 redirect：  
   `http://$PROD_HOST:$PORT/dolphinscheduler/ui/login`
5. **备份磁盘**：目标机备份目录可用空间 ≥ 安装目录 ×2 + dump。
6. **回滚演练口述确认**：执行人能按 §6 在 15 分钟内回滚 jar/ui/conf。

---

## 2. 变更清单（相对生产基线）

按模块替换（与测试差量部署同模式）：

| 产物 | 作用 |
|------|------|
| `dolphinscheduler-api-3.4.1.jar` | SSO state/cookie、质量相关 API 等 |
| `dolphinscheduler-common-3.4.1.jar` | 中文用户名正则等 |
| `dolphinscheduler-task-sql-check-3.4.1-shade.jar` | SQL_CHECK 插件（若生产尚无） |
| `ui/`（三处：`ui`、`api-server/ui`、`standalone-server/ui`） | 首页/血缘/时间线主题/业务分组等 |
| `application.yaml` 增量 | `server.servlet.session.cookie.same-site: lax`；Casdoor；**redirect 必须指向生产** |

> 若生产尚未部署过 `e4f4f33d5` 之后的改动，还需确认 `service`/`dao` 是否与测试一致；以 `git diff <生产基线>..HEAD --name-only` 为准。

---

## 3. 构建与打包（56.101）

```bash
cd /home/gt/Codes/dolphinscheduler
git checkout feat/local-dev
git status   # 工作区干净或已提交
COMMIT=$(git rev-parse --short HEAD)

./mvnw -pl dolphinscheduler-api,dolphinscheduler-common \
  -am -DskipTests -Dspotless.skip=true package -q
# 若需 sql-check：
./mvnw -pl dolphinscheduler-task-plugin/dolphinscheduler-task-sql-check \
  -am -DskipTests -Dspotless.skip=true package -q

cd dolphinscheduler-ui && pnpm run build:prod && cd ..

REL=/tmp/ds-prod-release-$(date +%Y%m%d-%H%M%S)-$COMMIT
mkdir -p "$REL"/{libs,plugins,ui,conf}
cp -a dolphinscheduler-api/target/dolphinscheduler-api-3.4.1.jar "$REL/libs/"
cp -a dolphinscheduler-common/target/dolphinscheduler-common-3.4.1.jar "$REL/libs/"
cp -a dolphinscheduler-task-plugin/dolphinscheduler-task-sql-check/target/dolphinscheduler-task-sql-check-3.4.1-shade.jar \
  "$REL/plugins/" || true
rsync -a --delete dolphinscheduler-ui/dist/ "$REL/ui/"
echo "commit=$COMMIT" > "$REL/MANIFEST.txt"
# 准备生产专用 Casdoor redirect 片段（勿用测试 40.39 地址）
# 将 conf 片段写入 $REL/conf/ 后：
scp -r "$REL" ${PROD_USER}@${PROD_HOST}:/tmp/
```

---

## 4. 生产执行步骤

### 4.1 备份

```bash
export DS_HOME=/opt/apache-dolphinscheduler-3.4.1-bin   # 按现网改
export BK=/home/${PROD_USER}/ds-backup/$(date +%Y%m%d-%H%M%S)
mkdir -p "$BK"/{libs,plugins,conf,ui,meta}
echo "$BK" > /home/${PROD_USER}/ds-backup/LAST_BACKUP.txt

cp -a "$DS_HOME/libs"/dolphinscheduler-{api,common}-3.4.1.jar "$BK/libs/" || true
cp -a "$DS_HOME/standalone-server/conf/application.yaml" "$BK/conf/"
tar -C "$DS_HOME/ui" -czf "$BK/ui/ui-top.tgz" index.html assets
ss -lntp | tee "$BK/meta/ports.txt"
ps -ef | grep -i StandaloneServer | grep -v grep | tee "$BK/meta/procs.txt"

# 元库 dump（在可连 DB 的机器执行，再拷到 $BK/meta/）
# PGPASSWORD=*** pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -Fc -f dolphinscheduler-pre.dump
```

### 4.2 停服

```bash
pkill -f 'org.apache.dolphinscheduler.StandaloneServer' || true
sleep 4
pgrep -f StandaloneServer && pkill -9 -f StandaloneServer || echo stopped
```

Cluster 若适用：按 worker → master → api → alert 顺序停。

### 4.3 替换产物

```bash
REL=/tmp/ds-prod-release-...   # 上传包路径
cp -a "$REL/libs/"*.jar "$DS_HOME/libs/"
cp -a "$REL/plugins/"*.jar "$DS_HOME/plugins/task-plugins/" 2>/dev/null || true
for dest in ui api-server/ui standalone-server/ui; do
  rsync -a --delete "$REL/ui/" "$DS_HOME/$dest/"
done
```

### 4.4 配置（保留生产密钥，只打增量）

1. 备份后的 `application.yaml` 上合并：
   - `security.authentication.type: CASDOOR_SSO`（若生产已启用则跳过）
   - Casdoor endpoint/client/cert/**redirect-url → 生产 URL**
   - `server.servlet.session.cookie.same-site: lax`（及 http-only、path）
2. **禁止**把测试机 `192.168.40.39` 的 redirect 拷到生产。
3. 核对 `bin/env/dolphinscheduler_env.sh` 仍指向生产元库。

### 4.5 启服

```bash
cd "$DS_HOME/standalone-server"
source ../bin/env/dolphinscheduler_env.sh
bash bin/start.sh
# 等待约 30–60s
curl -s http://127.0.0.1:12345/dolphinscheduler/actuator/health
```

---

## 5. 验收清单

| 检查 | 期望 |
|------|------|
| actuator health | alert/api/db/master/worker 均为 UP |
| `/ui/login` | 200；双登录入口可见 |
| `/login/sso` | authorize URL 的 `redirect_uri` 含 **生产** host |
| 钉钉/Casdoor SSO | 无「状态码不一致」；能登录现有用户 |
| 账号密码登录 | 生产本地账号仍可用 |
| 首页指标 | 待运行=今日未到点的上线调度数；趋势有数 |
| 工作流关系 · 时间线 | 切换深色主题后文字/轴/轨道颜色跟随变暗 |
| 业务分组 / 导入导出 | 分组在；导入导出按钮在 |
| SQL_CHECK | DAG 可选中；失败可在质量面板看到（有数据时） |
| 用户管理 | 中文用户名可创建 |

---

## 6. 回滚（出问题立即执行）

```bash
export BK=$(cat /home/${PROD_USER}/ds-backup/LAST_BACKUP.txt)
pkill -f 'org.apache.dolphinscheduler.StandaloneServer' || true
sleep 3
cp -a "$BK/libs/"*.jar "$DS_HOME/libs/"
cp -a "$BK/conf/application.yaml" "$DS_HOME/standalone-server/conf/"
tar -C "$DS_HOME/ui" -xzf "$BK/ui/ui-top.tgz"
# 同步到 api-server/ui、standalone-server/ui（若当时一并备份）
cd "$DS_HOME/standalone-server" && source ../bin/env/dolphinscheduler_env.sh && bash bin/start.sh
```

元库仅在确认发生破坏性 DDL/数据损坏时再 `pg_restore`；一般 jar/ui/conf 回滚即可。

---

## 7. 建议日程（示例）

| 阶段 | 动作 | 建议时长 |
|------|------|----------|
| T-1 天 | 填实 §0.1；Casdoor 加 redirect；测试回归签字；锁定 commit | 0.5d |
| T 日窗口前 | 构建 `$REL`；预传包到生产 `/tmp`；再确认备份目录 | 1h |
| T 日窗口 | §4 备份→停服→替换→conf→启服→§5 冒烟 | 45–60min |
| T+1 天 | 观察告警、SSO、调度是否正常；补部署记录 | 跟进 |

---

## 8. 与测试环境差异提醒

| 点 | 测试 (40.39) | 生产 |
|----|--------------|------|
| redirect | `192.168.40.39:12345` | **必须改** |
| 元库 | `192.168.41.85` / dolphin | **现网库，勿混用测试 dump** |
| 备份路径 | `/home/agi/ds-backup/` | 按生产账号调整 |
| 变更面 | 已多次差量同步 | 首次上生产应用完整 §2 清单 |

