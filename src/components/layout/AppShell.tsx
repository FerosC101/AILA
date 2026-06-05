import type { ReactNode } from "react";
import type { WorkspaceView } from "../../types/aila";
import { productCopy } from "../../lib/content";

const navItems: Array<{ id: WorkspaceView; label: string; hint: string }> = [
  { id: "dashboard", label: "Workspace", hint: "Upload and review" },
  { id: "results", label: "Results", hint: "Findings and output" },
  { id: "settings", label: "Settings", hint: "Integration setup" },
];

export function AppShell({
  view,
  onViewChange,
  children,
}: {
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-800">
              <span className="text-xs font-bold text-white">AI</span>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-blue-800">{productCopy.brand}</div>
              <div className="text-sm font-medium text-slate-600">{productCopy.subtitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 md:inline">
              Regulatory Intelligence Platform
            </span>
            <div className="h-8 w-8 rounded-full bg-blue-800 flex items-center justify-center">
              <span className="text-xs font-semibold text-white">G</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Navigation
          </div>
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`w-full rounded px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-800 border-l-2 border-blue-800"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className={`text-sm font-medium ${active ? "text-blue-800" : "text-slate-700"}`}>{item.label}</div>
                  <div className="text-xs text-slate-400">{item.hint}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 px-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Quick Info</div>
            <div className="space-y-1.5 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                System operational
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                API connected
              </div>
            </div>
          </div>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}
