# 乾坤大骡一

由欧美版 Life Copy Factory 改造：面向国内大众，主打中国本土乡村、城市和家庭场景，内容分发到国内短视频与图文平台。

## 页面结构（纵向）

1. **自动化工作流**：图生视频全链路，共 12 个节点，前端只显示「运行中 / 已完成 / 待接入」
2. **八字排盘**：只作传统文化知识介绍，附免责声明
3. **小程序代写**
4. **热点信息**：参照 AIHOT 的去重、打分和合规过滤逻辑，只用静态数据，可一键带入工作流
5. `/admin`：管理后台（需要 `ADMIN_TOKEN`）

## 目录

| 路径 | 说明 |
|---|---|
| `client/src/sections/*` | 前端四个板块 |
| `client/src/pages/Admin.tsx` | 后台：用户状态、黑名单、封禁、重置额度、记忆库、日志、熔断、服务配置 |
| `client/src/lib/fingerprint.ts` / `api.ts` | 设备指纹、会话令牌和埋点（请求头 `device-fingerprint`、`x-session-token`） |
| `shared/api.ts` | 接口契约（前端可见，禁止出现第三方名称） |
| `server/routes/public.ts` | `/api/hot`、`/api/workflow`、`/api/bazi`、`/api/miniapp`、`/api/session/init`、`/api/track` |
| `server/routes/admin.ts` | `/api/admin/*` |
| `server/risk/*` | 风控中间件和存储（内存实现，字段与 SQL 对应） |
| `server/localization/*` | 国内本土化脚本和合规规则库（不再使用原欧美版的德州、皮卡、美金等改写） |
| `server/hot/engine.ts` | 热点引擎（不抓取，不调用大模型） |
| `server/config/providers.ts` | 第三方服务候选和 Key 状态，**只有后台可见** |
| `db/schema.sql` | PostgreSQL 表结构：用户、会话、操作日志、生成记录、黑名单，以及记忆库视图 |

## 风控规则

| 规则 | 默认值 | 响应 |
|---|---|---|
| 新号（注册 24h 内） | 3 次/小时，10 次/天 | 429 `QUOTA_HOURLY` / `QUOTA_DAILY` |
| 同设备 / 同 IP 多账号 | 归入同一身份组，共享额度；拉黑时设备和 IP 一并封禁 | — |
| IP 频率 | 5 次/分钟（计费接口） | 429 `IP_RATE_LIMITED` |
| 重复内容 | 5 分钟内相同内容 | 409 `DUPLICATE_CONTENT`，并写入日志 |
| 账号状态 | 正常 / 禁用 / 黑名单 | 403 |
| 用量熔断 | 全站日总量达到阈值后自动暂停；达到 80% 时提前告警 | 503 `SERVICE_PAUSED` |

## 运行

```bash
npm install
npm run dev        # 前端 5173，后端 3000（开发环境后台令牌：dev-admin-token）
npm test           # 风控、接口、前端隐藏规则测试
npm run build && ADMIN_TOKEN=xxx npm start
psql "$DATABASE_URL" -f db/schema.sql   # 建表
```

## 当前限制

- 所有业务接口都返回静态假数据，没有接入任何 AI 服务，也没有连接数据库。
- 风控数据存在内存里，服务重启后会清空，多实例部署时各实例不共享。接 PostgreSQL 时按 `MemoryRiskStore` 实现同样的接口即可。
- 同一 IP 的账号会共享额度，公司网络、校园网等出口共用 IP 的场景可能误伤，上线前需要评估。
