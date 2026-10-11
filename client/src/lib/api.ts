/**
 * 前端请求与埋点。
 * 所有 /api 请求统一携带：
 *   device-fingerprint: 设备指纹
 *   x-session-token:    会话令牌（首次自动初始化，失效自动续期一次）
 */
import { HEADER_FINGERPRINT, HEADER_SESSION, type ApiResult, type SessionInitResult } from "@shared/api";
import { getDeviceFingerprint } from "./fingerprint";

const SESSION_KEY = "lcf_session_v1";
let sessionPromise: Promise<string | null> | null = null;

function readSaved(): string | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SessionInitResult;
    return new Date(s.expiresAt).getTime() > Date.now() + 60_000 ? s.token : null;
  } catch {
    return null;
  }
}

async function initSession(): Promise<string | null> {
  const fp = await getDeviceFingerprint();
  const res = await fetch("/api/session/init", { method: "POST", headers: { [HEADER_FINGERPRINT]: fp } });
  const json = (await res.json().catch(() => null)) as ApiResult<SessionInitResult> | null;
  if (!json?.ok) return null;
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(json.data)); } catch { /* ignore */ }
  return json.data.token;
}

export function ensureSession(force = false) {
  if (force) {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    sessionPromise = null;
  }
  if (!sessionPromise) {
    const saved = force ? null : readSaved();
    sessionPromise = saved ? Promise.resolve(saved) : initSession();
  }
  return sessionPromise;
}

async function headers(extra?: HeadersInit) {
  const [fp, token] = await Promise.all([getDeviceFingerprint(), ensureSession()]);
  const h = new Headers(extra);
  h.set(HEADER_FINGERPRINT, fp);
  if (token) h.set(HEADER_SESSION, token);
  return h;
}

const NETWORK_ERROR = { ok: false as const, code: "NETWORK", message: "网络开小差了，请稍后重试" };

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<ApiResult<T>> {
  try {
    const h = await headers(init.headers);
    if (init.body && !h.has("content-type")) h.set("content-type", "application/json");
    const res = await fetch(path, { ...init, headers: h });
    const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (!json) return NETWORK_ERROR;
    if (!json.ok && json.code === "INVALID_SESSION" && !retried) {
      await ensureSession(true);
      return api<T>(path, init, true);
    }
    track("api_result", { path, status: res.status, code: json.ok ? "OK" : json.code });
    return json;
  } catch {
    return NETWORK_ERROR;
  }
}

export const postJson = <T>(path: string, body: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body) });

/** 埋点：失败静默，不影响业务 */
export function track(event: string, props: Record<string, unknown> = {}) {
  if (event === "api_result" && props.path === "/api/track") return;
  void (async () => {
    try {
      const h = await headers({ "content-type": "application/json" });
      await fetch("/api/track", {
        method: "POST",
        headers: h,
        keepalive: true,
        body: JSON.stringify({ event, path: location.pathname + location.hash, props, ts: Date.now() }),
      });
    } catch { /* ignore */ }
  })();
}
