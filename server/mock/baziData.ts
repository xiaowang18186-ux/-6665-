/** 八字排盘静态假数据（未接入真实历法计算） */
import type { BaziInput, BaziResult } from "@shared/api";
import { CULTURE_DISCLAIMER } from "../localization/compliance";

export function mockBazi(input: BaziInput, recordId: string): BaziResult {
  return {
    recordId,
    input,
    lunarDate: "（示例）乙巳年 八月 十六 午时",
    pillars: [
      { label: "年柱", stem: "乙", branch: "巳", element: "木 / 火", tenGod: "正印" },
      { label: "月柱", stem: "乙", branch: "酉", element: "木 / 金", tenGod: "正印" },
      { label: "日柱", stem: "丙", branch: "午", element: "火 / 火", tenGod: "日主" },
      { label: "时柱", stem: "甲", branch: "午", element: "木 / 火", tenGod: "偏印" },
    ],
    fiveElements: [
      { element: "木", count: 3 },
      { element: "火", count: 4 },
      { element: "土", count: 0 },
      { element: "金", count: 1 },
      { element: "水", count: 0 },
    ],
    dayMaster: "丙火",
    summary: [
      "四柱以木、火为主，命盘结构直观，适合作为传统历法与干支知识的学习示例。",
      "天干地支、五行与十神均为中国传统文化中的符号体系，可用于了解古代历法与民俗。",
      "本结果为演示数据，未进行真实历法换算。",
    ],
    disclaimer: CULTURE_DISCLAIMER,
  };
}
