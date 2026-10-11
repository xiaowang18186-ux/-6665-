import { CheckCircle2, ImagePlus, Loader2, PlayCircle, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  OUTPUT_FORMAT_LABEL,
  TOPIC_CATEGORY_LABEL,
  type ApiError,
  type OutputFormat,
  type TopicCategory,
  type WorkflowNode,
  type WorkflowOverview,
  type WorkflowRunInput,
  type WorkflowRunResult,
} from "@shared/api";
import { api, postJson, track } from "@/lib/api";
import { Button, Card, Chip, ErrorNote, Field, Input, SectionHeader, StatusBadge, cx } from "@/components/ui";

const SCENES: { key: WorkflowRunInput["scene"]; label: string }[] = [
  { key: "rural", label: "乡村" },
  { key: "city", label: "城市" },
  { key: "family", label: "家庭" },
];

function NodeFlow({ nodes }: { nodes: WorkflowNode[] }) {
  const groups = useMemo(() => {
    const m = new Map<string, WorkflowNode[]>();
    for (const n of [...nodes].sort((a, b) => a.order - b.order)) m.set(n.group, [...(m.get(n.group) ?? []), n]);
    return [...m.entries()];
  }, [nodes]);

  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map(([group, list], gi) => (
        <li key={group} className="relative">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-widest text-ink-soft">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] text-white">{gi + 1}</span>
            {group}
          </div>
          <div className="space-y-2">
            {list.map((n) => (
              <div
                key={n.id}
                className={cx(
                  "rounded-xl border bg-white p-3",
                  n.id === "image_to_video" ? "border-brand ring-2 ring-brand/15" : "border-line",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {String(n.order).padStart(2, "0")} · {n.name}
                  </span>
                  <StatusBadge status={n.status} />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">{n.description}</p>
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function WorkflowSection({ presetTopic }: { presetTopic: { topic: string; category: TopicCategory } | null }) {
  const [overview, setOverview] = useState<WorkflowOverview | null>(null);
  const [topic, setTopic] = useState("婆婆悄悄把养老钱塞进儿媳的行李箱");
  const [category, setCategory] = useState<TopicCategory>("family");
  const [scene, setScene] = useState<WorkflowRunInput["scene"]>("rural");
  const [formats, setFormats] = useState<OutputFormat[]>(["vertical_video"]);
  const [image, setImage] = useState<{ name: string; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<WorkflowRunResult | null>(null);
  const topicRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<WorkflowOverview>("/api/workflow").then((r) => r.ok && setOverview(r.data));
  }, []);

  useEffect(() => {
    if (!presetTopic) return;
    setTopic(presetTopic.topic);
    setCategory(presetTopic.category);
    topicRef.current?.focus({ preventScroll: true });
  }, [presetTopic]);

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  const toggleFormat = (f: OutputFormat) =>
    setFormats((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    track("workflow_submit", { category, scene, formats: formats.length, hasImage: Boolean(image) });
    const r = await postJson<WorkflowRunResult>("/api/workflow", { topic, category, scene, formats, imageName: image?.name });
    setLoading(false);
    if (r.ok) setResult(r.data);
    else setError(r);
  }

  const nodes = result?.nodes ?? overview?.nodes ?? [];

  return (
    <section id="workflow" className="scroll-mt-20">
      <SectionHeader
        index="壹 · 自动化工作流"
        title={overview?.title ?? "一张照片，自动生成一条生活故事短视频"}
        desc={overview?.subtitle ?? "全链路自动化：选题、文案、合规、分镜、图生视频、配音、字幕、成片、多平台素材包。"}
      />

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-semibold"><PlayCircle className="h-5 w-5 text-brand" />全链路节点</h3>
          <div className="flex gap-2"><StatusBadge status="done" /><StatusBadge status="running" /><StatusBadge status="pending" /></div>
        </div>
        {nodes.length ? <NodeFlow nodes={nodes} /> : <p className="text-sm text-ink-soft">节点加载中…</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold"><ImagePlus className="h-5 w-5 text-brand" />图生视频 · 立即体验</h3>
          <form onSubmit={submit} className="space-y-4">
            <Field label="上传一张照片" hint="照片仅在本地预览，演示阶段不会上传">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line bg-white p-3 hover:border-brand/50">
                {image ? (
                  <img src={image.url} alt="已选照片预览" className="h-16 w-12 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-16 w-12 items-center justify-center rounded-lg bg-paper text-ink-soft"><ImagePlus className="h-5 w-5" /></span>
                )}
                <span className="text-sm text-ink-soft">{image ? image.name : "点击选择 JPG / PNG"}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setImage({ name: f.name, url: URL.createObjectURL(f) });
                  }}
                />
              </label>
            </Field>
            <Field label="故事选题">
              <Input ref={topicRef} value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} required minLength={2} />
            </Field>
            <Field label="选题分类">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TOPIC_CATEGORY_LABEL) as TopicCategory[]).map((c) => (
                  <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{TOPIC_CATEGORY_LABEL[c]}</Chip>
                ))}
              </div>
            </Field>
            <Field label="故事场景">
              <div className="flex flex-wrap gap-2">
                {SCENES.map((s) => <Chip key={s.key} active={scene === s.key} onClick={() => setScene(s.key)}>{s.label}</Chip>)}
              </div>
            </Field>
            <Field label="输出规格">
              <div className="space-y-2">
                {(Object.keys(OUTPUT_FORMAT_LABEL) as OutputFormat[]).map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formats.includes(f)} onChange={() => toggleFormat(f)} className="h-4 w-4 accent-brand" />
                    {OUTPUT_FORMAT_LABEL[f]}
                  </label>
                ))}
              </div>
            </Field>
            <ErrorNote error={error} />
            <Button type="submit" disabled={loading || formats.length === 0} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              {loading ? "提交中…" : "开始生成"}
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-3">
          {!result ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center text-center text-ink-soft">
              <PlayCircle className="mb-3 h-10 w-10 text-line" />
              <p className="text-sm">提交后，这里会展示本土化分镜脚本、合规审核结果与成片交付状态。</p>
              {overview && (
                <ul className="mt-6 grid w-full gap-2 text-left sm:grid-cols-2">
                  {overview.outputs.map((o) => (
                    <li key={o.key} className="rounded-xl bg-paper px-3 py-2 text-xs"><b className="text-ink">{o.label}</b><br />{o.spec}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="text-xs text-ink-soft">任务编号 {result.jobId.slice(0, 16)}…</div>
                <h3 className="mt-1 font-serif text-xl font-semibold">{result.localizedScript.title}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.localizedScript.tags.map((t) => <span key={t} className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink-soft">#{t}</span>)}
                </div>
              </div>
              <ol className="space-y-2">
                {result.localizedScript.lines.map((l) => (
                  <li key={l.shot} className="rounded-xl border border-line bg-white p-3">
                    <div className="text-xs font-medium text-brand">{l.shot}</div>
                    <p className="mt-1 text-sm text-ink">{l.narration}</p>
                    <p className="mt-1 text-xs text-ink-soft">画面：{l.visual}</p>
                  </li>
                ))}
              </ol>
              <div className={cx("rounded-xl p-3 text-sm", result.compliance.passed ? "bg-jade-soft text-jade" : "bg-brand-soft text-brand")}>
                <div className="mb-1 flex items-center gap-1.5 font-semibold"><ShieldCheck className="h-4 w-4" />合规审核：{result.compliance.passed ? "通过" : "需修改"}</div>
                <ul className="list-disc space-y-0.5 pl-5 text-xs">{result.compliance.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold">成片交付</div>
                <ul className="space-y-2">
                  {result.deliverables.map((d) => (
                    <li key={d.format} className="flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-sm">
                      <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-ink-soft" />{d.label}</span>
                      <StatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
