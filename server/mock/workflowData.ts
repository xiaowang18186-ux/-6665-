/** 自动化工作流节点定义（前端只看到名称 + 状态，不含任何服务商信息） */
import type { WorkflowNode, WorkflowOverview } from "@shared/api";

export const WORKFLOW_NODES: WorkflowNode[] = [
  { id: "hot_source", order: 1, group: "选题", name: "热点选题", description: "从热点引擎选取生活 / 家庭类选题", status: "done" },
  { id: "draft", order: 2, group: "文案", name: "中文原稿", description: "生成或上传中文故事原稿", status: "done" },
  { id: "localize", order: 3, group: "文案", name: "本土化改写", description: "乡村 / 城市 / 家庭场景改写，替换外来元素", status: "done" },
  { id: "compliance", order: 4, group: "文案", name: "合规审核", description: "医疗伪科学、迷信、绝对化用语、站外导流检测", status: "done" },
  { id: "storyboard", order: 5, group: "视觉", name: "分镜脚本", description: "逐镜旁白、画面描述、运镜提示", status: "running" },
  { id: "storyboard_image", order: 6, group: "视觉", name: "分镜出图", description: "9:16 竖屏分镜图，人物与场景保持一致", status: "running" },
  { id: "image_to_video", order: 7, group: "视觉", name: "图生视频", description: "上传一张照片，逐镜生成动态画面", status: "pending" },
  { id: "tts", order: 8, group: "声音", name: "中文配音", description: "普通话 / 方言旁白，支持免费配音工具导出回传", status: "pending" },
  { id: "subtitle", order: 9, group: "声音", name: "字幕对齐", description: "逐句字幕与时间轴对齐", status: "pending" },
  { id: "compose", order: 10, group: "成片", name: "剪辑合成", description: "画面、配音、字幕、音效与背景音乐合成", status: "pending" },
  { id: "final_check", order: 11, group: "成片", name: "成片终检", description: "画面一致性、字幕错字、时长与规格检查", status: "pending" },
  { id: "distribute", order: 12, group: "分发", name: "多平台素材包", description: "竖屏短视频 / 图文笔记 / 社交视频三种规格", status: "pending" },
];

export const WORKFLOW_OVERVIEW: WorkflowOverview = {
  title: "一张照片，自动生成一条生活故事短视频",
  subtitle: "选题 → 文案 → 合规 → 分镜 → 图生视频 → 配音 → 字幕 → 成片 → 多平台素材包，全链路自动化",
  nodes: WORKFLOW_NODES,
  outputs: [
    { key: "video", label: "成片视频", spec: "1080×1920 · 60–90 秒 · MP4" },
    { key: "subtitle", label: "字幕文件", spec: "SRT · 逐句时间轴" },
    { key: "cover", label: "封面图", spec: "竖版 3:4 / 9:16 各一张" },
    { key: "copy", label: "发布文案", spec: "标题 + 简介 + 话题标签" },
  ],
};
