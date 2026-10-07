/** 热点静态种子数据（假数据，非真实抓取） */
import type { HotItem, TopicCategory } from "@shared/api";

export type HotSeed = {
  id: string;
  title: string;
  category: TopicCategory;
  sourceType: HotItem["sourceType"];
  interactions: number;
  growthRate: number;
  sourceCount: number;
  sensitive?: boolean;
  angle: string;
  updatedAt: string;
};

export const HOT_SEEDS: HotSeed[] = [
  { id: "h01", title: "国庆返乡，年轻人带爸妈第一次坐高铁", category: "family", sourceType: "短视频", interactions: 3_820_000, growthRate: 0.82, sourceCount: 4, angle: "从“第一次”切入，拍父母的紧张与骄傲", updatedAt: "2026-10-07T07:40:00+08:00" },
  { id: "h02", title: "婆婆悄悄把养老钱塞进儿媳的行李箱", category: "family", sourceType: "图文社区", interactions: 1_960_000, growthRate: 0.66, sourceCount: 3, angle: "婆媳关系反转，温情结尾，避免对立撕扯", updatedAt: "2026-10-07T07:20:00+08:00" },
  { id: "h03", title: "县城早餐店老板坚持 2 元豆浆十年", category: "local", sourceType: "本地生活", interactions: 860_000, growthRate: 0.58, sourceCount: 2, angle: "小人物坚持，镜头聚焦凌晨四点的灶台", updatedAt: "2026-10-07T06:55:00+08:00" },
  { id: "h04", title: "退休阿姨每天快走 40 分钟，体检指标变化引热议", category: "health", sourceType: "短视频", interactions: 1_240_000, growthRate: 0.47, sourceCount: 3, angle: "只讲习惯坚持与心态，不做疗效承诺，附就医提示", updatedAt: "2026-10-07T07:05:00+08:00" },
  { id: "h05", title: "异地恋八年，两人在老家县城开了一家照相馆", category: "emotion", sourceType: "图文社区", interactions: 2_300_000, growthRate: 0.71, sourceCount: 3, angle: "时间线叙事，用老照片做转场", updatedAt: "2026-10-07T06:30:00+08:00" },
  { id: "h06", title: "小区业主自发给外卖员设立休息点", category: "social", sourceType: "资讯", interactions: 1_580_000, growthRate: 0.39, sourceCount: 4, angle: "邻里互助正能量，采访式口播", updatedAt: "2026-10-07T05:50:00+08:00" },
  { id: "h07", title: "秋收季，村里年轻人直播帮老人卖苹果", category: "local", sourceType: "短视频", interactions: 2_050_000, growthRate: 0.62, sourceCount: 5, angle: "乡村振兴视角，突出劳动与笑脸", updatedAt: "2026-10-07T07:10:00+08:00" },
  { id: "h08", title: "儿子把父亲的旧二八自行车修好了", category: "emotion", sourceType: "短视频", interactions: 970_000, growthRate: 0.54, sourceCount: 2, angle: "物件承载记忆，适合图生视频老照片动态化", updatedAt: "2026-10-07T06:10:00+08:00" },
  { id: "h09", title: "秋季养生：早睡早起比什么补品都管用", category: "health", sourceType: "图文社区", interactions: 640_000, growthRate: 0.21, sourceCount: 2, angle: "生活习惯科普，引用公开健康指南，不推销产品", updatedAt: "2026-10-07T05:20:00+08:00" },
  { id: "h10", title: "某偏方三天根治高血压？医生辟谣", category: "health", sourceType: "资讯", interactions: 1_100_000, growthRate: 0.44, sourceCount: 3, angle: "（含疗效承诺用语，合规过滤演示条目）", updatedAt: "2026-10-07T06:00:00+08:00" },
  { id: "h11", title: "转运手链卖爆？消费者投诉增多", category: "social", sourceType: "资讯", interactions: 520_000, growthRate: 0.33, sourceCount: 2, angle: "（含迷信用语，合规过滤演示条目）", updatedAt: "2026-10-07T05:40:00+08:00" },
  { id: "h12", title: "三代同堂过中秋，奶奶的月饼模具传了五十年", category: "family", sourceType: "短视频", interactions: 1_420_000, growthRate: 0.12, sourceCount: 3, angle: "传统手艺 + 家庭团圆，节日余温选题", updatedAt: "2026-10-07T04:30:00+08:00" },
  { id: "h13", title: "城中村改造后，老街坊重新聚在一起下棋", category: "social", sourceType: "本地生活", interactions: 430_000, growthRate: 0.28, sourceCount: 2, sensitive: true, angle: "只讲邻里情感，不评价政策", updatedAt: "2026-10-07T05:10:00+08:00" },
  { id: "h14", title: "国庆返乡，年轻人带爸妈第一次坐高铁！", category: "family", sourceType: "资讯", interactions: 410_000, growthRate: 0.5, sourceCount: 1, angle: "（重复条目，去重演示）", updatedAt: "2026-10-07T07:00:00+08:00" },
];
