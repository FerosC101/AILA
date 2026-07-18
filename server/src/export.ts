// CSV export of extracted clauses in the UN ESCAP "compulsory field" structure
// (the mandated hand-over format). One row per clause; multi-indicator clauses
// join their indicator IDs with "; ". Confidence < REVIEW_THRESHOLD → Review Needed = YES.

import { loadClauses, loadValidations, REVIEW_THRESHOLD, type StoredClause, type ValidationRow } from "./db.js";
import { findIndicator, findPillarIdByName, pillarName } from "./indicators.js";
import { computeGroupAScore } from "./rawScore.js";

/** RFC-4180 field escaping: quote when the value contains a comma, quote, or newline. */
function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type ExportRow = StoredClause | ValidationRow;

/** ValidationRow has `economy`; StoredClause has `jurisdiction` instead — use as discriminator. */
const isValidationRow = (r: ExportRow): r is ValidationRow => "economy" in r;

interface ColumnDef {
  id: string;
  label: string;
  group: string;
  defaultChecked?: boolean;
  getValue: (row: ExportRow) => string;
}

// Single source of truth for every compulsory-field column, grouped per the
// gap-analysis Output Guide's six sections. Both CSV exports and the JSON
// export read from this table — nothing column-specific lives in the export
// functions themselves anymore.
//
// `defaultChecked: true` marks the old mandated Round-1 13-column template —
// this is what ships when the picker/export is called with no explicit
// column selection, matching the previous round1Csv() behaviour exactly.
const COLUMN_REGISTRY: ColumnDef[] = [
  // 1. Context / Research Scope
  {
    id: "economy", label: "Economy", group: "Context / Research Scope", defaultChecked: true,
    getValue: (r) => (isValidationRow(r) ? r.economy : r.jurisdiction) ?? "",
  },
  {
    id: "pillarId", label: "Pillar_ID", group: "Context / Research Scope",
    getValue: (r) => {
      const ids = isValidationRow(r) ? (r.indicatorId ? [r.indicatorId] : []) : r.indicators ?? [];
      const resolved = [...new Set(ids.map((id) => findIndicator(id)?.pillarId).filter((v): v is number => v != null))];
      if (resolved.length) return resolved.join("; ");
      // Fallback: no indicator resolved — try the seed's pillar label directly (Path B: user
      // supplied a pillar, not a specific indicator id).
      const fallback = isValidationRow(r) ? findPillarIdByName(r.seed?.pillar) : undefined;
      return fallback != null ? String(fallback) : "";
    },
  },
  {
    id: "pillar", label: "Pillar", group: "Context / Research Scope",
    getValue: (r) => {
      const ids = isValidationRow(r) ? (r.indicatorId ? [r.indicatorId] : []) : r.indicators ?? [];
      const resolved = [...new Set(ids.map((id) => findIndicator(id)?.pillar ?? "").filter(Boolean))];
      if (resolved.length) return resolved.join("; ");
      const fallback = isValidationRow(r) ? findPillarIdByName(r.seed?.pillar) : undefined;
      return fallback != null ? pillarName(fallback) : "";
    },
  },
  {
    id: "indicatorFocus", label: "Indicator Focus", group: "Context / Research Scope",
    getValue: (r) => {
      const ids = isValidationRow(r) ? (r.indicatorId ? [r.indicatorId] : []) : r.indicators ?? [];
      return ids.map((id) => findIndicator(id)?.focus ?? "").filter(Boolean).join("; ");
    },
  },
  {
    id: "indicatorId", label: "Indicator ID", group: "Context / Research Scope", defaultChecked: true,
    getValue: (r) => (isValidationRow(r) ? r.indicatorId ?? "" : (r.indicators ?? []).join("; ")),
  },
  {
    id: "rawScore", label: "RawScore", group: "Context / Research Scope",
    getValue: (r) => {
      const ids = isValidationRow(r) ? (r.indicatorId ? [r.indicatorId] : []) : r.indicators ?? [];
      const scores = ids.map((id) => computeGroupAScore(isValidationRow(r) ? r.economy : r.jurisdiction, id));
      if (!scores.length) return "";
      if (scores.every((s) => s === "NOT FOUND")) return "Not yet extracted";
      return scores.map((s) => (s === "NOT FOUND" ? "?" : s)).join("; ");
    },
  },

  // 2. Legal Instrument Identification
  {
    id: "lawName", label: "Law Name", group: "Legal Instrument Identification", defaultChecked: true,
    getValue: (r) => (isValidationRow(r) ? r.lawName : r.instrument) ?? "",
  },
  {
    // FLAG: clausesCsv previously labeled this "Law Number"; the mandated
    // Round-1 template calls it "Law Number / Ref". One registry entry can
    // only carry one label — defaulting to the mandated text. Override if
    // you want the shorter label back for the clauses export.
    id: "lawNumber", label: "Law Number / Ref", group: "Legal Instrument Identification", defaultChecked: true,
    getValue: (r) => r.lawNumber ?? "",
  },
  {
    // Backfilled on ValidationRow via clauses cross-reference in validate.ts —
    // validate.ts's own Gemini prompt doesn't ask for Level at all.
    id: "level", label: "Level", group: "Legal Instrument Identification",
    getValue: (r) => r.level ?? "",
  },
  {
    id: "lastAmended", label: "Last Amended", group: "Legal Instrument Identification", defaultChecked: true,
    getValue: (r) => r.lastAmended ?? "",
  },
  {
    // Document-level scope (e.g. "Cross-cutting", "Telecommunications services"), stamped onto
    // every clause of a document by extract.ts, and onto every provision by validate.ts's
    // Gemini prompt (falls back to the seed row's `context` field when no source was retrieved).
    id: "coverage", label: "Coverage", group: "Legal Instrument Identification",
    getValue: (r) => r.coverage ?? "",
  },
  {
    // Document-level temporal scope (e.g. "Since 2023, last amended 2024"), same plumbing as Coverage.
    id: "timeframe", label: "Timeframe", group: "Legal Instrument Identification",
    getValue: (r) => r.timeframe ?? "",
  },

  // 3. Legal Classification
  {
    // Only exists on StoredClause.
    id: "clauseType", label: "Clause Type", group: "Legal Classification",
    getValue: (r) => (isValidationRow(r) ? "" : r.type ?? ""),
  },
  {
    // Only exists on StoredClause.
    id: "actor", label: "Actor", group: "Legal Classification",
    getValue: (r) => (isValidationRow(r) ? "" : r.actor ?? ""),
  },

  // 4. Legal Evidence
  {
    id: "articleSection", label: "Article / Section", group: "Legal Evidence", defaultChecked: true,
    getValue: (r) => (isValidationRow(r) ? r.articleSection : r.citation) ?? "",
  },
  {
    // ValidationRow's dbRow field IS its location reference (per db.ts comment).
    id: "locationReference", label: "Location Reference", group: "Legal Evidence", defaultChecked: true,
    getValue: (r) => (isValidationRow(r) ? r.dbRow : r.locationReference) ?? "",
  },
  {
    // Only exists on StoredClause.
    id: "ruleText", label: "Rule Text", group: "Legal Evidence",
    getValue: (r) => (isValidationRow(r) ? "" : r.text ?? ""),
  },
  {
    id: "verbatimSnippet", label: "Verbatim Snippet", group: "Legal Evidence", defaultChecked: true,
    getValue: (r) => (isValidationRow(r) ? r.verbatim : r.sourceQuote) ?? "",
  },

  // 5. Legal Analysis
  {
    id: "mappingRationale", label: "Mapping Rationale", group: "Legal Analysis", defaultChecked: true,
    getValue: (r) => r.mappingRationale ?? "",
  },
  {
    // Per-clause/per-provision practical-impact note; populated by extract.ts's Gemini
    // prompt for clauses and by validate.ts's Gemini prompt for validation rows.
    id: "impactComments", label: "Impact or Comments on Acts or Practices", group: "Legal Analysis",
    getValue: (r) => r.impactComments ?? "",
  },

  // 6. Source & Validation
  {
    id: "sourceUrl", label: "Source URL", group: "Source & Validation", defaultChecked: true,
    getValue: (r) => (isValidationRow(r) ? r.sourceUrl : r.url) ?? "",
  },
  {
    // Validations: full ESCAP vocabulary (VERIFIED | UPDATED | NEW | INVALID).
    // Clauses: extract.ts vocabulary (e.g. "candidate — no RDTII match" for scraped
    // substantive rules with no RDTII indicator match — not the same as validation NEW).
    id: "discoveryTag", label: "Discovery Tag", group: "Source & Validation", defaultChecked: true,
    getValue: (r) => r.discoveryTag ?? "",
  },
  {
    id: "confidence", label: "Confidence", group: "Source & Validation", defaultChecked: true,
    getValue: (r) => (r.confidence != null ? r.confidence.toFixed(2) : ""),
  },
  {
    // Pure code derivation, same rule for both row types.
    id: "reviewNeeded", label: "Review Needed", group: "Source & Validation",
    getValue: (r) => (r.confidence != null && r.confidence < REVIEW_THRESHOLD ? "YES" : ""),
  },
  {
    // Preserves the original asymmetry: clauses show raw notes; validations
    // get the old notesOut() [UPDATED]/[INVALID] prefix.
    id: "notes", label: "Notes", group: "Source & Validation", defaultChecked: true,
    getValue: (r) => {
      if (!isValidationRow(r)) return r.notes ?? "";
      const t = r.discoveryTag;
      return (t === "UPDATED" || t === "INVALID") ? `[${t}] ${r.notes ?? ""}`.trim() : (r.notes ?? "");
    },
  },
];

