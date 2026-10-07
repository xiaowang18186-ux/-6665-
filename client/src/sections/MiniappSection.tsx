import { Code2, Loader2 } from "lucide-react";
import { useState } from "react";
import { MINIAPP_BUDGET_LABEL, MINIAPP_TYPE_LABEL, type ApiError, type MiniappInput, type MiniappResult } from "@shared/api";
import { postJson, track } from "@/lib/api";
import { Button, Card, Chip, ErrorNote, Field, Input, SectionHeader, Select, Textarea } from "@/components/ui";

const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;

export default function MiniappSection() {
  const [form, setForm] = useState<MiniappInput>({ type: "booking", budget: "5k-20k", requirement: "社区理发店，需要线上预约、会员储值和到店提醒。", contact: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<MiniappResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    track("miniapp_submit", { type: form.type, budget: form.budget });
    const r = await postJson<MiniappResult>("/api/miniapp", form);
    setLoading(false);
    if (r.ok) setResult(r.data);
    else setError(r);
  }

  return (
    <section id="miniapp" className="scroll-mt-20">
      <SectionHeader index="叁 · 小程序代写" title="说出需求，拿到小程序方案与报价" desc="预约、商城、点餐、工具、社区团购，一句话描述需求，生成页面结构、功能模块、排期与报价区间。" />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <form onSubmit={submit} className="space-y-4">
            <Field label="小程序类型">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(MINIAPP_TYPE_LABEL) as MiniappInput["type"][]).map((t) => (
                  <Chip key={t} active={form.type === t} onClick={() => setForm({ ...form, type: t })}>{MINIAPP_TYPE_LABEL[t]}</Chip>
                ))}
              </div>
            </Field>
            <Field label="需求描述"><Textarea required minLength={5} maxLength={2000} value={form.requirement} onChange={(e) => setForm({ ...form, requirement: e.target.value })} /></Field>
            <Field label="预算区间">
              <Select value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value as MiniappInput["budget"] })}>
                {(Object.keys(MINIAPP_BUDGET_LABEL) as MiniappInput["budget"][]).map((b) => <option key={b} value={b}>{MINIAPP_BUDGET_LABEL[b]}</option>)}
              </Select>
            </Field>
            <Field label="联系方式（选填）" hint="仅用于方案沟通"><Input value={form.contact} maxLength={60} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="手机号" /></Field>
            <ErrorNote error={error} />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
              {loading ? "生成中…" : "生成方案"}
            </Button>
          </form>
        </Card>
        <Card className="lg:col-span-3">
          {!result ? (
            <div className="flex min-h-64 items-center justify-center text-center text-sm text-ink-soft">提交需求后查看页面结构、功能模块与报价</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 className="font-serif text-xl font-semibold">{result.projectName}</h3>
                <div className="text-right">
                  <div className="text-xs text-ink-soft">参考报价</div>
                  <div className="text-lg font-semibold text-brand tabular-nums">{yuan(result.quote.min)} – {yuan(result.quote.max)}</div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {result.pages.map((p) => (
                  <div key={p.name} className="rounded-xl border border-line bg-white p-3">
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="mt-0.5 text-xs text-ink-soft">{p.purpose}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">{result.modules.map((m) => <span key={m} className="rounded-full bg-paper px-2.5 py-1 text-xs">{m}</span>)}</div>
              <ol className="space-y-1.5 text-sm">
                {result.milestones.map((m, i) => (
                  <li key={m.phase} className="flex justify-between border-b border-dashed border-line pb-1.5">
                    <span>{i + 1}. {m.phase}</span><span className="tabular-nums text-ink-soft">{m.days} 天</span>
                  </li>
                ))}
              </ol>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-ink-soft">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
