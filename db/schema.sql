-- =============================================================================
-- 生活文案工厂（国内版）PostgreSQL Schema
-- 仅建表结构，当前服务端使用内存存储（server/risk/store.ts），字段一一对应。
-- 执行：psql "$DATABASE_URL" -f db/schema.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('normal', 'disabled', 'blacklisted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE log_result AS ENUM ('allowed', 'rejected', 'admin', 'alert', 'track');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE generation_kind AS ENUM ('workflow', 'bazi', 'miniapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 1. 用户表（同时作为“记忆库”主表）
--    同一设备指纹 / 同一 IP 注册的多个账号共享 identity_group_id，额度按组计算
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_group_id   UUID        NOT NULL,
  device_fingerprint  VARCHAR(128) NOT NULL,
  register_ip         INET        NOT NULL,
  last_ip             INET,
  known_ips           INET[]      NOT NULL DEFAULT '{}',
  status              user_status NOT NULL DEFAULT 'normal',
  status_reason       VARCHAR(200) NOT NULL DEFAULT '',
  call_count          INTEGER     NOT NULL DEFAULT 0,
  quota_reset_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),   -- 注册时间
  last_active_at      TIMESTAMPTZ NOT NULL DEFAULT now(),   -- 最近活跃
  CONSTRAINT users_fingerprint_unique UNIQUE (device_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_users_group        ON users (identity_group_id);
CREATE INDEX IF NOT EXISTS idx_users_register_ip  ON users (register_ip);
CREATE INDEX IF NOT EXISTS idx_users_status       ON users (status) WHERE status <> 'normal';
CREATE INDEX IF NOT EXISTS idx_users_last_active  ON users (last_active_at DESC);

-- 设备 / IP 黑名单（拉黑用户时同步写入，实现连坐）
CREATE TABLE IF NOT EXISTS blacklist_entries (
  id          BIGSERIAL PRIMARY KEY,
  kind        VARCHAR(16) NOT NULL CHECK (kind IN ('fingerprint', 'ip')),
  value       VARCHAR(128) NOT NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  reason      VARCHAR(200) NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT blacklist_unique UNIQUE (kind, value)
);

-- -----------------------------------------------------------------------------
-- 2. 会话表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash          CHAR(64)    NOT NULL UNIQUE,          -- 只存 SHA-256，不存明文令牌
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint  VARCHAR(128) NOT NULL,
  ip                  INET        NOT NULL,
  user_agent          VARCHAR(400),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- -----------------------------------------------------------------------------
-- 3. 操作日志表（风控拒绝、重复内容、后台操作、熔断告警、埋点）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operation_logs (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  identity_group_id   UUID,
  device_fingerprint  VARCHAR(128),
  ip                  INET,
  action              VARCHAR(64)  NOT NULL,     -- generate / register / login / set_status:* / reset_quota / circuit_breaker / track:*
  endpoint            VARCHAR(200) NOT NULL,
  result              log_result   NOT NULL,
  reason              VARCHAR(200) NOT NULL DEFAULT '',  -- ip_rate_limited / duplicate_content / new_account_hourly ...
  content_hash        CHAR(64),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logs_user_time    ON operation_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_result_time  ON operation_logs (result, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_group_hash   ON operation_logs (identity_group_id, content_hash, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. 生成记录表（记忆库明细：按用户 ID 归档）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generation_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  identity_group_id   UUID NOT NULL,
  device_fingerprint  VARCHAR(128) NOT NULL,
  ip                  INET NOT NULL,
  kind                generation_kind NOT NULL,
  content_hash        CHAR(64) NOT NULL,
  summary             VARCHAR(200) NOT NULL DEFAULT '',
  input_payload       JSONB NOT NULL DEFAULT '{}',
  output_payload      JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 按用户 ID 归档 + 时间倒序查询
CREATE INDEX IF NOT EXISTS idx_gen_user_time  ON generation_records (user_id, created_at DESC);
-- 身份组额度统计（每小时 / 每天）
CREATE INDEX IF NOT EXISTS idx_gen_group_time ON generation_records (identity_group_id, created_at DESC);
-- 全站当日总量（熔断）
CREATE INDEX IF NOT EXISTS idx_gen_time       ON generation_records (created_at DESC);

-- -----------------------------------------------------------------------------
-- 记忆库视图：用户 ID / 设备指纹 / IP / 注册时间 / 最近活跃 / 调用次数 / 生成内容 ID
-- 查询示例：SELECT * FROM user_memory WHERE user_id = $1;
--           SELECT * FROM generation_records WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50;
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW user_memory AS
SELECT
  u.id                 AS user_id,
  u.identity_group_id,
  u.device_fingerprint,
  u.register_ip,
  u.last_ip,
  u.created_at         AS registered_at,
  u.last_active_at,
  u.call_count,
  u.status,
  COALESCE(
    (SELECT array_agg(g.id ORDER BY g.created_at DESC) FROM generation_records g WHERE g.user_id = u.id),
    '{}'
  ) AS generation_ids
FROM users u;
