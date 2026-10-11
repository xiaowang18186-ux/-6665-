/**
 * 国内本土化脚本处理（替换原欧美版“德州背景 / 皮卡 / 美金”等本土化改写逻辑）。
 *
 * 当前为纯规则实现：
 *   - 欧美元素 → 国内元素词表替换
 *   - 场景预设（乡村 / 城市 / 家庭）
 *   - 分镜脚本模板（钩子 → 冲突 → 转折 → 温情收尾）
 *   - 合规检查 + 健康类自动追加免责声明
 * 后续接入国内大模型时，规则层依然保留作为兜底与后处理。
 */
import type { TopicCategory, WorkflowRunInput, WorkflowRunResult } from "@shared/api";
import { checkCompliance, HEALTH_DISCLAIMER } from "./compliance";

/** 欧美本土化元素 → 国内元素 */
export const WESTERN_TO_CN: [RegExp, string][] = [
  [/德克萨斯|德州|Texas/gi, "县城"],
  [/F-?350|皮卡|pickup/gi, "电动三轮"],
  [/美金|美元|\$|USD/gi, "元"],
  [/感恩节|Thanksgiving/gi, "中秋节"],
  [/圣诞节|Christmas/gi, "春节"],
  [/汉堡|热狗/g, "包子"],
  [/后院烧烤|BBQ/gi, "院子里吃饭"],
  [/教堂/g, "村委会"],
  [/高中舞会|prom/gi, "毕业聚餐"],
  [/保险经纪人/g, "村里的会计"],
  [/房贷|mortgage/gi, "房贷"],
  [/英里|mile/gi, "公里"],
];

export const SCENE_PRESET = {
  rural: { label: "乡村", place: "北方农村小院", props: ["土灶", "电动三轮", "晾衣绳", "大黄狗"], light: "傍晚暖光" },
  city: { label: "城市", place: "老小区两居室", props: ["电动车", "外卖袋", "地铁卡", "阳台绿萝"], light: "清晨自然光" },
  family: { label: "家庭", place: "客厅饭桌", props: ["八仙桌", "电饭煲", "全家福", "电视机"], light: "室内暖黄灯" },
} as const;

const HOOKS: Record<TopicCategory, string> = {
  emotion: "那天他在车站站了一个小时，才敢给我打电话。",
  family: "分家那天，大哥一句话让全家人都沉默了。",
  health: "邻居王阿姨坚持了三个月的这个习惯，体检时医生都问她怎么做到的。",
  social: "小区门口那家开了二十年的早餐店，今天贴出了一张告示。",
  local: "在我们县城，有一条街只在早上六点到八点热闹。",
};

const TAGS: Record<TopicCategory, string[]> = {
  emotion: ["生活情感", "真实故事", "治愈"],
  family: ["家庭", "亲情", "人间烟火"],
  health: ["健康生活", "好习惯", "中老年"],
  social: ["社会观察", "身边事", "正能量"],
  local: ["本地生活", "烟火气", "县城日常"],
};

export function localizeText(text: string) {
  return WESTERN_TO_CN.reduce((acc, [re, rep]) => acc.replace(re, rep), text);
}

export function buildLocalizedScript(input: WorkflowRunInput): WorkflowRunResult["localizedScript"] & { compliance: WorkflowRunResult["compliance"] } {
  const scene = SCENE_PRESET[input.scene];
  const topic = localizeText(input.topic.trim());
  const lines = [
    { shot: "镜头 01", narration: HOOKS[input.category], visual: `${scene.place}，${scene.light}，人物背影特写` },
    { shot: "镜头 02", narration: `说起「${topic}」，我们身边几乎每家都遇到过。`, visual: `${scene.props[0]}、${scene.props[1]} 等生活细节空镜` },
    { shot: "镜头 03", narration: "那时候谁都觉得自己没错，话越说越僵。", visual: "人物对坐，沉默，手部特写" },
    { shot: "镜头 04", narration: "直到一件小事，让大家把心里话说了出来。", visual: `${scene.props[2]}旁，人物转身对视` },
    { shot: "镜头 05", narration: "日子是过出来的，不是争出来的。你家有没有类似的故事？", visual: `${scene.props[3]}，全景收尾，暖色调` },
  ];
  const all = [topic, ...lines.map((l) => l.narration)].join("\n");
  const check = checkCompliance(all);
  const notes = check.issues.map((i) => `【${i.rule}】“${i.match}”：${i.suggestion}`);
  if (input.category === "health") notes.push(`已自动追加免责声明：${HEALTH_DISCLAIMER}`);
  if (notes.length === 0) notes.push("未发现违规表述");
  return {
    title: `${scene.label}故事｜${topic}`.slice(0, 30),
    hook: lines[0].narration,
    lines,
    tags: TAGS[input.category],
    compliance: { passed: check.passed, notes },
  };
}
