/**
 * 前后端共享的接口契约。
 * 注意：此文件会被前端打包，禁止出现任何第三方软件/服务名称、Key 或用量字段。
 */

/** 前端只允许看到的三种节点状态 */
export type NodeStatus = "running" | "done" | "pending";

export const NODE_STATUS_LABEL: Record<NodeStatus, string> = {
  running: "运行中",
  done: "已完成",
  pending: "待接入",
};

/** 埋点请求头名称 */
export const HEADER_FINGERPRINT = "device-fingerprint";
export const HEADER_SESSION = "x-session-token";

export type ApiError = { ok: false; code: string; message: string; retryAfterSec?: number };
export type ApiOk<T> = { ok: true; data: T };
export type ApiResult<T> = ApiOk<T> | ApiError;

// ---------- 会话 ----------
export type SessionInitResult = {
  token: string;
  userId: string;
  expiresAt: string;
  isNewAccount: boolean;
};

// ---------- 自动化工作流 ----------
export type WorkflowNode = {
  id: string;
  order: number;
  name: string;
  group: "选题" | "文案" | "视觉" | "声音" | "成片" | "分发";
  description: string;
  status: NodeStatus;
};

export type WorkflowOverview = {
  title: string;
  subtitle: string;
  nodes: WorkflowNode[];
  outputs: { key: string; label: string; spec: string }[];
};

export type WorkflowRunInput = {
  topic: string;
  category: TopicCategory;
  scene: "rural" | "city" | "family";
  imageName?: string;
  formats: OutputFormat[];
};

export type WorkflowRunResult = {
  jobId: string;
  createdAt: string;
  nodes: WorkflowNode[];
  localizedScript: {
    title: string;
    hook: string;
    lines: { shot: string; narration: string; visual: string }[];
    tags: string[];
  };
  compliance: { passed: boolean; notes: string[] };
  deliverables: { format: OutputFormat; label: string; status: NodeStatus }[];
};

export type TopicCategory = "emotion" | "family" | "health" | "social" | "local";

export const TOPIC_CATEGORY_LABEL: Record<TopicCategory, string> = {
  emotion: "生活情感",
  family: "家庭伦理",
  health: "健康养生",
  social: "社会热点",
  local: "本地生活",
};

export type OutputFormat = "vertical_video" | "note_cards" | "social_video";

export const OUTPUT_FORMAT_LABEL: Record<OutputFormat, string> = {
  vertical_video: "竖屏短视频版（9:16）",
  note_cards: "图文笔记版（3:4）",
  social_video: "社交视频版（9:16 / 横屏可选）",
};

// ---------- 八字排盘 ----------
export type BaziInput = {
  name?: string;
  gender: "male" | "female";
  birthDate: string; // YYYY-MM-DD 公历
  birthTime: string; // HH:mm
  birthPlace?: string;
};

export type BaziPillar = { label: "年柱" | "月柱" | "日柱" | "时柱"; stem: string; branch: string; element: string; tenGod: string };

export type BaziResult = {
  recordId: string;
  input: BaziInput;
  lunarDate: string;
  pillars: BaziPillar[];
  fiveElements: { element: "木" | "火" | "土" | "金" | "水"; count: number }[];
  dayMaster: string;
  summary: string[];
  disclaimer: string;
};

// ---------- 小程序代写 ----------
export type MiniappInput = {
  type: "booking" | "shop" | "ordering" | "tool" | "community";
  requirement: string;
  budget: "lt5k" | "5k-20k" | "20k-50k" | "gt50k";
  contact?: string;
};

export const MINIAPP_TYPE_LABEL: Record<MiniappInput["type"], string> = {
  booking: "预约服务",
  shop: "电商商城",
  ordering: "扫码点餐",
  tool: "效率工具",
  community: "社区团购 / 社群",
};

export const MINIAPP_BUDGET_LABEL: Record<MiniappInput["budget"], string> = {
  lt5k: "5 千以内",
  "5k-20k": "5 千 – 2 万",
  "20k-50k": "2 万 – 5 万",
  gt50k: "5 万以上",
};

export type MiniappResult = {
  recordId: string;
  projectName: string;
  pages: { name: string; purpose: string }[];
  modules: string[];
  milestones: { phase: string; days: number }[];
  quote: { min: number; max: number; currency: "CNY" };
  notes: string[];
};

// ---------- 热点信息 ----------
export type HotItem = {
  id: string;
  rank: number;
  title: string;
  category: TopicCategory;
  /** 来源只给通用类型，不出现具体平台/软件名称 */
  sourceType: "短视频" | "图文社区" | "资讯" | "本地生活";
  heatScore: number;
  trend: "up" | "flat" | "down";
  risk: "low" | "medium" | "high";
  angle: string;
  updatedAt: string;
};

export type HotFeed = {
  generatedAt: string;
  pipeline: { step: string; detail: string; status: NodeStatus }[];
  items: HotItem[];
};
