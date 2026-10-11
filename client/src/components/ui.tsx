import { NODE_STATUS_LABEL, type ApiError, type NodeStatus } from "@shared/api";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:p-6", className)}>{children}</div>;
}

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-brand text-white hover:bg-[#9d2f28]",
        variant === "ghost" && "border border-line bg-surface text-ink hover:bg-paper",
        variant === "danger" && "border border-brand/30 bg-brand-soft text-brand hover:bg-brand hover:text-white",
        className,
      )}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft/70 focus:border-brand focus:outline-none";
export const Input = (p: ComponentProps<"input">) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: ComponentProps<"textarea">) => <textarea {...p} className={cx(inputCls, "min-h-24 resize-y", p.className)} />;
export const Select = (p: ComponentProps<"select">) => <select {...p} className={cx(inputCls, "appearance-none", p.className)} />;

export function StatusBadge({ status }: { status: NodeStatus }) {
  const style = {
    running: "bg-amber-soft text-amber",
    done: "bg-jade-soft text-jade",
    pending: "bg-paper text-ink-soft border border-dashed border-line",
  }[status];
  const dot = { running: "bg-amber animate-pulse-dot", done: "bg-jade", pending: "bg-ink-soft/40" }[status];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", style)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", dot)} />
      {NODE_STATUS_LABEL[status]}
    </span>
  );
}

export function SectionHeader({ index, title, desc }: { index: string; title: string; desc: string }) {
  return (
    <header className="mb-6 sm:mb-8">
      <div className="mb-2 font-serif text-sm tracking-[0.3em] text-brand">{index}</div>
      <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">{desc}</p>
    </header>
  );
}

export function ErrorNote({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-brand">
      {error.message}
      {error.retryAfterSec ? `（约 ${Math.ceil(error.retryAfterSec / 60)} 分钟后可再试）` : ""}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx("rounded-full border px-3 py-1.5 text-sm transition-colors", active ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink hover:border-brand/50")}
    >
      {children}
    </button>
  );
}
