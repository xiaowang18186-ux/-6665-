import request from "supertest";
import { describe, expect, it } from "vitest";
import { FP_A, setup } from "./helpers";

describe("预埋接口（静态假数据）", () => {
  it("GET /api/hot 返回去重、合规过滤后的热点", async () => {
    const { app } = setup();
    const r = await request(app).get("/api/hot");
    expect(r.body.ok).toBe(true);
    const titles: string[] = r.body.data.items.map((i: { title: string }) => i.title);
    expect(titles.some((t) => t.includes("根治") || t.includes("转运"))).toBe(false);
    expect(titles.filter((t) => t.startsWith("国庆返乡")).length).toBe(1);
    const h = await request(app).get("/api/hot?category=health");
    expect(h.body.data.items.every((i: { category: string }) => i.category === "health")).toBe(true);
  });

  it("GET /api/workflow 只返回节点状态，含图生视频节点", async () => {
    const { app } = setup();
    const r = await request(app).get("/api/workflow");
    const nodes = r.body.data.nodes as { id: string; status: string }[];
    expect(nodes.find((n) => n.id === "image_to_video")).toBeTruthy();
    expect(nodes.every((n) => ["running", "done", "pending"].includes(n.status))).toBe(true);
  });

  it("POST /api/workflow 本土化改写并替换欧美元素", async () => {
    const { session, gen } = setup();
    const token = await session(FP_A);
    const r = await gen(FP_A, token, { topic: "德州老爹开着F-350去还 500 美元的债", category: "family", scene: "rural", formats: ["vertical_video"] }, "/api/workflow");
    expect(r.status).toBe(200);
    const text = JSON.stringify(r.body.data.localizedScript);
    expect(text).not.toMatch(/德州|F-350|美元/);
    expect(text).toMatch(/县城|电动三轮|元/);
  });

  it("POST /api/workflow 健康类选题追加免责声明，伪科学被拦截", async () => {
    const { session, gen } = setup();
    const token = await session(FP_A);
    const r = await gen(FP_A, token, { topic: "祖传秘方三天见效", category: "health", scene: "city", formats: ["note_cards"] }, "/api/workflow");
    expect(r.body.data.compliance.passed).toBe(false);
    expect(r.body.data.compliance.notes.join("")).toContain("免责声明");
  });

  it("POST /api/bazi 与 /api/miniapp 返回假数据并写入记忆库（时间倒序）", async () => {
    let now = Date.UTC(2026, 9, 7, 2);
    const { store, app, session, gen } = setup(() => now);
    const token = await session(FP_A);
    const b = await gen(FP_A, token, { gender: "male", birthDate: "1990-01-01", birthTime: "08:00" }, "/api/bazi");
    expect(b.body.data.pillars).toHaveLength(4);
    expect(b.body.data.disclaimer).toContain("传统文化");
    now += 61_000;
    const m = await gen(FP_A, token, { type: "shop", budget: "gt50k", requirement: "做一个水果商城" });
    expect(m.body.data.quote.currency).toBe("CNY");
    const userId = [...store.users.values()][0].id;
    const mem = await request(app).get(`/api/admin/users/${userId}/memory`).set("x-admin-token", "dev-admin-token");
    expect(mem.body.data.generations.map((g: { kind: string }) => g.kind)).toEqual(["miniapp", "bazi"]);
  });

  it("/api/admin 需要管理员令牌，服务名称只在后台返回", async () => {
    const { app } = setup();
    expect((await request(app).get("/api/admin/providers")).status).toBe(401);
    const r = await request(app).get("/api/admin/providers").set("x-admin-token", "dev-admin-token");
    expect(JSON.stringify(r.body)).toContain("剪映");
    const pub = await request(app).get("/api/workflow");
    expect(JSON.stringify(pub.body)).not.toContain("剪映");
  });
});
