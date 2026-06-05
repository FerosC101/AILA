import { useEffect, useState } from "react";
import { productCopy } from "../../lib/content";
import { audienceOptions, focusAreas } from "../../lib/seedData";
import type { UploadInput, UploadRecord } from "../../types/aila";
import { StatusPill } from "../../components/common/StatusPill";

export function UploadCard({
  onSubmit,
  isSubmitting,
  selectedUpload,
}: {
  onSubmit: (input: UploadInput) => Promise<void>;
  isSubmitting: boolean;
  selectedUpload: UploadRecord | null;
}) {
  const [fileName, setFileName] = useState(selectedUpload?.fileName ?? "");
  const [jurisdiction, setJurisdiction] = useState(selectedUpload?.jurisdiction ?? "Singapore");
  const [documentType, setDocumentType] = useState(selectedUpload?.documentType ?? "Regulation update");
  const [notes, setNotes] = useState(selectedUpload?.notes ?? "");
  const [sourceLabel, setSourceLabel] = useState(selectedUpload?.sourceLabel ?? "Official portal");

  useEffect(() => {
    if (!selectedUpload) return;
    setFileName(selectedUpload.fileName);
    setJurisdiction(selectedUpload.jurisdiction);
    setDocumentType(selectedUpload.documentType);
    setNotes(selectedUpload.notes ?? "");
    setSourceLabel(selectedUpload.sourceLabel ?? "Official portal");
  }, [selectedUpload]);

  const handleSubmit = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    await onSubmit({ fileName, jurisdiction, documentType, notes, sourceLabel });
  };

  const inputClass =
    "w-full rounded border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300";

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Document Submission</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{productCopy.primaryAction}</h2>
            <p className="mt-1 text-sm text-slate-500">{productCopy.description}</p>
          </div>
          <StatusPill tone="info">API Ready</StatusPill>
        </div>
      </div>

      <form className="p-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Document Name</span>
            <input
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              className={inputClass}
              placeholder="e.g. MAS Notice 626 Amendment"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Jurisdiction</span>
            <input
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value)}
              className={inputClass}
              placeholder="Singapore"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Document Type</span>
            <input
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className={inputClass}
              placeholder="Regulation update"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Source</span>
            <input
              value={sourceLabel}
              onChange={(event) => setSourceLabel(event.target.value)}
              className={inputClass}
              placeholder="Official portal"
            />
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes for Review Team</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={`min-h-24 ${inputClass}`}
              placeholder="Add context, urgency level, or specific compliance questions for the review team."
            />
          </label>
        </div>

        {/* Tags */}
        <div className="mt-4 border-t border-slate-50 pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Focus Areas</div>
          <div className="flex flex-wrap gap-1.5">
            {focusAreas.map((item) => (
              <span key={item} className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                {item}
              </span>
            ))}
            {audienceOptions.map((item) => (
              <span key={item} className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-50 pt-4">
          <p className="text-xs text-slate-400">
            {selectedUpload
              ? `Reusing upload: ${selectedUpload.fileName}`
              : "Create a new review job or select an existing upload."}
          </p>
          <button
            type="submit"
            disabled={isSubmitting || !fileName.trim()}
            className="rounded bg-blue-800 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? "Submitting…" : "Submit for Review"}
          </button>
        </div>
      </form>
    </section>
  );
}
