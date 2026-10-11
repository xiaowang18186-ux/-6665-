/**
 * 业务风控中间件。
 *
 * 链路（按顺序）：
 *   1. 设备指纹 / 会话令牌校验            → 400 / 401
 *   2. IP 频率限制（每分钟 N 次）          → 429
 *   3. 账号状态 & 黑名单（设备 / IP 连坐） → 403
 *   4. 入参校验（不合法不计额度）          → 400
 *   5. 全站用量熔断                        → 503（并告警）
 *   6. 重复内容检测（5 分钟内相同内容）    → 409（并记录日志）
 *   7. 新号限流 / 普通额度（按身份组共享） → 429
 *   8. 放行并计数
 */
import type { NextFunction, Request, Response } from "express";
import { HEADER_FINGERPRINT, HEADER_SESSION, type ApiError } from "@shared/api";
import { RISK } from "../config/env";
import { hashContent, riskStore, type MemoryRiskStore, type StoredUser } from "./store";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      riskUser?: StoredUser;
      contentHash?: string;
      fingerprint?: string;
    }
  }
}

export const FINGERPRINT_RE = /^[a-f0-9]{16,128}$/i;

export const clientIp = (req: Request) => (req.ip ?? req.socket.remoteAddress ?? "unknown").replace(/^::ffff:/, "");

export function reject(res: Response, status: number, code: string, message: string, retryAfterSec?: number) {
  if (retryAfterSec) res.setHeader("Retry-After", String(retryAfterSec));
  const body: ApiError = { ok: false, code, message, ...(retryAfterSec ? { retryAfterSec } : {}) };
  return res.status(status).json(body);
}

/** 读取并校验设备指纹头 */
export function readFingerprint(req: Request) {
  const fp = String(req.header(HEADER_FINGERPRINT) ?? "").trim();
  return FINGERPRINT_RE.test(fp) ? fp.toLowerCase() : null;
}

/** 返回错误提示表示入参不合法 */
export type Validator = (body: any) => string | null;

export function createRiskGuard(store: MemoryRiskStore = riskStore) {
  return (validate: Validator) => function riskGuard(req: Request, res: Response, next: NextFunction) {
    const ip = clientIp(req);
    const endpoint = req.baseUrl + req.path;
    const fingerprint = readFingerprint(req);
    const base = { ip, endpoint, action: "generate", deviceFingerprint: fingerprint };

    if (!fingerprint) {
      store.log({ ...base, result: "rejected", reason: "missing_fingerprint" });
      return reject(res, 400, "MISSING_FINGERPRINT", "请求缺少设备标识，请刷新页面后重试");
    }

    const ipCheck = store.hitIp(ip, RISK.ipPerMinute);
    if (!ipCheck.allowed) {
      store.log({ ...base, result: "rejected", reason: "ip_rate_limited" });
      return reject(res, 429, "IP_RATE_LIMITED", "操作太频繁，请稍后再试", ipCheck.retryAfterSec);
    }

    const user = store.resolveSession(req.header(HEADER_SESSION) ?? undefined, fingerprint, ip);
    if (!user) {
      store.log({ ...base, result: "rejected", reason: "invalid_session" });
      return reject(res, 401, "INVALID_SESSION", "会话已失效，请刷新页面");
    }
    const who = { ...base, userId: user.id, identityGroupId: user.identityGroupId };

    if (user.status !== "normal" || store.isBlacklisted(fingerprint, ip)) {
      store.log({ ...who, result: "rejected", reason: `status_${user.status}` });
      return reject(res, 403, "ACCOUNT_RESTRICTED", user.status === "disabled" ? "账号已被停用，请联系客服" : "当前账号无法使用该服务");
    }

    const invalid = validate(req.body ?? {});
    if (invalid) {
      store.log({ ...who, result: "rejected", reason: "invalid_input" });
      return reject(res, 400, "INVALID_INPUT", invalid);
    }

    if (store.breakerState().open) {
      store.log({ ...who, result: "rejected", reason: "circuit_open" });
      return reject(res, 503, "SERVICE_PAUSED", "服务繁忙，今日生成通道已暂停，请明天再来", 3600);
    }

    const contentHash = hashContent({ endpoint, body: req.body ?? null });
    if (store.isDuplicate(user.identityGroupId, contentHash)) {
      store.log({ ...who, result: "rejected", reason: "duplicate_content", contentHash });
      return reject(res, 409, "DUPLICATE_CONTENT", `${RISK.duplicateWindowMinutes} 分钟内请勿重复提交相同内容`);
    }

    const quota = store.quotaFor(user);
    const usage = store.groupUsage(user.identityGroupId);
    if (usage.lastHour >= quota.hourly) {
      store.log({ ...who, result: "rejected", reason: quota.isNew ? "new_account_hourly" : "hourly_quota", contentHash });
      return reject(res, 429, "QUOTA_HOURLY", quota.isNew ? `新用户每小时最多 ${quota.hourly} 次，请稍后再试` : "本小时次数已用完，请稍后再试", 600);
    }
    if (usage.lastDay >= quota.daily) {
      store.log({ ...who, result: "rejected", reason: quota.isNew ? "new_account_daily" : "daily_quota", contentHash });
      return reject(res, 429, "QUOTA_DAILY", quota.isNew ? `新用户每天最多 ${quota.daily} 次，明天再来吧` : "今日次数已用完，明天再来吧", 3600);
    }

    store.recordCall(user);
    store.rememberContent(user.identityGroupId, contentHash);
    store.log({ ...who, result: "allowed", reason: "ok", contentHash });
    req.riskUser = user;
    req.contentHash = contentHash;
    req.fingerprint = fingerprint;
    next();
  };
}

/** 轻量限流：用于会话初始化、埋点等非计费接口 */
export function createLightLimiter(store: MemoryRiskStore = riskStore, perMinute = 30) {
  return function lightLimiter(req: Request, res: Response, next: NextFunction) {
    const ip = clientIp(req);
    const check = store.hitIp(`light:${ip}`, perMinute);
    if (!check.allowed) return reject(res, 429, "IP_RATE_LIMITED", "操作太频繁，请稍后再试", check.retryAfterSec);
    next();
  };
}
