import type { ReactNode } from "react";

export function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "info" | "neutral";
  children: ReactNode;
}) {
  const classes =
    tone === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "info"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium ${classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        tone === "success" ? "bg-green-500" :
        tone === "warning" ? "bg-amber-500" :
        tone === "info" ? "bg-blue-500" :
        "bg-slate-400"
      }`}></span>
      {children}
    </span>
  );
}
