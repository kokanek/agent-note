import type { ReactNode } from "react";

const STYLES: Record<string, { box: string; icon: string; label: string }> = {
  info: {
    box: "border-sage-200 bg-sage-50 text-ink-700",
    icon: "ℹ️",
    label: "Note",
  },
  warning: {
    box: "border-amber-300 bg-amber-50 text-amber-900",
    icon: "⚠️",
    label: "Warning",
  },
  danger: {
    box: "border-red-300 bg-red-50 text-red-900",
    icon: "⛔",
    label: "Danger",
  },
  tip: {
    box: "border-emerald-300 bg-emerald-50 text-emerald-900",
    icon: "💡",
    label: "Tip",
  },
};

export function Callout({
  type,
  title,
  children,
}: {
  type?: string;
  title?: string;
  children?: ReactNode;
}) {
  const style = STYLES[type ?? "info"] ?? STYLES.info;
  return (
    <aside className={`my-4 rounded-xl border px-4 py-3 ${style.box}`}>
      <div className="mb-1 flex items-center gap-2 text-sm font-bold">
        <span aria-hidden>{style.icon}</span>
        <span>{title ?? style.label}</span>
      </div>
      <div className="[&>p]:my-1 text-sm">{children}</div>
    </aside>
  );
}
