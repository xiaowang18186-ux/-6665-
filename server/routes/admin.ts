/**
 * 管理后台接口：/api/admin/*，需请求头 x-admin-token。
 * 第三方服务名称、Key 配置状态、用量数据只在这里返回。
 */
import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { ENV, RISK } from "../config/env";
import { DB_CONFIGURED, providerAdminView } from "../config/providers";
import { clientIp, reject } from "../risk/middleware";
import type { MemoryRiskStore, StoredUser, UserStatus } from "../risk/store";
import { isOneOf, isStr } from "./validate";

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!ENV.adminToken) return reject(res, 503, "ADMIN_DISABLED", "未配置 ADMIN_TOKEN，后台已禁用");
  const given = Buffer.from(String(req.header("x-admin-token") ?? ""));
  const expected = Buffer.from(ENV.adminToken);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return reject(res, 401, "UNAUTHORIZED", "管理员令牌无效");
  next();
}

const userView = (u: StoredUser, store: MemoryRiskStore) => ({
  id: u.id,
  identityGroupId: u.identityGroupId,
  deviceFingerprint: u.deviceFingerprint,
  registerIp: u.registerIp,
  ips: [...u.ips],
  status: u.status,
  statusReason: u.statusReason,
  createdAt: u.createdAt,
  lastActiveAt: u.lastActiveAt,
  callCount: u.callCount,
  quota: store.quotaFor(u),
  usage: store.groupUsage(u.identityGroupId),
});

export function adminRouter(store: MemoryRiskStore) {
  const r = Router();
  r.use(requireAdmin);

  const audit = (req: Request, action: string, reason: string, userId: string | null = null) =>
    store.log({ userId, ip: clientIp(req), action, endpoint: req.originalUrl, result: "admin", reason });

  r.get("/overview", (_req, res) => {
    const users = [...store.users.values()];
    res.json({
      ok: true,
      data: {
        breaker: store.breakerState(),
        alerts: store.alerts.slice(0, 20),
        counts: {
          users: users.length,
          normal: users.filter((u) => u.status === "normal").length,
          disabled: users.filter((u) => u.status === "disabled").length,
          blacklisted: users.filter((u) => u.status === "blacklisted").length,
          generations: store.generations.length,
        },
        risk: RISK,
        database: { configured: DB_CONFIGURED, mode: "memory（未接入 PostgreSQL）" },
      },
    });
  });

  r.get("/users", (req, res) => {
    const status = req.query.status;
    const list = [...store.users.values()]
      .filter((u) => !isOneOf(status, ["normal", "disabled", "blacklisted"] as const) || u.status === status)
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .map((u) => userView(u, store));
    res.json({ ok: true, data: list });
  });

  r.get("/blacklist", (_req, res) => {
    const b = store.blacklist();
    res.json({ ok: true, data: { users: b.users.map((u) => userView(u, store)), fingerprints: b.fingerprints, ips: b.ips } });
  });

  r.post("/users/:id/status", (req, res) => {
    const status = req.body?.status as UserStatus;
    if (!isOneOf(status, ["normal", "disabled", "blacklisted"] as const)) return reject(res, 400, "INVALID_INPUT", "状态必须是 normal / disabled / blacklisted");
    const reason = isStr(req.body?.reason, 0, 200) ? req.body.reason : "";
    const u = store.setStatus(req.params.id, status, reason);
    if (!u) return reject(res, 404, "NOT_FOUND", "用户不存在");
    audit(req, `set_status:${status}`, reason, u.id);
    res.json({ ok: true, data: userView(u, store) });
  });

  r.post("/users/:id/reset-quota", (req, res) => {
    if (!store.resetQuota(req.params.id)) return reject(res, 404, "NOT_FOUND", "用户不存在");
    audit(req, "reset_quota", "manual", req.params.id);
    res.json({ ok: true, data: { reset: true } });
  });

  /** 记忆库：按用户 ID 归档，生成记录按时间倒序 */
  r.get("/users/:id/memory", (req, res) => {
    const m = store.memoryOf(req.params.id, Math.min(200, Number(req.query.limit) || 50));
    if (!m) return reject(res, 404, "NOT_FOUND", "用户不存在");
    res.json({ ok: true, data: m });
  });

  r.get("/logs", (req, res) => {
    const result = req.query.result;
    const limit = Math.min(500, Number(req.query.limit) || 100);
    const rows = store.logs.filter((l) => !isStr(result, 1, 20) || l.result === result).slice(0, limit);
    res.json({ ok: true, data: rows });
  });

  r.post("/breaker", (req, res) => {
    store.manualBreakerOpen = Boolean(req.body?.open);
    audit(req, store.manualBreakerOpen ? "breaker_open" : "breaker_close", "manual");
    res.json({ ok: true, data: store.breakerState() });
  });

  r.get("/providers", (_req, res) => {
    res.json({ ok: true, data: providerAdminView() });
  });

  return r;
}
