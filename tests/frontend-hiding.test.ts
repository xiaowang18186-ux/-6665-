/** 前端隐藏规则：前端源码与共享契约中不得出现任何第三方软件 / 服务名称或用量字段 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const BANNED = [
  "Claude", "Anthropic", "ElevenLabs", "Openart", "OpenArt", "Runway", "ChatGPT", "OpenAI", "GPT", "Gemini", "DeepSeek", "Midjourney", "Kling", "Pika", "Suno",
  "通义", "文心", "豆包", "可灵", "即梦", "海螺", "Vidu", "讯飞", "阿里云", "腾讯云", "火山引擎", "剪映", "抖音", "视频号", "小红书", "微博", "百度",
  "token消耗", "Token", "apiKey", "API Key", "usageToday", "costCny",
];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : /\.(tsx?|html|css)$/.test(d.name) ? [p] : [];
  });
}

describe("前端隐藏规则", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const files = [...walk(path.join(root, "client")), ...walk(path.join(root, "shared"))]
    // Admin 页面的用量/Key 展示字段来自后台接口，仅管理员登录后可见
    .filter((f) => !f.endsWith(path.join("pages", "Admin.tsx")));

  it.each(files.map((f) => [path.relative(root, f), f]))("%s 不含第三方名称", (_rel, file) => {
    const src = fs.readFileSync(file as string, "utf8");
    for (const word of BANNED) expect(src.includes(word), `出现 “${word}”`).toBe(false);
  });

  it("Admin 页面不内置任何服务商名称", () => {
    const src = fs.readFileSync(path.join(root, "client/src/pages/Admin.tsx"), "utf8");
    for (const word of BANNED.slice(0, 31)) expect(src.includes(word), `出现 “${word}”`).toBe(false);
  });
});
