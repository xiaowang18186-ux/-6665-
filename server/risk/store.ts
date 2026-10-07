/**
 * 风控 / 记忆库存储。
 *
 * 当前为内存实现（暂不接数据库），字段与 db/schema.sql 一一对应：
 *   users              ← StoredUser
 *   sessions           ← StoredSession
 *   operation_logs     ← OperationLog
 *   generation_records ← GenerationRecord
 * 接入 PostgreSQL 时实现同样的 RiskStore 接口即可，中间件与路由无需改动。
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ENV, RISK } from "../config/env";

export type UserStatus = "normal" | "disabled" | "blacklisted";

export type StoredUser = {
  id: string;
  /** 同设备 / 同 IP 注册的账号归入同一身份组，共享额度 */
  identityGroupId: string;
  deviceFingerprint: string;
  registerIp: string;
  ips: Set<string>;
  status: UserStatus;
  statusReason: string;
  createdAt: number;
  lastActiveAt: number;
  callCount: number;
};

export type StoredSession = { token: string; userId: string; fingerprint: string; ip: string; createdAt: number; expiresAt: number };

export type OperationLog = {
  id: number;
  userId: string | null;
  identityGroupId: string | null;
  deviceFingerprint: string | null;
  ip: string;
  action: string;
  endpoint: string;
  result: "allowed" | "rejected" | "admin" | "alert" | "track";
  reason: string;
  contentHash: string | null;
  createdAt: number;
};

export type GenerationRecord = {
  id: string;
  userId: string;
  identityGroupId: string;
  kind: "workflow" | "bazi" | "miniapp";
  contentHash: string;
  summary: string;
  createdAt: number;
};

