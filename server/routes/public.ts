/**
 * 对外业务接口（全部返回静态假数据，不接入真实 AI 服务与数据库）：
 *   POST /api/session/init   会话初始化（设备指纹 → 账号 / 身份组）
 *   POST /api/track          前端埋点
 *   GET  /api/hot            热点信息
 *   GET  /api/workflow       工作流节点状态
 *   POST /api/workflow       提交图生视频任务（风控计费）
 *   POST /api/bazi           八字排盘（风控计费）
 *   POST /api/miniapp        小程序代写方案（风控计费）
 */
import { Router } from "express";
import {
  OUTPUT_FORMAT_LABEL,
  TOPIC_CATEGORY_LABEL,
  type BaziInput,
  type MiniappInput,
  type OutputFormat,
  type SessionInitResult,
  type TopicCategory,
  type WorkflowRunInput,
  type WorkflowRunResult,
} from "@shared/api";
import { buildHotFeed } from "../hot/engine";
import { buildLocalizedScript } from "../localization/cnLocalizer";
import { mockBazi } from "../mock/baziData";
import { mockMiniapp } from "../mock/miniappData";
import { WORKFLOW_NODES, WORKFLOW_OVERVIEW } from "../mock/workflowData";
import { clientIp, createLightLimiter, createRiskGuard, readFingerprint, reject, type Validator } from "../risk/middleware";
import type { MemoryRiskStore } from "../risk/store";
import { isOneOf, isStr } from "./validate";

const CATEGORIES = Object.keys(TOPIC_CATEGORY_LABEL) as TopicCategory[];
const FORMATS: OutputFormat[] = ["vertical_video", "note_cards", "social_video"];
const pickFormats = (v: unknown): OutputFormat[] => (Array.isArray(v) ? [...new Set(v.filter((f): f is OutputFormat => isOneOf(f, FORMATS)))] : []);

export function publicRouter(store: MemoryRiskStore) {
  const r = Router();
  const guard = createRiskGuard(store);
  const light = createLightLimiter(store);

  r.post("/session/init", light, (req, res) => {
    const fp = readFingerprint(req);
    if (!fp) return reject(res, 400, "MISSING_FINGERPRINT", "请求缺少设备标识，请刷新页面后重试");
    const ip = clientIp(req);
    const { user, session, isNewAccount } = store.registerOrLogin(fp, ip);
    store.log({ userId: user.id, identityGroupId: user.identityGroupId, deviceFingerprint: fp, ip, action: isNewAccount ? "register" : "login", endpoint: "/api/session/init", result: "allowed", reason: "ok" });
    const data: SessionInitResult = { token: session.token, userId: user.id, expiresAt: new Date(session.expiresAt).toISOString(), isNewAccount };
    res.json({ ok: true, data });
  });

  r.post("/track", createLightLimiter(store, 60), (req, res) => {
    const fp = readFingerprint(req);
    const event = isStr(req.body?.event, 1, 64) ? req.body.event : null;
    if (!fp || !event) return res.status(204).end();
    store.log({ deviceFingerprint: fp, ip: clientIp(req), action: `track:${event}`, endpoint: String(req.body?.path ?? "").slice(0, 120), result: "track", reason: "ok" });
    res.status(204).end();
  });

  r.get("/hot", (req, res) => {
    const c = req.query.category;
    res.json({ ok: true, data: buildHotFeed(isOneOf(c, CATEGORIES) ? c : undefined) });
  });

  r.get("/workflow", (_req, res) => {
    res.json({ ok: true, data: WORKFLOW_OVERVIEW });
  });

  const validWorkflow: Validator = (b) =>
    isStr(b.topic, 2, 200) && isOneOf(b.category, CATEGORIES) && isOneOf(b.scene, ["rural", "city", "family"] as const) && pickFormats(b.formats).length > 0
      ? null
      : "请填写选题（2–200 字），并选择分类、场景和至少一种输出规格";

  r.post("/workflow", guard(validWorkflow), (req, res) => {
    const b = req.body;
    const formats = pickFormats(b.formats);
    const input: WorkflowRunInput = { topic: b.topic, category: b.category, scene: b.scene, formats, imageName: isStr(b.imageName, 1, 200) ? b.imageName : undefined };
    const script = buildLocalizedScript(input);
    const rec = store.addGeneration(req.riskUser!, "workflow", req.contentHash!, script.title);
    const { compliance, ...localizedScript } = script;
    const data: WorkflowRunResult = {
      jobId: rec.id,
      createdAt: new Date(rec.createdAt).toISOString(),
      nodes: WORKFLOW_NODES.map((n) => (n.id === "compliance" && !compliance.passed ? { ...n, status: "running" } : n)),
      localizedScript,
      compliance,
      deliverables: formats.map((f) => ({ format: f, label: OUTPUT_FORMAT_LABEL[f], status: "pending" as const })),
    };
    res.json({ ok: true, data });
  });

  const validBazi: Validator = (b) =>
    isOneOf(b.gender, ["male", "female"] as const) && /^\d{4}-\d{2}-\d{2}$/.test(String(b.birthDate)) && /^\d{2}:\d{2}$/.test(String(b.birthTime))
      ? null
      : "请填写性别、公历出生日期与时间";

  r.post("/bazi", guard(validBazi), (req, res) => {
    const b = req.body;
    const input: BaziInput = { gender: b.gender, birthDate: b.birthDate, birthTime: b.birthTime, name: isStr(b.name, 1, 20) ? b.name : undefined, birthPlace: isStr(b.birthPlace, 1, 40) ? b.birthPlace : undefined };
    const rec = store.addGeneration(req.riskUser!, "bazi", req.contentHash!, `${input.birthDate} ${input.birthTime}`);
    res.json({ ok: true, data: mockBazi(input, rec.id) });
  });

  const validMiniapp: Validator = (b) =>
    isOneOf(b.type, ["booking", "shop", "ordering", "tool", "community"] as const) && isOneOf(b.budget, ["lt5k", "5k-20k", "20k-50k", "gt50k"] as const) && isStr(b.requirement, 5, 2000)
      ? null
      : "请选择小程序类型、预算，并用至少 5 个字描述需求";

  r.post("/miniapp", guard(validMiniapp), (req, res) => {
    const b = req.body;
    const input: MiniappInput = { type: b.type, budget: b.budget, requirement: b.requirement, contact: isStr(b.contact, 1, 60) ? b.contact : undefined };
    const rec = store.addGeneration(req.riskUser!, "miniapp", req.contentHash!, input.requirement);
    res.json({ ok: true, data: mockMiniapp(input, rec.id) });
  });

  return r;
}
