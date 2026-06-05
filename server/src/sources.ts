import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type {
  RegulationPolicy,
  RegulationSource,
  ScrapeCadence,
  ScrapeFormat,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCES_DIR = join(__dirname, "..", "sources");

// Markdown files parsed into policy rows. Add new files here.
const SOURCE_FILES = [
  "digital-trade-regulations.md",
  "digital-governance-dataset.md",
];

const FORMATS: ScrapeFormat[] = ["html", "pdf"];
const CADENCES: ScrapeCadence[] = ["daily", "weekly", "monthly"];

// Header aliases → canonical field name.
const COLUMN_ALIASES: Record<string, keyof RegulationPolicy> = {
  jurisdiction: "jurisdiction",
  country: "jurisdiction",
  instrument: "instrument",
  "act / practice": "instrument",
  "act/practice": "instrument",
  act: "instrument",
  url: "url",
  references: "url",
  link: "url",
  format: "format",
  cadence: "cadence",
  notes: "notes",
  coverage: "coverage",
  timeframe: "timeframe",
  pillar: "pillar",
  "policy focus": "policyFocus",
  policy: "policyFocus",
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

/** Split a markdown table row "| a | b |" into trimmed cells. */
function parseRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

const isSeparatorRow = (cells: string[]) =>
  cells.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, "")));

const isHeaderRow = (cells: string[]) =>
  cells.some((c) => COLUMN_ALIASES[c.toLowerCase()] !== undefined) &&
  !cells.some((c) => /^https?:\/\//i.test(c));

/** Build a column-index → field map from a header row. */
function buildColumnMap(headerCells: string[]): Map<number, keyof RegulationPolicy> {
  const map = new Map<number, keyof RegulationPolicy>();
  headerCells.forEach((cell, i) => {
    const field = COLUMN_ALIASES[cell.toLowerCase()];
    if (field) map.set(i, field);
  });
  return map;
}

function parseFile(filename: string): RegulationPolicy[] {
  let raw: string;
  try {
    raw = readFileSync(join(SOURCES_DIR, filename), "utf-8");
  } catch {
    return []; // file optional
  }

  const lines = raw.split(/\r?\n/);
  const rows: RegulationPolicy[] = [];
  let region = "General";
  let columns: Map<number, keyof RegulationPolicy> | null = null;

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      region = heading[1].trim();
      columns = null;
      continue;
    }

    if (!line.trimStart().startsWith("|")) continue;
    const cells = parseRow(line);
    if (isSeparatorRow(cells)) continue;

    if (isHeaderRow(cells)) {
      columns = buildColumnMap(cells);
      continue;
    }
    if (!columns) continue;

    const get = (field: keyof RegulationPolicy): string | undefined => {
      for (const [idx, f] of columns!) if (f === field) return cells[idx]?.trim() || undefined;
      return undefined;
    };

    const url = get("url");
    if (!url || !/^https?:\/\//i.test(url)) continue;

    const jurisdiction = get("jurisdiction") ?? "Unknown";
    const instrument = get("instrument") ?? "Untitled";
    const format = get("format") as ScrapeFormat | undefined;
    const cadence = get("cadence") as ScrapeCadence | undefined;

    rows.push({
      id: `${slugify(jurisdiction)}--${slugify(instrument)}--${rows.length}`,
      jurisdiction,
      instrument,
      url,
      region,
      format: FORMATS.includes(format as ScrapeFormat) ? (format as ScrapeFormat) : "html",
      cadence: CADENCES.includes(cadence as ScrapeCadence) ? (cadence as ScrapeCadence) : "monthly",
      coverage: get("coverage"),
      timeframe: get("timeframe"),
      pillar: get("pillar"),
      policyFocus: get("policyFocus"),
      notes: get("notes"),
    });
  }

  return rows;
}

/** All policy-level rows across every source markdown file. */
export function loadPolicies(): RegulationPolicy[] {
  return SOURCE_FILES.flatMap(parseFile);
}

/** De-duplicated crawl targets (one per unique URL). */
export function loadSources(): RegulationSource[] {
  const seen = new Set<string>();
  const sources: RegulationSource[] = [];

  for (const p of loadPolicies()) {
    if (seen.has(p.url)) continue;
    seen.add(p.url);

    let id = `${slugify(p.jurisdiction)}--${slugify(p.instrument)}`;
    if (sources.some((s) => s.id === id)) id = `${id}--${seen.size}`;

    sources.push({
      id,
      jurisdiction: p.jurisdiction,
      instrument: p.instrument,
      url: p.url,
      region: p.region,
      format: p.format,
      cadence: p.cadence,
      notes: p.notes,
    });
  }

  return sources;
}

export function findSource(id: string): RegulationSource | undefined {
  return loadSources().find((s) => s.id === id);
}