export type Alert = { id: number; level: "warning" | "critical"; message: string; createdAt: number };

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export const hashContent = (value: unknown) =>
  createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex");

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  return `{${Object.keys(v as object)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

/** 以北京时间（UTC+8）计算“当天”起点 */
export function dayStartCst(now: number) {
  const offset = 8 * HOUR;
  return Math.floor((now + offset) / DAY) * DAY - offset;
}

export class MemoryRiskStore {
  users = new Map<string, StoredUser>();
  sessions = new Map<string, StoredSession>();
  logs: OperationLog[] = [];
  generations: GenerationRecord[] = [];
  alerts: Alert[] = [];

  private byFingerprint = new Map<string, string>(); // fp -> userId
  private groupByIp = new Map<string, string>(); // ip -> groupId
  private groupByFingerprint = new Map<string, string>(); // fp -> groupId
  private blacklistedFingerprints = new Set<string>();
  private blacklistedIps = new Set<string>();
  /** 身份组的计费调用时间戳 */
  private groupCalls = new Map<string, number[]>();
  /** IP 每分钟窗口 */
  private ipHits = new Map<string, number[]>();
  /** 身份组最近提交内容：hash -> 时间 */
  private recentContent = new Map<string, Map<string, number>>();
  private dailyTotal = { dayStart: 0, count: 0, alerted: false, tripped: false };
  private logSeq = 0;
  private alertSeq = 0;
  manualBreakerOpen = false;

  constructor(private now: () => number = Date.now) {}

  // ---------- 注册 / 会话 ----------
  /**
   * 设备指纹已注册 → 复用该账号；
   * 新设备但 IP 已出现过 → 新账号并入该 IP 的身份组（共享额度）。
   */
  registerOrLogin(fingerprint: string, ip: string) {
    const t = this.now();
    const existingId = this.byFingerprint.get(fingerprint);
    let user = existingId ? this.users.get(existingId) : undefined;
    let isNewAccount = false;
    if (!user) {
      const groupId = this.groupByFingerprint.get(fingerprint) ?? this.groupByIp.get(ip) ?? `grp_${randomUUID()}`;
      user = {
        id: `u_${randomUUID()}`,
        identityGroupId: groupId,
        deviceFingerprint: fingerprint,
        registerIp: ip,
        ips: new Set([ip]),
        status: "normal",
        statusReason: "",
        createdAt: t,
        lastActiveAt: t,
        callCount: 0,
      };
      this.users.set(user.id, user);
      this.byFingerprint.set(fingerprint, user.id);
      isNewAccount = true;
    }
    this.bindIdentity(user, fingerprint, ip);
    if (this.isBlacklisted(fingerprint, ip) && user.status !== "blacklisted") {
      user.status = "blacklisted";
      user.statusReason = "关联设备或 IP 已被拉黑";
    }
    const token = randomBytes(24).toString("base64url");
    const session: StoredSession = { token, userId: user.id, fingerprint, ip, createdAt: t, expiresAt: t + ENV.sessionTtlHours * HOUR };
    this.sessions.set(token, session);
    return { user, session, isNewAccount };
  }

  private bindIdentity(user: StoredUser, fingerprint: string, ip: string) {
    user.ips.add(ip);
    user.lastActiveAt = this.now();
    if (!this.groupByFingerprint.has(fingerprint)) this.groupByFingerprint.set(fingerprint, user.identityGroupId);
    if (!this.groupByIp.has(ip)) this.groupByIp.set(ip, user.identityGroupId);
  }

  resolveSession(token: string | undefined, fingerprint: string, ip: string) {
    if (!token) return null;
    const s = this.sessions.get(token);
    if (!s || s.expiresAt < this.now()) return null;
    // 会话必须与设备指纹匹配，防止令牌被搬到其他设备复用
    if (s.fingerprint !== fingerprint) return null;
    const user = this.users.get(s.userId);
    if (!user) return null;
    this.bindIdentity(user, fingerprint, ip);
    return user;
  }

  isBlacklisted(fingerprint: string | null, ip: string) {
    return (fingerprint !== null && this.blacklistedFingerprints.has(fingerprint)) || this.blacklistedIps.has(ip);
  }

  // ---------- IP 频率 ----------
  hitIp(ip: string, limitPerMinute: number) {
    const t = this.now();
    const arr = (this.ipHits.get(ip) ?? []).filter((x) => x > t - 60_000);
    if (arr.length >= limitPerMinute) {
      this.ipHits.set(ip, arr);
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((arr[0] + 60_000 - t) / 1000)) };
    }
    arr.push(t);
    this.ipHits.set(ip, arr);
    return { allowed: true, retryAfterSec: 0 };
  }

  // ---------- 重复内容 ----------
  isDuplicate(groupId: string, contentHash: string) {
    const t = this.now();
    const windowMs = RISK.duplicateWindowMinutes * 60_000;
    const m = this.recentContent.get(groupId) ?? new Map<string, number>();
    for (const [h, at] of m) if (at < t - windowMs) m.delete(h);
    this.recentContent.set(groupId, m);
    return m.has(contentHash);
  }

  rememberContent(groupId: string, contentHash: string) {
    const m = this.recentContent.get(groupId) ?? new Map<string, number>();
    m.set(contentHash, this.now());
    this.recentContent.set(groupId, m);
  }

  // ---------- 额度 ----------
  groupUsage(groupId: string) {
    const t = this.now();
    const calls = (this.groupCalls.get(groupId) ?? []).filter((x) => x > t - DAY);
    this.groupCalls.set(groupId, calls);
    return { lastHour: calls.filter((x) => x > t - HOUR).length, lastDay: calls.length };
  }

  quotaFor(user: StoredUser) {
    const isNew = this.now() - user.createdAt < RISK.newAccountWindowHours * HOUR;
    return isNew
      ? { isNew, hourly: RISK.newAccountHourly, daily: RISK.newAccountDaily }
      : { isNew, hourly: RISK.normalHourly, daily: RISK.normalDaily };
  }

  recordCall(user: StoredUser) {
    const t = this.now();
    const calls = this.groupCalls.get(user.identityGroupId) ?? [];
    calls.push(t);
    this.groupCalls.set(user.identityGroupId, calls);
    user.callCount += 1;
    user.lastActiveAt = t;
    this.bumpDailyTotal();
  }

  resetQuota(userId: string) {
    const u = this.users.get(userId);
    if (!u) return false;
    this.groupCalls.set(u.identityGroupId, []);
    this.recentContent.delete(u.identityGroupId);
    return true;
  }

  // ---------- 熔断 ----------
  private rollDay() {
    const ds = dayStartCst(this.now());
    if (this.dailyTotal.dayStart !== ds) this.dailyTotal = { dayStart: ds, count: 0, alerted: false, tripped: false };
  }

  private bumpDailyTotal() {
    this.rollDay();
    this.dailyTotal.count += 1;
    const { count } = this.dailyTotal;
    if (!this.dailyTotal.alerted && count >= RISK.dailyTotalLimit * RISK.alertRatio) {
      this.dailyTotal.alerted = true;
      this.raiseAlert("warning", `今日总调用量已达 ${count}，接近熔断阈值 ${RISK.dailyTotalLimit}`);
    }
    if (!this.dailyTotal.tripped && count >= RISK.dailyTotalLimit) {
      this.dailyTotal.tripped = true;
      this.raiseAlert("critical", `今日总调用量 ${count} 已达熔断阈值，生成服务已自动暂停`);
    }
  }

  breakerState() {
    this.rollDay();
    return {
      dailyTotal: this.dailyTotal.count,
      limit: RISK.dailyTotalLimit,
      open: this.manualBreakerOpen || this.dailyTotal.count >= RISK.dailyTotalLimit,
      manual: this.manualBreakerOpen,
    };
  }

  raiseAlert(level: Alert["level"], message: string) {
    const alert = { id: ++this.alertSeq, level, message, createdAt: this.now() };
    this.alerts.unshift(alert);
    this.alerts.length = Math.min(this.alerts.length, 200);
    // 告警出口：当前打印到服务端日志；接入后可替换为企业微信 / 钉钉 / 短信机器人
    console.warn(`[ALERT][${level}] ${message}`);
    this.log({ action: "circuit_breaker", endpoint: "-", ip: "-", result: "alert", reason: message });
    return alert;
  }

  // ---------- 用户状态 ----------
  setStatus(userId: string, status: UserStatus, reason: string) {
    const u = this.users.get(userId);
    if (!u) return null;
    u.status = status;
    u.statusReason = reason;
    if (status === "blacklisted") {
      this.blacklistedFingerprints.add(u.deviceFingerprint);
      for (const ip of u.ips) this.blacklistedIps.add(ip);
    } else {
      this.blacklistedFingerprints.delete(u.deviceFingerprint);
      for (const ip of u.ips) this.blacklistedIps.delete(ip);
    }
    return u;
  }

  // ---------- 日志 / 记录 ----------
  log(entry: Partial<OperationLog> & Pick<OperationLog, "action" | "endpoint" | "ip" | "result" | "reason">) {
    const row: OperationLog = {
      id: ++this.logSeq,
      userId: entry.userId ?? null,
      identityGroupId: entry.identityGroupId ?? null,
      deviceFingerprint: entry.deviceFingerprint ?? null,
      contentHash: entry.contentHash ?? null,
      createdAt: this.now(),
      ...entry,
    } as OperationLog;
    this.logs.unshift(row);
    if (this.logs.length > 5000) this.logs.length = 5000;
    return row;
  }

  addGeneration(user: StoredUser, kind: GenerationRecord["kind"], contentHash: string, summary: string) {
    const rec: GenerationRecord = {
      id: `gen_${randomUUID()}`,
      userId: user.id,
      identityGroupId: user.identityGroupId,
      kind,
      contentHash,
      summary: summary.slice(0, 120),
      createdAt: this.now(),
    };
    this.generations.unshift(rec);
    return rec;
  }

  /** 记忆库：按用户 ID 归档，按时间倒序 */
  memoryOf(userId: string, limit = 50) {
    const u = this.users.get(userId);
    if (!u) return null;
    return {
      userId: u.id,
      identityGroupId: u.identityGroupId,
      deviceFingerprint: u.deviceFingerprint,
      ips: [...u.ips],
      registeredAt: u.createdAt,
      lastActiveAt: u.lastActiveAt,
      callCount: u.callCount,
      generations: this.generations.filter((g) => g.userId === userId).slice(0, limit),
    };
  }

  blacklist() {
    return {
      users: [...this.users.values()].filter((u) => u.status === "blacklisted"),
      fingerprints: [...this.blacklistedFingerprints],
      ips: [...this.blacklistedIps],
    };
  }
}

export const riskStore = new MemoryRiskStore();
