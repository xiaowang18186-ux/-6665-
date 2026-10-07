import { Loader2, ScrollText } from "lucide-react";
import { useState } from "react";
import type { ApiError, BaziInput, BaziResult } from "@shared/api";
import { postJson, track } from "@/lib/api";
import { Button, Card, Chip, ErrorNote, Field, Input, SectionHeader } from "@/components/ui";

const ELEMENT_COLOR: Record<string, string> = { 木: "#2f7a5c", 火: "#b4372f", 土: "#a0782c", 金: "#8a8178", 水: "#2f5f8a" };

export default function BaziSection() {
  const [form, setForm] = useState<BaziInput>({ gender: "female", birthDate: "1990-08-16", birthTime: "12:30", name: "", birthPlace: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<BaziResult | null>(null);
  const set = <K extends keyof BaziInput>(k: K, v: BaziInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    track("bazi_submit");
    const r = await postJson<BaziResult>("/api/bazi", form);
    setLoading(false);
    if (r.ok) setResult(r.data);
    else setError(r);
  }

  const maxCount = Math.max(1, ...(result?.fiveElements.map((e) => e.count) ?? [1]));

  return (
    <section id="bazi" className="scroll-mt-20">
      <SectionHeader index="贰 · 八字排盘" title="四柱八字 · 传统历法排盘" desc="输入公历出生时间，排出年、月、日、时四柱与五行分布。仅作传统文化知识介绍与娱乐参考。" />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <form onSubmit={submit} className="space-y-4">
            <Field label="称呼（选填）"><Input value={form.name} maxLength={20} onChange={(e) => set("name", e.target.value)} placeholder="如：小王" /></Field>
            <Field label="性别">
              <div className="flex gap-2">
                <Chip active={form.gender === "female"} onClick={() => set("gender", "female")}>女</Chip>
                <Chip active={form.gender === "male"} onClick={() => set("gender", "male")}>男</Chip>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="公历日期"><Input type="date" required value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></Field>
              <Field label="出生时间"><Input type="time" required value={form.birthTime} onChange={(e) => set("birthTime", e.target.value)} /></Field>
            </div>
            <Field label="出生地（选填）" hint="用于真太阳时校正，演示阶段未启用"><Input value={form.birthPlace} maxLength={40} onChange={(e) => set("birthPlace", e.target.value)} placeholder="如：山东济南" /></Field>
            <ErrorNote error={error} />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />}
              {loading ? "排盘中…" : "开始排盘"}
            </Button>
          </form>
        </Card>
        <Card className="lg:col-span-3">
          {!result ? (
            <div className="flex min-h-64 items-center justify-center text-center text-sm text-ink-soft">填写左侧信息后查看四柱排盘结果</div>
          ) : (
            <div className="space-y-5">
              <div className="text-sm text-ink-soft">农历：{result.lunarDate} · 日主 <b className="text-ink">{result.dayMaster}</b></div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {result.pillars.map((p) => (
                  <div key={p.label} className="rounded-xl border border-line bg-white px-1 py-3">
                    <div className="text-xs text-ink-soft">{p.label}</div>
                    <div className="mt-2 font-serif text-2xl font-semibold leading-tight sm:text-3xl">{p.stem}<br />{p.branch}</div>
                    <div className="mt-2 text-[11px] text-ink-soft">{p.element}</div>
                    <div className="mt-1 text-[11px] text-brand">{p.tenGod}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold">五行分布</div>
                <ul className="space-y-1.5">
                  {result.fiveElements.map((e) => (
                    <li key={e.element} className="flex items-center gap-3 text-sm">
                      <span className="w-5 font-serif">{e.element}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper">
                        <span className="block h-full rounded-full" style={{ width: `${(e.count / maxCount) * 100}%`, background: ELEMENT_COLOR[e.element] }} />
                      </span>
                      <span className="w-6 text-right tabular-nums text-ink-soft">{e.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">{result.summary.map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="rounded-xl bg-paper px-3 py-2 text-xs text-ink-soft">{result.disclaimer}</p>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
