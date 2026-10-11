import { describe, expect, it } from "vitest";
import { RISK } from "../server/config/env";
import { FP_A, FP_B, miniBody, setup } from "./helpers";

describe("业务风控", () => {
  it("缺少设备指纹返回 400，会话无效返回 401", async () => {
    const { app } = setup();
    const request = (await import("supertest")).default;
    expect((await request(app).post("/api/bazi").send({})).status).toBe(400);
    expect((await request(app).post("/api/bazi").set("device-fingerprint", FP_A).send({})).status).toBe(401);
  });

  it("新号每小时最多 3 次（IP 限流放宽后验证）", async () => {
    let now = Date.UTC(2026, 9, 7, 2);
    const { session, gen } = setup(() => now);
    const token = await session(FP_A);
    for (let i = 0; i < 3; i++) {
      expect((await gen(FP_A, token, miniBody(i))).status).toBe(200);
      now += 61_000; // 跳出 IP 每分钟窗口
    }
    const r = await gen(FP_A, token, miniBody(9));
    expect(r.status).toBe(429);
    expect(r.body.code).toBe("QUOTA_HOURLY");
  });

  it("新号每天最多 10 次", async () => {
    let now = Date.UTC(2026, 9, 7, 0);
    const { session, gen } = setup(() => now);
    const token = await session(FP_A);
    let ok = 0;
    for (let i = 0; i < 14; i++) {
      const r = await gen(FP_A, token, miniBody(i));
      if (r.status === 200) ok++;
      now += 21 * 60_000; // 每小时最多 3 次 → 间隔 21 分钟
    }
    expect(ok).toBe(RISK.newAccountDaily);
  });

  it("同一 IP 注册的多个账号共享额度", async () => {
    let now = Date.UTC(2026, 9, 7, 2);
    const { session, gen } = setup(() => now);
    const ta = await session(FP_A, "2.2.2.2");
    const tb = await session(FP_B, "2.2.2.2");
    for (let i = 0; i < 3; i++) {
      expect((await gen(i % 2 ? FP_B : FP_A, i % 2 ? tb : ta, miniBody(i))).status).toBe(200);
      now += 61_000;
    }
    expect((await gen(FP_B, tb, miniBody(99))).body.code).toBe("QUOTA_HOURLY");
  });

  it("IP 每分钟超过 5 次返回 429", async () => {
    const { session, gen } = setup();
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const fp = (i.toString(16) + "c").repeat(32).slice(0, 64);
      const token = await session(fp, "3.3.3.3");
      codes.push((await gen(fp, token, { type: "booking", budget: "lt5k", requirement: "x" })).status);
    }
    expect(codes.slice(0, 5).every((c) => c === 400)).toBe(true); // 参数错误也计入频率
    expect(codes[5]).toBe(429);
  });

  it("5 分钟内重复提交相同内容被拒绝并记录日志", async () => {
    let now = Date.UTC(2026, 9, 7, 2);
    const { store, session, gen } = setup(() => now);
    const token = await session(FP_A);
    expect((await gen(FP_A, token, miniBody(1))).status).toBe(200);
    now += 61_000;
    const r = await gen(FP_A, token, miniBody(1));
    expect(r.status).toBe(409);
    expect(store.logs.some((l) => l.reason === "duplicate_content")).toBe(true);
    now += 5 * 60_000;
    expect((await gen(FP_A, token, miniBody(1))).status).toBe(200);
  });

  it("拉黑后同设备新会话也被拒绝；恢复后可用", async () => {
    const { store, session, gen } = setup();
    const token = await session(FP_A, "4.4.4.4");
    const userId = [...store.users.values()][0].id;
    store.setStatus(userId, "blacklisted", "test");
    expect((await gen(FP_A, token, miniBody(1))).status).toBe(403);
    const t2 = await session(FP_A, "4.4.4.4");
    expect((await gen(FP_A, t2, miniBody(2))).status).toBe(403);
    store.setStatus(userId, "normal", "");
    expect((await gen(FP_A, t2, miniBody(3))).status).toBe(200);
  });

  it("单日总量达到阈值自动熔断并告警", async () => {
    const { store, session, gen } = setup();
    const token = await session(FP_A);
    for (let i = 0; i < RISK.dailyTotalLimit; i++) store.recordCall([...store.users.values()][0]);
    const r = await gen(FP_A, token, miniBody(1));
    expect(r.status).toBe(503);
    expect(store.alerts.some((a) => a.level === "critical")).toBe(true);
  });

  it("重置额度后可继续调用", async () => {
    let now = Date.UTC(2026, 9, 7, 2);
    const { store, session, gen } = setup(() => now);
    const token = await session(FP_A);
    for (let i = 0; i < 3; i++) { await gen(FP_A, token, miniBody(i)); now += 61_000; }
    expect((await gen(FP_A, token, miniBody(5))).status).toBe(429);
    store.resetQuota([...store.users.values()][0].id);
    now += 61_000;
    expect((await gen(FP_A, token, miniBody(6))).status).toBe(200);
  });
});
