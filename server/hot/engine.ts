/**
 * 热点引擎（参照 AIHOT 框架逻辑：采集 → 去重聚类 → 热度打分 → 合规过滤 → 选题建议）。
 * 当前阶段：不抓取任何站点，不调用任何大模型，仅对静态种子信号做打分排序，作为选题输入源。
 */
import type { HotFeed, HotItem, TopicCategory } from "@shared/api";
import { checkCompliance } from "../localization/compliance";
import { HOT_SEEDS, type HotSeed } from "../mock/hotSeeds";

/** 热度 = 互动量(对数) × 0.5 + 增速 × 0.3 + 跨源覆盖 × 0.2，归一化到 0–100 */
export function scoreSeed(s: HotSeed) {
  const interaction = Math.min(1, Math.log10(1 + s.interactions) / 7);
  const velocity = Math.max(0, Math.min(1, s.growthRate));
  const coverage = Math.min(1, s.sourceCount / 5);
  return Math.round((interaction * 0.5 + velocity * 0.3 + coverage * 0.2) * 100);
}

/** 简单去重：标题归一化后相同视为同一事件，保留互动量更高的 */
export function dedupe(seeds: HotSeed[]) {
  const map = new Map<string, HotSeed>();
  for (const s of seeds) {
    const key = s.title.replace(/[\s，。！？、,.!?]/g, "");
    const prev = map.get(key);
    if (!prev || prev.interactions < s.interactions) map.set(key, s);
  }
  return [...map.values()];
}

export function buildHotFeed(category?: TopicCategory): HotFeed {
  const unique = dedupe(HOT_SEEDS);
  const items: HotItem[] = unique
    .map((s) => {
      const check = checkCompliance(s.title + s.angle);
      const risk: HotItem["risk"] = !check.passed ? "high" : check.issues.length ? "medium" : s.sensitive ? "medium" : "low";
      return { s, risk, score: scoreSeed(s) };
    })
    // 合规过滤：高风险话题不进入选题池
    .filter((x) => x.risk !== "high")
    .filter((x) => !category || x.s.category === category)
    .sort((a, b) => b.score - a.score)
    .map((x, i) => ({
      id: x.s.id,
      rank: i + 1,
      title: x.s.title,
      category: x.s.category,
      sourceType: x.s.sourceType,
      heatScore: x.score,
      trend: x.s.growthRate > 0.5 ? "up" : x.s.growthRate < 0.15 ? "down" : "flat",
      risk: x.risk,
      angle: x.s.angle,
      updatedAt: x.s.updatedAt,
    }));

  return {
    generatedAt: "2026-10-07T08:00:00+08:00",
    pipeline: [
      { step: "多源采集", detail: "短视频 / 图文社区 / 资讯 / 本地生活榜单", status: "pending" },
      { step: "去重聚类", detail: "同一事件合并，保留代表条目", status: "done" },
      { step: "热度打分", detail: "互动量 × 增速 × 跨源覆盖", status: "done" },
      { step: "合规过滤", detail: "剔除医疗伪科学、迷信、敏感时政", status: "done" },
      { step: "选题建议", detail: "输出可落地的家庭 / 生活切入角度", status: "done" },
    ],
    items,
  };
}
