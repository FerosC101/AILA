// Apply the AILA v5 methodology over a seed database (the CrawlerSeed / Round-1 DB).
// Reads a JSON or CSV seed, maps each row to a SeedRow, runs the validate-and-discover
// engine, and persists the 13-column validated output. Then GET /export/round1.csv.
//
//   npm run seed -- path/to/seed.json            # JSON array
//   npm run seed -- path/to/seed.csv --limit=25  # CSV (CrawlerSeed columns), first 25 rows
//   npm run seed -- path/to/seed.csv --economy=Malaysia
//
// Accepts either SeedRow objects ({economy, lawName, indicators, ...}) or raw
// CrawlerSeed columns (Country, Act/Practice, Policy Focus, indicator_id_fmt, Pillar, URL).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import type { SeedRow } from "../src/validate.js";

const here = dirname(fileURLToPath(import.meta.url));
try {
  for (const line of readFileSync(join(here, "..", ".env"), "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch { /* no .env */ }

const { initDb, validationStats, loadValidations } = await import("../src/db.js");
const { validateSeedRow } = await import("../src/validate.js");

const args = process.argv.slice(2);
const fillMode = args.includes("--fill");   // re-validate already-ingested BLANK rows via the bypass engine
const file = args.find((a) => !a.startsWith("--"));
if (!file && !fillMode) { console.error("Usage: npm run seed -- <seed.json|seed.csv> [--limit=N] [--economy=X]   |   npm run seed -- --fill [--limit=N] [--economy=X]"); process.exit(1); }
const limit = Number((args.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0) || Infinity;
const onlyEconomy = (args.find((a) => a.startsWith("--economy=")) || "").split("=")[1];

/** Minimal RFC-4180 CSV parser → array of row objects keyed by header. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = (rows.shift() ?? []).map((h) => h.trim());
  return rows.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

const pick = (o: any, ...keys: string[]) => { for (const k of keys) if (o[k] != null && o[k] !== "") return o[k]; return undefined; };

/** Map an arbitrary seed record (SeedRow or CrawlerSeed columns) → SeedRow. */
function toSeed(o: any, idx: number): SeedRow {
  if (o.economy) return { dbRow: o.dbRow ?? idx + 1, ...o };
  const ind = pick(o, "indicator_id_fmt", "indicator_id", "Indicator ID", "indicatorId");
  return {
    dbRow: pick(o, "Row", "row", "dbRow") ?? idx + 1,
    economy: pick(o, "Country", "Economy", "economy"),
    lawName: pick(o, "Act / Practice", "Act/Practice", "Law Name", "lawName"),
    lawNumber: pick(o, "Law Number / Ref", "Law Number", "lawNumber"),
    indicators: ind ? [String(ind)] : undefined,
    pillar: pick(o, "Pillar", "pillar"),
    context: [pick(o, "Policy Focus", "policyFocus"), pick(o, "Coverage"), pick(o, "Timeframe")].filter(Boolean).join(" · ") || undefined,
    seedUrl: pick(o, "URL", "Source URL", "url", "seedUrl"),
  };
}

await initDb();

let seeds: SeedRow[];
if (fillMode) {
  // Build seeds from the blank/flagged rows already in the validations table.
  let blanks = (await loadValidations({ economy: onlyEconomy })).filter((v) => !v.verbatim && (v.lawName || v.sourceUrl) && v.indicatorId);
  seeds = blanks.slice(0, limit).map((v, i) => ({
    dbRow: v.dbRow ?? i + 1, economy: v.economy, lawName: v.lawName, lawNumber: v.lawNumber,
    indicators: v.indicatorId ? [v.indicatorId] : undefined,
    context: [v.articleSection, v.mappingRationale, v.notes].filter(Boolean).join(" · ").slice(0, 400) || undefined,
    seedUrl: v.sourceUrl,
  }));
  console.log(`\nAILA v5 — filling ${seeds.length} blank rows via bot-bypass\n${"=".repeat(64)}`);
} else {
  const path = resolve(file!);
  const raw = readFileSync(path, "utf-8");
  const records = path.endsWith(".csv") ? parseCsv(raw) : JSON.parse(raw);
  seeds = records.map(toSeed).filter((s: SeedRow) => s.economy);
  if (onlyEconomy) seeds = seeds.filter((s) => s.economy.toLowerCase() === onlyEconomy.toLowerCase());
  seeds = seeds.slice(0, limit);
  console.log(`\nAILA v5 — validating ${seeds.length} seed rows from ${path}\n${"=".repeat(64)}`);
}
let provisions = 0, errors = 0;
for (let i = 0; i < seeds.length; i++) {
  const s = seeds[i];
  try {
    const r = await validateSeedRow(s);
    provisions += r.length;
    const tags = r.map((x) => x.discoveryTag).join(",");
    console.log(`[${i + 1}/${seeds.length}] ${s.economy} · ${(s.lawName ?? "?").slice(0, 40)} · ${(s.indicators ?? []).join(",")} → ${r.length} (${tags})`);
  } catch (e) {
    errors++;
    console.log(`[${i + 1}/${seeds.length}] ERROR ${s.economy} · ${s.lawName} — ${e instanceof Error ? e.message : e}`);
  }
}
const stats = await validationStats();
console.log("=".repeat(64));
console.log(`Done: ${provisions} provisions, ${errors} errors. Validations table:`, stats.byTag);
console.log(`Export: GET /export/round1.csv\n`);
process.exit(0);
