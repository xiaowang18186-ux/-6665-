/**
 * /admin 管理后台：黑名单、手动封禁、重置额度、记忆库、操作日志、服务配置与用量。
 * 服务名称、Key 状态、用量数据全部来自 /api/admin/*（需管理员令牌），本文件不内置任何服务名称。
 */
import { Ban, KeyRound, RefreshCw, RotateCcw, ShieldAlert, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Input, Select, cx } from "@/components/ui";

const TOKEN_KEY = "lcf_admin_token";

type AdminUser = {
  id: string; identityGroupId: string; deviceFingerprint: string; registerIp: string; ips: string[];
  status: "normal" | "disabled" | "blacklisted"; statusReason: string; createdAt: number; lastActiveAt: number; callCount: number;
  quota: { isNew: boolean; hourly: number; daily: number }; usage: { lastHour: number; lastDay: number };
};
type Overview = {
  breaker: { dailyTotal: number; limit: number; open: boolean; manual: boolean };
  alerts: { id: number; level: string; message: string; createdAt: number }[];
  counts: Record<string, number>;
  risk: Record<string, number>;
  database: { configured: boolean; mode: string };
};
type Log = { id: number; userId: string | null; ip: string; action: string; endpoint: string; result: string; reason: string; createdAt: number };
type Provider = { nodeId: string; role: string; candidates: string[]; envKey: string; note: string; configured: boolean; keyPreview: string; usageToday: { calls: number; units: number; costCny: number } };
type Memory = { userId: string; deviceFingerprint: string; ips: string[]; registeredAt: number; lastActiveAt: number; callCount: number; generations: { id: string; kind: string; summary: string; createdAt: number }[] };

const STATUS_TEXT = { normal: "正常", disabled: "禁用", blacklisted: "黑名单" } as const;
const STATUS_CLS = { normal: "bg-jade-soft text-jade", disabled: "bg-amber-soft text-amber", blacklisted: "bg-brand-soft text-brand" } as const;
const t = (ms: number) => new Date(ms).toLocaleString("zh-CN", { hour12: false });

