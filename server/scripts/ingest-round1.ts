// Ingest already-validated Round-1 rows into the validations table — no LLM, just load.
// Accepts the 13-column ESCAP CSV (Economy…Notes) OR a JSON array of ValidationRow.
// Maps the submission's Discovery Tag vocabulary (KNOWN→VERIFIED, NEW→NEW) and cleans
// the common UTF-8/Latin-1 mojibake. Blank/flagged rows are loaded with no tag so the
// fill step (npm run seed) can complete them via the bot-bypass engine.
//
//   npm run ingest:round1                         # eval/round1-seed.json
//   npm run ingest:round1 -- data/round1.csv      # the submission CSV
//
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import type { ValidationRow, DiscoveryTag } from "../src/db.js";

const here = dirname(fileURLToPath(import.meta.url));
try {
  for (const line of readFileSync(join(here, "..", ".env"), "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch { /* no .env */ }

const { initDb, saveValidations, validationStats } = await import("../src/db.js");

const file = process.argv[2] ? resolve(process.argv[2]) : join(here, "..", "eval", "round1-seed.json");
const raw = readFileSync(file, "utf-8");

// fix the common mojibake in the pasted/exported CSV
const demojibake = (s: string) => s
  .replace(/â€"|â€"|â€"|â|â|â|â/g, "—").replace(/â€™|â/g, "'").replace(/â€œ|â€/g, '"')
  .replace(/â¥/g, "≥").replace(/â¤/g, "≤").replace(/�/g, "").trim();
const blank = (s?: string) => { const v = demojibake(s ?? ""); return !v || v === "—" || v === "N/A" || /^not (populated|obtained|identified|confirmed|yet)/i.test(v) ? "" : v; };
const tagMap = (s?: string): DiscoveryTag | undefined => {
  const v = (s ?? "").trim().toUpperCase();
  if (v === "KNOWN") return "VERIFIED";
  if (["VERIFIED", "UPDATED", "NEW", "INVALID"].includes(v)) return v as DiscoveryTag;
  return undefined;
};

/** Minimal RFC-4180 CSV parser. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let f = "", r: string[] = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { r.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; r.push(f); rows.push(r); r = []; f = ""; }
    else f += c;
  }
  if (f.length || r.length) { r.push(f); rows.push(r); }
  return rows;
}

let rows: ValidationRow[];
if (file.endsWith(".csv")) {
  const H = ["Economy", "Law Name", "Law Number / Ref", "Last Amended", "Indicator ID", "Article / Section",
    "Discovery Tag", "Location Reference", "Verbatim Snippet", "Mapping Rationale", "Source URL", "Confidence", "Notes"];
  rows = parseCsv(raw)
    .filter((r) => r.length >= 13 && r[0] && r[0].trim() !== "Economy" && !/UN Global Hackathon|Round 1 Submission|REQUIRED/.test(r[0]))
    .map((r) => {
      const g = (name: string) => r[H.indexOf(name)] ?? "";
      const conf = parseFloat(g("Confidence"));
      return {
        economy: demojibake(g("Economy")), lawName: blank(g("Law Name")) || undefined,
        lawNumber: blank(g("Law Number / Ref")) || undefined, lastAmended: blank(g("Last Amended")) || undefined,
        indicatorId: blank(g("Indicator ID")) || undefined, articleSection: blank(g("Article / Section")) || undefined,
        discoveryTag: tagMap(g("Discovery Tag")), dbRow: blank(g("Location Reference")) || undefined,
        verbatim: blank(g("Verbatim Snippet")), mappingRationale: blank(g("Mapping Rationale")) || undefined,
        sourceUrl: blank(g("Source URL")) || undefined, confidence: Number.isFinite(conf) ? conf : undefined,
        notes: blank(g("Notes")) || undefined,
      } as ValidationRow;
    })
    .filter((r) => r.economy);
} else {
  rows = JSON.parse(raw);
}

await initDb();
await saveValidations(rows);
const stats = await validationStats();
const blanks = rows.filter((r) => !r.verbatim).length;
console.log(`\nIngested ${rows.length} rows from ${file} (${blanks} blank/flagged → fill via 'npm run seed')`);
console.log(`Validations table now holds ${stats.total} rows:`, stats.byTag, "\n");
process.exit(0);
