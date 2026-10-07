import { useEffect, useState } from "react";
import type { HotItem, TopicCategory } from "@shared/api";
import { ensureSession, track } from "@/lib/api";
import BaziSection from "@/sections/BaziSection";
import HotSection from "@/sections/HotSection";
import MiniappSection from "@/sections/MiniappSection";
import WorkflowSection from "@/sections/WorkflowSection";

const NAV = [
  { id: "workflow", label: "自动化工作流" },
  { id: "bazi", label: "八字排盘" },
  { id: "miniapp", label: "小程序代写" },
  { id: "hot", label: "热点信息" },
];

export default function Home() {
  const [preset, setPreset] = useState<{ topic: string; category: TopicCategory } | null>(null);

  useEffect(() => {
    void ensureSession();
    track("page_view");
    // 板块曝光埋点
    const seen = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !seen.has(e.target.id)) {
            seen.add(e.target.id);
            track("section_view", { section: e.target.id });
          }
        }
      },
      { threshold: 0.25 },
    );
    NAV.forEach((n) => { const el = document.getElementById(n.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  function useTopic(item: HotItem) {
    setPreset({ topic: item.title, category: item.category });
    document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <a href="#workflow" className="shrink-0 font-serif text-lg font-semibold text-ink">
            <span className="mr-1 inline-block rounded bg-brand px-1.5 py-0.5 text-sm text-white">生活</span>文案工厂
          </a>
          <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto text-sm [scrollbar-width:none]">
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} onClick={() => track("nav_click", { to: n.id })} className="shrink-0 rounded-lg px-2.5 py-1.5 text-ink-soft hover:bg-surface hover:text-ink">
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:space-y-20 sm:px-6 sm:py-14">
        <WorkflowSection presetTopic={preset} />
        <BaziSection />
        <MiniappSection />
        <HotSection onUseTopic={useTopic} />
      </main>

      <footer className="border-t border-line py-8 text-center text-xs leading-relaxed text-ink-soft">
        <p>内容遵守国内平台社区规范：不传播医疗伪科学、封建迷信与不实信息。</p>
        <p className="mt-1">© 2026 生活文案工厂 · 演示版本，部分数据为示例</p>
      </footer>
    </div>
  );
}
