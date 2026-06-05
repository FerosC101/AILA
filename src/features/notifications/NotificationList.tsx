import type { NotificationItem } from "../../types/aila";
import { formatDateTime } from "../../utils/format";

const toneStyles: Record<string, { bar: string; bg: string; title: string; time: string; body: string }> = {
  success: { bar: "bg-green-500",  bg: "bg-white border-slate-200",      title: "text-slate-800", time: "text-green-600",  body: "text-slate-500" },
  warning: { bar: "bg-amber-400",  bg: "bg-amber-50 border-amber-200",   title: "text-slate-800", time: "text-amber-600",  body: "text-slate-600" },
  error:   { bar: "bg-red-500",    bg: "bg-red-50 border-red-200",       title: "text-slate-800", time: "text-red-600",    body: "text-slate-600" },
  info:    { bar: "bg-blue-500",   bg: "bg-blue-50 border-blue-200",     title: "text-slate-800", time: "text-blue-600",   body: "text-slate-600" },
};

export function NotificationList({ items }: { items: NotificationItem[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Alerts & Notifications</div>
          {items.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              {items.length}
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-50 px-5">
        {items.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">No alerts at this time.</div>
        ) : (
          items.map((item) => {
            const s = toneStyles[item.severity] ?? toneStyles.info;
            return (
              <div key={item.id} className={`flex gap-3 rounded border my-2 px-3 py-3 ${s.bg}`}>
                <div className={`mt-1 w-0.5 shrink-0 self-stretch rounded-full ${s.bar}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm font-medium ${s.title}`}>{item.title}</span>
                    <span className={`shrink-0 text-xs ${s.time}`}>{formatDateTime(item.createdAt)}</span>
                  </div>
                  <p className={`mt-0.5 text-xs leading-5 ${s.body}`}>{item.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
