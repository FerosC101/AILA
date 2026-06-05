import { MetricCard } from "../components/common/MetricCard";
import { GraphView } from "../components/graph/GraphView";
import { AnalysisSummary } from "../features/analysis/AnalysisSummary";
import { NotificationList } from "../features/notifications/NotificationList";
import { UploadCard } from "../features/upload/UploadCard";
import type { AnalysisResult, DashboardMetrics, NotificationItem, UploadInput, UploadRecord } from "../types/aila";
import { formatCount } from "../utils/format";
import { StatusPill } from "../components/common/StatusPill";

export function DashboardPage({
  uploads,
  selectedResult,
  notifications,
  metrics,
  isBooting,
  isSubmitting,
  error,
  onCreateReview,
}: {
  uploads: UploadRecord[];
  selectedResult: AnalysisResult | null;
  notifications: NotificationItem[];
  metrics: DashboardMetrics | null;
  isBooting: boolean;
  isSubmitting: boolean;
  error: string | null;
  onCreateReview: (input: UploadInput) => Promise<void>;
}) {
  const selectedUpload = selectedResult ? uploads.find((item) => item.id === selectedResult.uploadId) ?? null : uploads[0] ?? null;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Dashboard</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">Legal & Regulatory Review</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
              Upload regulatory documents, track processing status, and review AI-verified compliance findings.
            </p>
          </div>
          <StatusPill tone={metrics ? "success" : "neutral"}>{metrics ? "System Ready" : "Loading…"}</StatusPill>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {/* Metrics row */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Queued" value={formatCount(metrics?.queued ?? 0)} detail="Documents pending review" />
        <MetricCard label="Processing" value={formatCount(metrics?.processing ?? 0)} detail="Active analysis jobs" />
        <MetricCard
          label="Completed today"
          value={formatCount(metrics?.completedToday ?? 0)}
          detail={`Avg. turnaround ${metrics?.avgTurnaroundMinutes ?? 0} min`}
        />
      </div>

      {/* Regulatory map */}
      <GraphView />

      {/* Upload + analysis panels */}
      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
        <UploadCard onSubmit={onCreateReview} isSubmitting={isSubmitting} selectedUpload={selectedUpload} />
        <div className="space-y-5">
          <AnalysisSummary result={selectedResult} />
          <NotificationList items={notifications} />
        </div>
      </div>

      {isBooting ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-400">
          Loading workspace data…
        </div>
      ) : null}
    </div>
  );
}
