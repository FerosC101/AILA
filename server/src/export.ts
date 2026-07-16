// CSV export of extracted clauses in the UN ESCAP "compulsory field" structure
// (the mandated hand-over format). One row per clause; multi-indicator clauses
// join their indicator IDs with "; ". Confidence < REVIEW_THRESHOLD → Review Needed = YES.

import { loadClauses, REVIEW_THRESHOLD } from "./db.js";
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
