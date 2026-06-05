import { AnalysisSummary } from "../features/analysis/AnalysisSummary";
import type { AnalysisResult } from "../types/aila";
import { formatDateTime, formatPercent } from "../utils/format";

export function ResultsPage({
  results,
  selectedResult,
  onSelectResult,
}: {
  results: AnalysisResult[];
  selectedResult: AnalysisResult | null;
  onSelectResult: (resultId: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Results</div>
        <h2 className="mt-1 text-2xl font-semibold text-white">Findings</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Confirm obligations and assign actions from verified analysis outputs.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-white/8 bg-white/5 p-5">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-500">Recent outputs</div>
          <div className="mt-4 space-y-3">
            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                No results available yet.
              </div>
            ) : (
              results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectResult(item.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedResult?.id === item.id ? "border-cyan-400/30 bg-cyan-400/10" : "border-white/8 bg-slate-950/30 hover:bg-white/6"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.jurisdiction}</div>
                    </div>
                    <div className="text-right text-sm text-slate-300">
                      <div>{formatPercent(item.confidence)}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(item.updatedAt)}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <AnalysisSummary result={selectedResult} />
      </div>
    </div>
  );
}