const COLUMN_BY_ID = new Map(COLUMN_REGISTRY.map((c) => [c.id, c]));

/** The columns checked by default in the picker UI — the old mandated Round-1 template. */
// NOTE: intentionally NOT derived via COLUMN_REGISTRY.filter(c => c.defaultChecked) —
// that filter preserves registry/section order (grouped by Context, Legal Instrument
// ID, etc.), not submission order. The Round-1 template's column ORDER is mandated by
// ESCAP, so this list is spelled out explicitly, id-for-id, matching the pre-refactor
// ROUND1_HEADERS order exactly:
//   Economy, Law Name, Law Number/Ref, Last Amended, Indicator ID, Article/Section,
//   Discovery Tag, Location Reference, Verbatim Snippet, Mapping Rationale, Source URL,
//   Confidence, Notes
export const DEFAULT_COLUMNS = [
  "economy", "lawName", "lawNumber", "lastAmended", "indicatorId", "articleSection",
  "discoveryTag", "locationReference", "verbatimSnippet", "mappingRationale", "sourceUrl",
  "confidence", "notes",
];

// Guard against DEFAULT_COLUMNS (submission order) and the registry's `defaultChecked`
// flags (picker pre-check state) drifting apart — same *set* of ids, different array,
// so nothing enforces that at the type level. Fails loudly at import time instead of
// silently mis-checking boxes in the picker or dropping a mandated column.
{
  const checkedSet = new Set(COLUMN_REGISTRY.filter((c) => c.defaultChecked).map((c) => c.id));
  const defaultSet = new Set(DEFAULT_COLUMNS);
  const missing = [...checkedSet].filter((id) => !defaultSet.has(id));
  const extra = [...defaultSet].filter((id) => !checkedSet.has(id));
  if (missing.length || extra.length) {
    throw new Error(
      `DEFAULT_COLUMNS / defaultChecked mismatch — missing: [${missing.join(", ")}], extra: [${extra.join(", ")}]. ` +
      `Update both COLUMN_REGISTRY's defaultChecked flags and the DEFAULT_COLUMNS order list together.`,
    );
  }
}

