import type { AnalysisResult } from "../../types/aila";
import { formatDateTime, formatPercent } from "../../utils/format";

export function AnalysisSummary({ result }: { result: AnalysisResult | null }) {
  if (!result) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
        Analysis results will appear here once processing is complete.
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Latest Finding</div>
            <h3 className="mt-1 text-base font-semibold text-slate-900">{result.title}</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {result.jurisdiction} · Updated {formatDateTime(result.updatedAt)}
            </p>
          </div>
          <span className="rounded border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
            {formatPercent(result.confidence)} confidence
          </span>
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm leading-6 text-slate-600">{result.summary}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded border border-red-100 bg-red-50 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-500">Identified Risks</div>
            <ul className="space-y-1.5">
              {result.risks.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-slate-700">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400"></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded border border-blue-100 bg-blue-50 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600">Recommended Actions</div>
            <ul className="space-y-1.5">
              {result.actions.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-slate-700">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500"></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
