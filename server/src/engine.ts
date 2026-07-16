// The Engine — a single orchestrated pipeline that runs the four required stages
// on ONE legal document and emits a machine-readable "Output Sample":
//
//   Discovery → Extraction → Mapping → Categorization
//
// Output includes: indicator mapping (RDTII), exact citations, verbatim snippets,
// and discovery tags — matching the hackathon Stage-2 Output Sample spec.

import { scrapeSource } from "./scraper.js";
import { extractSource } from "./extract.js";
import { classifyInstrument, classifierEnabled } from "./classify.js";
import { findIndicator } from "./indicators.js";
import { detectLanguage } from "./translate.js";
import { findSource, findSourceByUrl } from "./sources.js";

const ENGINE_VERSION = "aila-engine/1.0";

export interface EngineClause {
  id: string;
  type: string;                       // obligation | restriction | exception | penalty | right | definition
  text: string;                       // the rule, plain terms
  actor?: string;
  citation?: string;                  // EXACT citation (section/article)
  snippet?: string;                   // VERBATIM source quote (evidence)
  indicators: Array<{ code?: string; name: string }>; // INDICATOR MAPPING (RDTII)
  penalty?: string;
  effectiveDate?: string;
  confidence?: number;
}

export interface EngineOutput {
  engine: string;
  generatedAt: string;
  document: {
    id: string;
    instrument: string;
    jurisdiction: string;
    region: string;
    url: string;
    sourceType: "html" | "pdf" | "scanned-pdf";
    language: string;
    discoveryTags: string[];          // DISCOVERY TAGS
  };
  pipeline: {
    discovery: { ok: boolean; status: number; documentLinks: string[]; ms: number };
    extraction: { clauseCount: number; method: string; ms: number };
    mapping: { rdtii: Array<{ code?: string; name: string }>; pillars: string[]; policyFocus: string[]; ms: number };
    categorization: { coverage: string; rationale?: string; confidence: number };
  };
  clauses: EngineClause[];
}

/** Run the full engine on one source (by id or url) and return the Output Sample. */
export async function analyzeDocument(idOrUrl: string, byUrl = false): Promise<EngineOutput> {
  const source = byUrl ? findSourceByUrl(idOrUrl) : findSource(idOrUrl);
  if (!source) throw new Error(`Unknown source: ${idOrUrl}`);
  if (!classifierEnabled()) throw new Error("GEMINI_API_KEY not configured.");

  // ── 1) DISCOVERY ────────────────────────────────────────────────
  let t = Date.now();
  const scrape = await scrapeSource(source);
  const discoveryMs = Date.now() - t;
  const excerpt = scrape.excerpt ?? "";
  const language = detectLanguage(excerpt) || "en";
  const isPdf = source.format === "pdf" || /\.pdf(\?|#|$)/i.test(source.url);
  const sourceType: EngineOutput["document"]["sourceType"] =
    isPdf ? (/scanned|ocr/i.test(excerpt) ? "scanned-pdf" : "pdf") : "html";

  // ── 2) EXTRACTION ───────────────────────────────────────────────
  t = Date.now();
  const ext = await extractSource(source.id, { refresh: false });
  const extractionMs = Date.now() - t;

  // ── 3) MAPPING / CATEGORIZATION ─────────────────────────────────
  t = Date.now();
  const context = ext.clauses.map((c) => c.text).join(" ").slice(0, 1500) || excerpt;
  const cls = await classifyInstrument({ instrument: source.instrument, jurisdiction: source.jurisdiction, excerpt: context });
  const mappingMs = Date.now() - t;

  // ── discovery tags ──────────────────────────────────────────────
  const tags = Array.from(new Set<string>([
    "digital-trade",
    source.jurisdiction,
    source.region,
    sourceType,
    ...(cls.rdtii ?? []).map((r) => r.code),
    ...(cls.pillars ?? []),
  ].filter(Boolean) as string[]));

  const clauses: EngineClause[] = ext.clauses.map((c, i) => ({
    id: `${source.id}#${i + 1}`,
    type: c.type,
    text: c.text,
    actor: c.actor,
    citation: c.citation,
    snippet: c.sourceQuote,
    indicators: (c.indicators ?? []).map((id) => ({ code: id, name: findIndicator(id)?.focus ?? id })),
    penalty: c.penalty,
    effectiveDate: c.effectiveDate,
    confidence: c.confidence,
  }));

  return {
    engine: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    document: {
      id: source.id,
      instrument: source.instrument,
      jurisdiction: source.jurisdiction,
      region: source.region,
      url: source.url,
      sourceType,
      language,
      discoveryTags: tags,
    },
    pipeline: {
      discovery: { ok: scrape.ok, status: scrape.status, documentLinks: scrape.documentLinks ?? [], ms: discoveryMs },
      extraction: { clauseCount: clauses.length, method: process.env.GEMINI_MODEL || "gemini-2.5-flash", ms: extractionMs },
      mapping: { rdtii: cls.rdtii ?? [], pillars: cls.pillars ?? [], policyFocus: (cls.indicators ?? []).map((i) => i.focus), ms: mappingMs },
      categorization: { coverage: cls.coverage, rationale: cls.rationale, confidence: 0.85 },
    },
    clauses,
  };
}