/** For the frontend picker: id/label/group/defaultChecked, grouped for display. */
export function listColumns() {
  return COLUMN_REGISTRY.map(({ id, label, group, defaultChecked }) => ({ id, label, group, defaultChecked }));
}

/** Hard cap on how many columns a single export request may select (picker safety valve). */
const MAX_COLUMNS = 25;

/**
 * Validate a requested column id list against the registry:
 * - omitted/empty → falls back to DEFAULT_COLUMNS (the old mandated Round-1 set)
 * - more than MAX_COLUMNS ids → rejected
 * - any id not in COLUMN_REGISTRY → rejected (no silent drops — the caller gets a clear error)
 */
function resolveColumns(columns?: string[]): ColumnDef[] {
  const ids = columns && columns.length ? columns : DEFAULT_COLUMNS;
  if (ids.length > MAX_COLUMNS) throw new Error(`Too many columns requested (${ids.length}) — max ${MAX_COLUMNS}.`);
  return ids.map((id) => {
    const col = COLUMN_BY_ID.get(id);
    if (!col) throw new Error(`Unknown export column id: ${id}`);
    return col;
  });
}

interface ExportOpts {
  source: "clauses" | "validations";
  columns?: string[];              // validated + capped via resolveColumns(); defaults to DEFAULT_COLUMNS when omitted
  filter?: { jurisdiction?: string; type?: string; sourceId?: string; economy?: string; indicator?: string; tag?: string };
}