const TABS = [
  { key: "users", label: "用户管理" },
  { key: "blacklist", label: "黑名单" },
  { key: "logs", label: "操作日志" },
  { key: "providers", label: "服务配置与用量" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function Admin() {
  const [token, setToken] = useState(() => { try { return sessionStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; } });
  const [draft, setDraft] = useState("");
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<Tab>("users");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [blacklist, setBlacklist] = useState<{ users: AdminUser[]; fingerprints: string[]; ips: string[] } | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [logFilter, setLogFilter] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [memory, setMemory] = useState<Memory | null>(null);

  const call = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T | null> => {
      const res = await fetch(`/api/admin${path}`, { ...init, headers: { "content-type": "application/json", "x-admin-token": token } });
      const json = await res.json().catch(() => null);
      if (res.status === 401 || res.status === 503) {
        setAuthError(json?.message ?? "认证失败");
        setToken("");
        try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
        return null;
      }
      if (!json?.ok) { alert(json?.message ?? "请求失败"); return null; }
      return json.data as T;
    },
    [token],
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    const ov = await call<Overview>("/overview");
    if (ov) setOverview(ov);
    if (tab === "users") setUsers((await call<AdminUser[]>(`/users${statusFilter ? `?status=${statusFilter}` : ""}`)) ?? []);
    if (tab === "blacklist") setBlacklist(await call("/blacklist"));
    if (tab === "logs") setLogs((await call<Log[]>(`/logs?limit=200${logFilter ? `&result=${logFilter}` : ""}`)) ?? []);
    if (tab === "providers") setProviders((await call<Provider[]>("/providers")) ?? []);
  }, [token, tab, statusFilter, logFilter, call]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function setStatus(u: AdminUser, status: AdminUser["status"]) {
    const reason = status === "normal" ? "管理员解除" : prompt(`请输入${STATUS_TEXT[status]}原因`, "违规使用") ?? "";
    if (status !== "normal" && !reason) return;
    await call(`/users/${u.id}/status`, { method: "POST", body: JSON.stringify({ status, reason }) });
    void refresh();
  }
  async function resetQuota(u: AdminUser) {
    if (!confirm("确认重置该用户（含同设备 / 同 IP 关联账号）的额度？")) return;
    await call(`/users/${u.id}/reset-quota`, { method: "POST" });
    void refresh();
  }
  async function toggleBreaker() {
    if (!overview) return;
    await call("/breaker", { method: "POST", body: JSON.stringify({ open: !overview.breaker.manual }) });
    void refresh();
  }
  async function openMemory(id: string) { setMemory(await call<Memory>(`/users/${id}/memory`)); }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <h1 className="mb-1 flex items-center gap-2 text-lg font-semibold"><KeyRound className="h-5 w-5 text-brand" />管理后台</h1>
          <p className="mb-4 text-sm text-ink-soft">请输入管理员令牌</p>
          <form onSubmit={(e) => { e.preventDefault(); setAuthError(""); try { sessionStorage.setItem(TOKEN_KEY, draft); } catch { /* ignore */ } setToken(draft); }} className="space-y-3">
            <Input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="current-password" required />
            {authError && <p className="text-sm text-brand">{authError}</p>}
            <Button type="submit" className="w-full">进入</Button>
          </form>
        </Card>
      </div>
    );
  }

  const UserRow = ({ u }: { u: AdminUser }) => (
    <tr className="border-b border-line align-top last:border-0">
      <td className="py-2 pr-3"><button className="font-mono text-xs text-brand underline-offset-2 hover:underline" onClick={() => openMemory(u.id)}>{u.id.slice(0, 14)}…</button><div className="font-mono text-[11px] text-ink-soft">组 {u.identityGroupId.slice(4, 12)}</div></td>
      <td className="py-2 pr-3 font-mono text-[11px] text-ink-soft">{u.deviceFingerprint.slice(0, 12)}…<br />{u.ips.join(", ")}</td>
      <td className="py-2 pr-3"><span className={cx("rounded-full px-2 py-0.5 text-xs", STATUS_CLS[u.status])}>{STATUS_TEXT[u.status]}</span>{u.statusReason && <div className="mt-1 text-[11px] text-ink-soft">{u.statusReason}</div>}</td>
      <td className="py-2 pr-3 text-xs tabular-nums">{u.usage.lastHour}/{u.quota.hourly} 时 · {u.usage.lastDay}/{u.quota.daily} 日{u.quota.isNew && <div className="text-amber">新号限流中</div>}<div className="text-ink-soft">累计 {u.callCount}</div></td>
      <td className="py-2 pr-3 text-[11px] text-ink-soft">注册 {t(u.createdAt)}<br />活跃 {t(u.lastActiveAt)}</td>
      <td className="py-2">
        <div className="flex flex-wrap gap-1">
          {u.status !== "normal" && <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setStatus(u, "normal")}><UserCheck className="h-3.5 w-3.5" />恢复</Button>}
          {u.status !== "disabled" && <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setStatus(u, "disabled")}><UserX className="h-3.5 w-3.5" />禁用</Button>}
          {u.status !== "blacklisted" && <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => setStatus(u, "blacklisted")}><Ban className="h-3.5 w-3.5" />拉黑</Button>}
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => resetQuota(u)}><RotateCcw className="h-3.5 w-3.5" />重置额度</Button>
        </div>
      </td>
    </tr>
  );

  const UserTable = ({ list }: { list: AdminUser[] }) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead><tr className="border-b border-line text-xs text-ink-soft"><th className="py-2">用户 / 身份组</th><th>设备指纹 / IP</th><th>状态</th><th>额度</th><th>时间</th><th>操作</th></tr></thead>
        <tbody>{list.map((u) => <UserRow key={u.id} u={u} />)}</tbody>
      </table>
      {list.length === 0 && <p className="py-6 text-center text-sm text-ink-soft">暂无数据</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold">管理后台</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" />刷新</Button>
          <Button variant="ghost" onClick={() => { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } setToken(""); }}>退出</Button>
        </div>
      </div>

      {overview && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="md:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-ink-soft">今日总调用量 / 熔断阈值</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{overview.breaker.dailyTotal} <span className="text-base text-ink-soft">/ {overview.breaker.limit}</span></div>
              </div>
              <span className={cx("rounded-full px-3 py-1 text-xs font-medium", overview.breaker.open ? "bg-brand-soft text-brand" : "bg-jade-soft text-jade")}>{overview.breaker.open ? "已熔断 · 生成暂停" : "运行正常"}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper"><div className={cx("h-full", overview.breaker.open ? "bg-brand" : "bg-jade")} style={{ width: `${Math.min(100, (overview.breaker.dailyTotal / overview.breaker.limit) * 100)}%` }} /></div>
            <Button variant={overview.breaker.manual ? "ghost" : "danger"} className="mt-3 px-3 py-1.5 text-xs" onClick={toggleBreaker}>{overview.breaker.manual ? "解除手动熔断" : "手动熔断"}</Button>
          </Card>
          <Card>
            <div className="text-xs text-ink-soft">用户</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{overview.counts.users}</div>
            <div className="mt-1 text-xs text-ink-soft">正常 {overview.counts.normal} · 禁用 {overview.counts.disabled} · 黑名单 {overview.counts.blacklisted}</div>
          </Card>
          <Card>
            <div className="text-xs text-ink-soft">生成记录</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{overview.counts.generations}</div>
            <div className="mt-1 text-xs text-ink-soft">存储：{overview.database.mode}</div>
          </Card>
          {overview.alerts.length > 0 && (
            <Card className="md:col-span-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-brand" />告警</div>
              <ul className="space-y-1 text-sm">{overview.alerts.map((a) => <li key={a.id} className={a.level === "critical" ? "text-brand" : "text-amber"}>[{t(a.createdAt)}] {a.message}</li>)}</ul>
            </Card>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-line">
        {TABS.map((x) => (
          <button key={x.key} onClick={() => setTab(x.key)} className={cx("-mb-px border-b-2 px-3 py-2 text-sm", tab === x.key ? "border-brand font-medium text-brand" : "border-transparent text-ink-soft")}>{x.label}</button>
        ))}
      </div>

      {tab === "users" && (
        <Card>
          <div className="mb-3 w-40"><Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">全部状态</option><option value="normal">正常</option><option value="disabled">禁用</option><option value="blacklisted">黑名单</option></Select></div>
          <UserTable list={users} />
        </Card>
      )}

      {tab === "blacklist" && blacklist && (
        <Card className="space-y-4">
          <UserTable list={blacklist.users} />
          <div className="grid gap-4 md:grid-cols-2 text-xs">
            <div><div className="mb-1 font-semibold">被封设备指纹（{blacklist.fingerprints.length}）</div><ul className="font-mono text-ink-soft">{blacklist.fingerprints.map((f) => <li key={f}>{f}</li>)}</ul></div>
            <div><div className="mb-1 font-semibold">被封 IP（{blacklist.ips.length}）</div><ul className="font-mono text-ink-soft">{blacklist.ips.map((f) => <li key={f}>{f}</li>)}</ul></div>
          </div>
        </Card>
      )}

      {tab === "logs" && (
        <Card>
          <div className="mb-3 w-40"><Select value={logFilter} onChange={(e) => setLogFilter(e.target.value)}><option value="">全部结果</option><option value="rejected">拒绝</option><option value="allowed">放行</option><option value="admin">后台操作</option><option value="alert">告警</option><option value="track">埋点</option></Select></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead><tr className="border-b border-line text-ink-soft"><th className="py-2">时间</th><th>结果</th><th>原因</th><th>动作</th><th>接口</th><th>用户</th><th>IP</th></tr></thead>
              <tbody>{logs.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{t(l.createdAt)}</td>
                  <td className={cx("pr-2", l.result === "rejected" && "text-brand", l.result === "alert" && "text-amber")}>{l.result}</td>
                  <td className="pr-2">{l.reason}</td><td className="pr-2">{l.action}</td><td className="pr-2">{l.endpoint}</td>
                  <td className="pr-2 font-mono">{l.userId?.slice(0, 10) ?? "-"}</td><td className="font-mono">{l.ip}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "providers" && (
        <Card>
          <p className="mb-3 text-xs text-ink-soft">仅管理员可见。当前全部业务接口返回演示数据，未产生外部调用；Key 在服务器环境变量中配置。</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-line text-xs text-ink-soft"><th className="py-2">节点</th><th>候选服务</th><th>环境变量</th><th>Key</th><th>今日用量</th></tr></thead>
              <tbody>{providers.map((p) => (
                <tr key={p.nodeId} className="border-b border-line align-top last:border-0">
                  <td className="py-2 pr-3"><b>{p.role}</b><div className="text-[11px] text-ink-soft">{p.note}</div></td>
                  <td className="py-2 pr-3 text-xs">{p.candidates.join(" / ")}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{p.envKey || "-"}</td>
                  <td className="py-2 pr-3 text-xs">{p.envKey ? (p.configured ? <span className="text-jade">已配置 {p.keyPreview}</span> : <span className="text-ink-soft">待接入</span>) : "-"}</td>
                  <td className="py-2 text-xs tabular-nums">{p.usageToday.calls} 次 · ¥{p.usageToday.costCny.toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}

      {memory && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={() => setMemory(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">记忆库</h2><button className="text-sm text-ink-soft" onClick={() => setMemory(null)}>关闭</button></div>
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-xs">
              <dt className="text-ink-soft">用户 ID</dt><dd className="font-mono break-all">{memory.userId}</dd>
              <dt className="text-ink-soft">设备指纹</dt><dd className="font-mono break-all">{memory.deviceFingerprint}</dd>
              <dt className="text-ink-soft">IP</dt><dd className="font-mono">{memory.ips.join(", ")}</dd>
              <dt className="text-ink-soft">注册时间</dt><dd>{t(memory.registeredAt)}</dd>
              <dt className="text-ink-soft">最近活跃</dt><dd>{t(memory.lastActiveAt)}</dd>
              <dt className="text-ink-soft">调用次数</dt><dd>{memory.callCount}</dd>
            </dl>
            <h3 className="mt-4 mb-2 text-sm font-semibold">生成记录（时间倒序）</h3>
            <ul className="divide-y divide-line text-xs">
              {memory.generations.map((g) => <li key={g.id} className="py-1.5"><span className="font-mono">{g.id.slice(0, 16)}…</span> · {g.kind} · {g.summary} · <span className="text-ink-soft">{t(g.createdAt)}</span></li>)}
              {memory.generations.length === 0 && <li className="py-2 text-ink-soft">暂无记录</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
