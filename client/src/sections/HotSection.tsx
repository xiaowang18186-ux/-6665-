import { ArrowDownRight, ArrowRight, ArrowUpRight, Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { TOPIC_CATEGORY_LABEL, type HotFeed, type HotItem, type TopicCategory } from "@shared/api";
import { api, track } from "@/lib/api";
import { Card, Chip, SectionHeader, StatusBadge, cx } from "@/components/ui";

const RISK_LABEL: Record<HotItem["risk"], { text: string; cls: string }> = {
  low: { text: "低风险", cls: "bg-jade-soft text-jade" },
  medium: { text: "需谨慎", cls: "bg-amber-soft text-amber" },
  high: { text: "高风险", cls: "bg-brand-soft text-brand" },
};

export default function HotSection({ onUseTopic }: { onUseTopic: (item: HotItem) => void }) {
  const [category, setCategory] = useState<TopicCategory | "all">("all");
  const [feed, setFeed] = useState<HotFeed | null>(null);

  useEffect(() => {
    const q = category === "all" ? "" : `?category=${category}`;
    api<HotFeed>(`/api/hot${q}`).then((r) => r.ok && setFeed(r.data));
  }, [category]);

  return (
    <section id="hot" className="scroll-mt-20">
      <SectionHeader index="肆 · 热点信息" title="今日生活热点 · 选题池" desc="多源热点经去重、热度打分与合规过滤后进入选题池，一键带入自动化工作流。" />
      <Card className="mb-4">
        <ol className="grid gap-2 sm:grid-cols-5">
          {feed?.pipeline.map((p, i) => (
            <li key={p.step} className="rounded-xl bg-paper p-3">
              <div className="flex items-center justify-between gap-1"><span className="text-sm font-semibold">{i + 1}. {p.step}</span></div>
              <p className="mt-1 text-xs text-ink-soft">{p.detail}</p>
              <div className="mt-2"><StatusBadge status={p.status} /></div>
            </li>
          ))}
        </ol>
      </Card>
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip active={category === "all"} onClick={() => setCategory("all")}>全部</Chip>
        {(Object.keys(TOPIC_CATEGORY_LABEL) as TopicCategory[]).map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{TOPIC_CATEGORY_LABEL[c]}</Chip>
        ))}
      </div>
      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-line">
          {feed?.items.map((h) => (
            <li key={h.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
              <span className={cx("w-8 shrink-0 font-serif text-2xl font-semibold tabular-nums", h.rank <= 3 ? "text-brand" : "text-ink-soft/60")}>{h.rank}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium leading-snug text-ink">{h.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                  <span>{TOPIC_CATEGORY_LABEL[h.category]}</span>·<span>{h.sourceType}</span>·
                  <span className={cx("rounded-full px-2 py-0.5", RISK_LABEL[h.risk].cls)}>{RISK_LABEL[h.risk].text}</span>
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">切入角度：{h.angle}</p>
              </div>
              <div className="flex items-center gap-4 sm:w-48 sm:justify-end">
                <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-ink">
                  <Flame className="h-4 w-4 text-brand" />{h.heatScore}
                  {h.trend === "up" ? <ArrowUpRight className="h-4 w-4 text-brand" /> : h.trend === "down" ? <ArrowDownRight className="h-4 w-4 text-jade" /> : <ArrowRight className="h-4 w-4 text-ink-soft" />}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-brand hover:border-brand"
                  onClick={() => { track("hot_use_topic", { id: h.id }); onUseTopic(h); }}
                >
                  用作选题
                </button>
              </div>
            </li>
          ))}
          {feed && feed.items.length === 0 && <li className="p-6 text-center text-sm text-ink-soft">该分类暂无热点</li>}
        </ul>
      </Card>
      {feed && <p className="mt-3 text-xs text-ink-soft">更新于 {new Date(feed.generatedAt).toLocaleString("zh-CN", { hour12: false })} · 演示数据</p>}
    </section>
  );
}
