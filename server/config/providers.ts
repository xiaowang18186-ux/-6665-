/**
 * 第三方服务配置 —— 仅后端可见，只通过 /api/admin/providers（需管理员令牌）返回。
 * 前端任何页面、任何公开接口都不得引用本文件。
 *
 * 当前阶段：全部未接入真实服务，所有业务接口返回静态假数据。
 * 接入时只需在 .env 中填写对应 Key，并在 server/routes/* 中替换假数据实现。
 */
import { ENV } from "./env";

export type ProviderSlot = {
  /** 对应前端节点 id，前端只看到节点名称与状态 */
  nodeId: string;
  role: string;
  /** 候选服务（国内优先），仅管理员可见 */
  candidates: string[];
  envKey: string;
  note: string;
};

export const PROVIDER_SLOTS: ProviderSlot[] = [
  { nodeId: "localize", role: "中文本土化改写 / 分镜脚本", candidates: ["通义千问", "文心一言", "DeepSeek", "豆包大模型"], envKey: "LLM_API_KEY", note: "替换原欧美版的英文本土化改写；需走国内备案模型" },
  { nodeId: "compliance", role: "内容安全审核", candidates: ["阿里云内容安全", "腾讯云天御", "网易易盾"], envKey: "MODERATION_API_KEY", note: "叠加本地规则库 server/localization/compliance.ts" },
  { nodeId: "storyboard_image", role: "分镜出图", candidates: ["通义万相", "即梦", "可灵图像"], envKey: "IMAGE_API_KEY", note: "" },
  { nodeId: "image_to_video", role: "图生视频", candidates: ["可灵", "即梦视频", "海螺视频", "Vidu"], envKey: "VIDEO_API_KEY", note: "替换原欧美版的海外图生视频服务" },
  { nodeId: "tts", role: "中文配音", candidates: ["剪映（免费，人工导出）", "阿里云智能语音", "讯飞开放平台", "火山引擎语音"], envKey: "TTS_API_KEY", note: "替换原欧美版英文配音；剪映方案为人工导出音频后回传" },
  { nodeId: "subtitle", role: "字幕对齐", candidates: ["剪映自动字幕（人工）", "讯飞语音转写"], envKey: "ASR_API_KEY", note: "" },
  { nodeId: "compose", role: "剪辑合成", candidates: ["FFmpeg（自建）", "剪映草稿导出"], envKey: "", note: "本地渲染，无需 Key" },
  { nodeId: "distribute", role: "多平台分发包", candidates: ["抖音", "视频号", "小红书"], envKey: "", note: "只生成分发素材包，不自动发布" },
  { nodeId: "hot_source", role: "热点选题源（AIHOT 框架）", candidates: ["抖音热榜", "微博热搜", "小红书热点", "百度热搜", "本地生活榜单"], envKey: "", note: "当前不抓取，仅静态假数据" },
];

/** 管理员视图：Key 只显示是否已配置 + 末四位 */
export function providerAdminView() {
  return PROVIDER_SLOTS.map((p) => {
    const raw = p.envKey ? process.env[p.envKey] ?? "" : "";
    return {
      ...p,
      configured: Boolean(raw),
      keyPreview: raw ? `****${raw.slice(-4)}` : "",
      // 用量为预留字段，接入后由计费模块写入；当前为静态示例
      usageToday: { calls: 0, units: 0, costCny: 0 },
    };
  });
}

export const DB_CONFIGURED = Boolean(ENV.databaseUrl);
