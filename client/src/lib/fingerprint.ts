/**
 * 设备指纹：浏览器环境特征 + Canvas 渲染特征 → SHA-256。
 * 结果缓存在 localStorage（不可用时每次重新计算，结果稳定）。
 */
const STORAGE_KEY = "lcf_fp_v1";

function canvasSignal() {
  try {
    const c = document.createElement("canvas");
    c.width = 220;
    c.height = 40;
    const ctx = c.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "16px serif";
    ctx.fillStyle = "#b4372f";
    ctx.fillRect(10, 5, 80, 20);
    ctx.fillStyle = "#2f7a5c";
    ctx.fillText("生活文案工厂 fp ✓", 4, 12);
    return c.toDataURL().slice(-120);
  } catch {
    return "canvas-error";
  }
}

function webglSignal() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return "no-webgl";
    return [gl.getParameter(gl.VERSION), gl.getParameter(gl.SHADING_LANGUAGE_VERSION), gl.getParameter(gl.MAX_TEXTURE_SIZE)].join("|");
  } catch {
    return "webgl-error";
  }
}

function fallbackHash(input: string) {
  // 非安全上下文下无 crypto.subtle 时的退化方案：4 路 FNV-1a 拼成 32 位十六进制
  let out = "";
  for (let seed = 0; seed < 4; seed++) {
    let h = 0x811c9dc5 ^ seed;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    out += (h >>> 0).toString(16).padStart(8, "0");
  }
  return out;
}

async function sha256(input: string) {
  if (!globalThis.crypto?.subtle) return fallbackHash(input);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

let cached: Promise<string> | null = null;

export function getDeviceFingerprint() {
  if (cached) return cached;
  cached = (async () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && /^[a-f0-9]{16,128}$/.test(saved)) return saved;
    } catch { /* 隐私模式等场景忽略 */ }
    const nav = navigator as Navigator & { deviceMemory?: number };
    const parts = [
      nav.userAgent,
      nav.language,
      (nav.languages ?? []).join(","),
      nav.platform,
      nav.hardwareConcurrency,
      nav.deviceMemory ?? "",
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      window.devicePixelRatio,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvasSignal(),
      webglSignal(),
    ].join("::");
    const fp = await sha256(parts);
    try { localStorage.setItem(STORAGE_KEY, fp); } catch { /* ignore */ }
    return fp;
  })();
  return cached;
}
