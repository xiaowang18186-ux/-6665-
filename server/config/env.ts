/** 运行时配置：全部来自环境变量，带安全默认值。 */
const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

const isProd = process.env.NODE_ENV === "production";

export const ENV = {
  isProd,
  port: num(process.env.PORT, 3000),
  /** 反向代理层数，用于正确读取客户端 IP（0 = 不信任代理头） */
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  /** 生产环境必须显式配置；未配置时 /api/admin 全部拒绝 */
  adminToken: process.env.ADMIN_TOKEN ?? (isProd ? "" : "dev-admin-token"),
  databaseUrl: process.env.DATABASE_URL ?? "",
  sessionTtlHours: num(process.env.SESSION_TTL_HOURS, 24 * 7),
};

/** 风控阈值，可通过环境变量调整 */
export const RISK = {
  newAccountWindowHours: num(process.env.RISK_NEW_ACCOUNT_HOURS, 24),
  newAccountHourly: num(process.env.RISK_NEW_ACCOUNT_HOURLY, 3),
  newAccountDaily: num(process.env.RISK_NEW_ACCOUNT_DAILY, 10),
  normalHourly: num(process.env.RISK_NORMAL_HOURLY, 20),
  normalDaily: num(process.env.RISK_NORMAL_DAILY, 60),
  ipPerMinute: num(process.env.RISK_IP_PER_MINUTE, 5),
  duplicateWindowMinutes: num(process.env.RISK_DUPLICATE_MINUTES, 5),
  /** 单日全站总调用量熔断阈值 */
  dailyTotalLimit: num(process.env.RISK_DAILY_TOTAL_LIMIT, 5000),
  /** 达到阈值的该比例时提前告警 */
  alertRatio: 0.8,
};