/** Shared step for both exportCsv and exportJson: validate columns once, load rows once. */
async function resolveExport({ source, columns, filter = {} }: ExportOpts): Promise<{ cols: ColumnDef[]; rows: ExportRow[] }> {
  const cols = resolveColumns(columns);
  const rows: ExportRow[] = source === "validations"
    ? await loadValidations(filter)
    : await loadClauses({ ...filter, limit: 10_000 });
  return { cols, rows };
}

/** CSV export — column selection replaces the old round1Csv/clausesCsv split. */
export async function exportCsv(opts: ExportOpts): Promise<string> {
  const { cols, rows } = await resolveExport(opts);
  const lines = [cols.map((c) => c.label).join(",")];
  for (const r of rows) lines.push(cols.map((c) => esc(c.getValue(r))).join(","));
  return lines.join("\r\n");
}

/** JSON export — same column selection/validation as exportCsv; one flat object per row, keyed by column id. */
export async function exportJson(opts: ExportOpts): Promise<Record<string, string>[]> {
  const { cols, rows } = await resolveExport(opts);
  return rows.map((r) => Object.fromEntries(cols.map((c) => [c.id, c.getValue(r)])));
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
      source_pdf_path: null, ocr_quality_cer: null,
      provisions: [] as any[],
    });
    byLaw.get(key).provisions.push({
      indicator_id: COLUMN_BY_ID.get("indicatorId")!.getValue(r) || null,
      article_section: COLUMN_BY_ID.get("articleSection")!.getValue(r) || null,
      discovery_tag: COLUMN_BY_ID.get("discoveryTag")!.getValue(r) || null,
      validation_status: r.discoveryTag ?? null,
      location_reference: COLUMN_BY_ID.get("locationReference")!.getValue(r) || null,
      verbatim_snippet: COLUMN_BY_ID.get("verbatimSnippet")!.getValue(r) || null,
      mapping_rationale: COLUMN_BY_ID.get("mappingRationale")!.getValue(r) || null,
      confidence: r.confidence ?? null,
      notes: COLUMN_BY_ID.get("notes")!.getValue(r) || null,
      raw_context: null,
    });
  }
  return {
    generated_at: new Date().toISOString(),
    model_version: `${process.env.GEMINI_MODEL || "gemini-2.5-flash"} + gemini-embedding-001 / OCR: tesseract.js`,
    processing_time: null,
    law_count: byLaw.size,
    provision_count: rows.length,
    laws: [...byLaw.values()],
  };
}

// ── back-compat wrappers ────────────────────────────────────────────────────
// index.ts's existing /export/clauses.csv and /export/round1.csv routes call
// these two names directly. Keeping them (as thin exportCsv() calls) means the
// registry refactor is a drop-in — no route changes required to ship this.

/** The pre-refactor clauses.csv column set/order, preserved exactly for /export/clauses.csv. */
const LEGACY_CLAUSES_COLUMNS = [
  "economy", "lawName", "lawNumber", "level", "lastAmended", "clauseType", "actor",
  "indicatorId", "indicatorFocus", "pillar", "articleSection", "locationReference",
  "discoveryTag", "verbatimSnippet", "mappingRationale", "sourceUrl", "confidence",
  "reviewNeeded", "notes", "ruleText",
];

/** Build a CSV of clauses in the compulsory-field structure (legacy 20-column layout). */
export async function clausesCsv(filter: { jurisdiction?: string; type?: string; sourceId?: string } = {}): Promise<string> {
  return exportCsv({ source: "clauses", columns: LEGACY_CLAUSES_COLUMNS, filter });
}

/** Build the Round-1 submission CSV — exact 13-column ESCAP template (= DEFAULT_COLUMNS). */
export async function round1Csv(filter: { economy?: string; indicator?: string; tag?: string } = {}): Promise<string> {
  return exportCsv({ source: "validations", filter });
}