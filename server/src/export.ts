// CSV export of extracted clauses in the UN ESCAP "compulsory field" structure
// (the mandated hand-over format). One row per clause; multi-indicator clauses
// join their indicator IDs with "; ". Confidence < REVIEW_THRESHOLD → Review Needed = YES.

import { loadClauses, loadValidations, REVIEW_THRESHOLD } from "./db.js";
import { findIndicator } from "./indicators.js";

// Column order follows the gap-analysis Output Guide's compulsory schema.
const HEADERS = [
  "Economy", "Law Name", "Law Number", "Level", "Last Amended",
  "Clause Type", "Actor", "Indicator ID", "Indicator Focus", "Pillar",
  "Article / Section", "Location Reference", "Discovery Tag",
  "Verbatim Snippet", "Mapping Rationale", "Source URL",
  "Confidence", "Review Needed", "Notes", "Rule Text",
];

/** RFC-4180 field escaping: quote when the value contains a comma, quote, or newline. */
function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// The exact 13-column ESCAP-RDTII Round-1 output template (order is mandated).
const ROUND1_HEADERS = [
  "Economy", "Law Name", "Law Number / Ref", "Last Amended", "Indicator ID", "Article / Section",
  "Discovery Tag", "Location Reference", "Verbatim Snippet", "Mapping Rationale", "Source URL", "Confidence", "Notes",
];

// Discovery Tag column per the official output spec: KNOWN (from the sample-kit DB)
// or NEW (independently discovered). The engine's richer status (UPDATED / INVALID /
// VERIFIED) is preserved in Notes so no detail is lost.
// Every validated row originates from the sample-kit DB (KNOWN) unless it was an
// independent discovery (NEW). Discovery Tag is a required field → default to KNOWN.
const tagOut = (t?: string): string => (t === "NEW" ? "NEW" : "KNOWN");
const notesOut = (t?: string, notes?: string): string =>
  (t === "UPDATED" || t === "INVALID") ? `[${t}] ${notes ?? ""}`.trim() : (notes ?? "");

/** Build the Round-1 submission CSV — exact 13-column ESCAP template. */
export async function round1Csv(filter: { economy?: string; indicator?: string; tag?: string } = {}): Promise<string> {
  const rows = await loadValidations(filter);
  const lines = [ROUND1_HEADERS.join(",")];
  for (const r of rows) {
    lines.push([
      r.economy, r.lawName, r.lawNumber, r.lastAmended, r.indicatorId, r.articleSection,
      tagOut(r.discoveryTag), r.dbRow, r.verbatim, r.mappingRationale, r.sourceUrl,
      r.confidence != null ? r.confidence.toFixed(2) : "",   // numeric 0.00–1.00 per spec
      notesOut(r.discoveryTag, r.notes),
    ].map(esc).join(","));
  }
  return lines.join("\r\n");
}

/** Supplementary JSON — richer metadata the CSV can't hold cleanly, grouped by law. */
export async function round1Json(filter: { economy?: string; indicator?: string; tag?: string } = {}) {
  const rows = await loadValidations(filter);
  const byLaw = new Map<string, any>();
  for (const r of rows) {
    const key = `${r.economy}|${r.lawName ?? ""}|${r.lawNumber ?? ""}`;
    if (!byLaw.has(key)) byLaw.set(key, {
      economy: r.economy, law_name: r.lawName ?? null, law_number: r.lawNumber ?? null,
      last_amended: r.lastAmended ?? null, source_url: r.sourceUrl ?? null,
      source_pdf_path: null, ocr_quality_cer: null,   // require local-PDF caching + a CER metric (not built)
      processing_time: null as number | null,
      provisions: [] as any[],
    });
    const law = byLaw.get(key);
    law.provisions.push({
      indicator_id: r.indicatorId ?? null, article_section: r.articleSection ?? null,
      discovery_tag: tagOut(r.discoveryTag) || null, validation_status: r.discoveryTag ?? null,
      location_reference: r.dbRow ?? null, verbatim_snippet: r.verbatim || null,
      mapping_rationale: r.mappingRationale ?? null, confidence: r.confidence ?? null,
      notes: r.notes ?? null, raw_context: r.rawContext ?? null,
    });
    // processing_time (seconds) for the law = the doc's validation wall-clock time
    if (typeof r.processingMs === "number") law.processing_time = Number((r.processingMs / 1000).toFixed(2));
  }
  const laws = [...byLaw.values()];
  const totalSec = laws.reduce((a, l) => a + (l.processing_time ?? 0), 0);
  return {
    generated_at: new Date().toISOString(),
    model_version: `${process.env.GEMINI_MODEL || "gemini-2.5-flash"} + gemini-embedding-001 / OCR: tesseract.js`,
    processing_time: Number(totalSec.toFixed(2)),   // total validation wall-clock (sum of per-doc)
    law_count: byLaw.size,
    provision_count: rows.length,
    laws,
  };
}

/** Build a CSV of clauses in the compulsory-field structure. */
export async function clausesCsv(filter: { jurisdiction?: string; type?: string; sourceId?: string } = {}): Promise<string> {
  const rows = await loadClauses({ ...filter, limit: 10_000 });
  const lines = [HEADERS.join(",")];
  for (const c of rows) {
    const ids = c.indicators ?? [];
    const focuses = ids.map((id) => findIndicator(id)?.focus ?? "").filter(Boolean);
    const pillars = [...new Set(ids.map((id) => findIndicator(id)?.pillar ?? "").filter(Boolean))];
    const reviewNeeded = c.confidence != null && c.confidence < REVIEW_THRESHOLD ? "YES" : "";
    lines.push([
      c.jurisdiction, c.instrument, c.lawNumber, c.level, c.lastAmended,
      c.type, c.actor, ids.join("; "), focuses.join("; "), pillars.join("; "),
      c.citation, c.locationReference, c.discoveryTag,
      c.sourceQuote, c.mappingRationale, c.url,
      c.confidence != null ? c.confidence.toFixed(2) : "", reviewNeeded, c.notes, c.text,
    ].map(esc).join(","));
  }
  return lines.join("\r\n");
}
