// Clause-level extraction — turns a regulation's text into structured
// "regulatory atoms" (obligation / restriction / exception / penalty / right /
// definition) with the verbatim source quote used as evidence, RDTII tags, and
// a citation reference. Persisted to the `clauses` table.

import * as cheerio from "cheerio";
import { fetchText, fetchPdfText } from "./scraper.js";
import { renderText, renderEnabled } from "./render.js";
import { ensureEnglish } from "./translate.js";
import { RDTII_INDICATORS, isIndicatorId, findIndicator, pillarName } from "./indicators.js";
import { findSource, loadSources } from "./sources.js";
import { activeUrlSet, healthReady, refreshHealth } from "./scanner.js";
import { saveClauses, upsertSources, type StoredClause } from "./db.js";
import { recordGeminiUsage } from "./cost.js";
import { classifyAuthority } from "./authority.js";
import { embedTexts, loadClauseIndex } from "./rag.js";
import type { RegulationSource } from "./types.js";

// Compact RDTII indicator catalog for the extraction prompt.
const INDICATOR_CATALOG = RDTII_INDICATORS.map((i) => `${i.id} (P${i.pillarId} ${i.pillar}): ${i.focus}`).join("\n");
const CLAUSE_TYPES = ["obligation", "restriction", "exception", "penalty", "right", "definition"];
const MAX_INPUT = Number(process.env.EXTRACT_WINDOW_CHARS ?? 9000);     // chars per model window
const MAX_DOC = 40_000;                                                 // max document chars pulled before windowing
const MAX_WINDOWS = Number(process.env.EXTRACT_MAX_WINDOWS ?? 3);       // cost guard: max passes over one doc
const WINDOW_OVERLAP = 400;                                             // chars shared between windows (avoid cutting a clause)
const MAX_TOTAL_CLAUSES = 40;                                           // cap after merging all windows

export function extractorEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/** Pull (and translate) the document body for a source. */
async function getDocText(source: RegulationSource): Promise<string> {
  let text = "";
  if (source.format === "pdf" || /\.pdf(\?|#|$)/i.test(source.url)) {
    text = (await fetchPdfText(source.url, 25000, MAX_DOC).catch(() => null)) ?? "";
  } else {
    const html = await fetchText(source.url, 12000);
    if (html) {
      const $ = cheerio.load(html);
      $("script, style, noscript, svg, header, footer, nav, form").remove();
      text = ($("main").length ? $("main") : $("body")).text().replace(/\s+/g, " ").trim().slice(0, MAX_DOC);
    }
    if (text.length < 300 && renderEnabled()) {
      const rendered = await renderText(source.url, 25000, MAX_DOC).catch(() => null);
      if (rendered && rendered.length > text.length) text = rendered;
    }
  }
  if (!text) return "";
  return ensureEnglish(text, source.id, source.jurisdiction);
}

/** Split a long document into overlapping windows so extraction covers the WHOLE law, not just the first section. */
export function windowDocument(text: string): string[] {
  if (text.length <= MAX_INPUT) return [text];
  const windows: string[] = [];
  let start = 0;
  while (start < text.length && windows.length < MAX_WINDOWS) {
    windows.push(text.slice(start, start + MAX_INPUT));
    start += MAX_INPUT - WINDOW_OVERLAP;
  }
  return windows;
}

/** Fill missing document-level fields from later windows (first non-empty wins). */
function mergeDoc(a: RawDoc, b: RawDoc): RawDoc {
  return {
    level: a.level ?? b.level, lawNumber: a.lawNumber ?? b.lawNumber, lastAmended: a.lastAmended ?? b.lastAmended,
    coverage: a.coverage ?? b.coverage, timeframe: a.timeframe ?? b.timeframe,
  };
}

/** De-duplicate clauses by normalized text (windows overlap) and cap the total. */
function dedupeClauses(clauses: StoredClause[]): StoredClause[] {
  const seen = new Set<string>();
  const out: StoredClause[] = [];
  for (const c of clauses) {
    const key = c.text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= MAX_TOTAL_CLAUSES) break;
  }
  return out;
}

/** Run extraction across every window of a document and merge the results. */
async function extractWindows(instrument: string, jurisdiction: string, text: string, hint?: ExtractHint): Promise<{ doc: RawDoc; raw: RawClause[] }> {
  const windows = windowDocument(text);
  let doc: RawDoc = {};
  const raw: RawClause[] = [];
  for (const w of windows) {
    const r = await callGemini(instrument, jurisdiction, w, hint);
    doc = mergeDoc(doc, r.doc);
    raw.push(...r.clauses);
    if (raw.length >= MAX_TOTAL_CLAUSES * 2) break; // plenty — stop paying for more windows
  }
  return { doc, raw };
}

const LEGAL_LEVELS = ["Act", "Regulation", "Amendment", "Sector Code", "Guideline", "Agreement", "Bill", "Other"];
const SUBSTANTIVE = new Set(["obligation", "restriction", "exception", "penalty", "right"]);

interface RawClause {
  type: string; text: string; actor?: string; indicators?: string[];
  penalty?: string; effectiveDate?: string; citation?: string; sourceQuote?: string; confidence?: number;
  locationReference?: string; mappingRationale?: string; notes?: string; impactComments?: string;
}
interface RawDoc { level?: string; lawNumber?: string; lastAmended?: string; coverage?: string; timeframe?: string }

/** Optional guidance that biases extraction toward a pillar / indicator (P2-5). */
export interface ExtractHint { pillarId?: number; indicatorId?: string }

/** Build the FOCUS line injected into the prompt when a pillar/indicator hint is supplied. */
function focusLine(hint?: ExtractHint): string {
  if (!hint) return "";
  if (hint.indicatorId && isIndicatorId(hint.indicatorId)) {
    const ind = findIndicator(hint.indicatorId)!;
    return `\nFOCUS: This document is being reviewed specifically for indicator ${ind.id} (P${ind.pillarId} ${ind.pillar}: ${ind.focus}). Prioritise clauses relevant to it, but still extract other substantive clauses.\n`;
  }
  if (typeof hint.pillarId === "number") {
    const ids = RDTII_INDICATORS.filter((i) => i.pillarId === hint.pillarId).map((i) => i.id);
    if (ids.length) return `\nFOCUS: This document is being reviewed for pillar P${hint.pillarId} (${pillarName(hint.pillarId)}). Pay special attention to clauses mapping to ${ids.join(", ")}, but still extract other substantive clauses.\n`;
  }
  return "";
}

/** Validate model-proposed indicator IDs against the real seed taxonomy (anti-hallucination). */
function validateIndicators(ids: unknown): { indicators: string[]; rdtii: string[] } {
  const valid = (Array.isArray(ids) ? ids : [])
    .filter((id): id is string => typeof id === "string" && isIndicatorId(id));
  const uniq = [...new Set(valid)].slice(0, 4); // multi-indicator, capped
  return { indicators: uniq, rdtii: uniq.map((id) => findIndicator(id)!.focus) };
}

/** Build a persisted clause: validate indicators + stamp document-level + compulsory fields. */
function toStoredClause(
  c: RawClause,
  meta: { sourceId: string; jurisdiction: string; instrument: string; url: string },
  doc: RawDoc,
): StoredClause {
  const { indicators, rdtii } = validateIndicators(c.indicators);
  // Discovery tag: a substantive rule that matched NO real RDTII indicator → candidate new finding
  const discoveryTag = indicators.length === 0 && SUBSTANTIVE.has(c.type) ? "candidate — no RDTII match" : undefined;
  return {
    ...meta,
    type: c.type, text: c.text.trim(), actor: c.actor || undefined,
    indicators, rdtii,
    level: doc.level, lawNumber: doc.lawNumber, lastAmended: doc.lastAmended,
    coverage: doc.coverage, timeframe: doc.timeframe,
    locationReference: c.locationReference || undefined,
    mappingRationale: c.mappingRationale || undefined,
    discoveryTag,
    notes: c.notes || undefined,
    impactComments: c.impactComments || undefined,
    penalty: c.penalty || undefined,
    effectiveDate: c.effectiveDate || undefined,
    citation: c.citation || undefined,
    sourceQuote: c.sourceQuote ? c.sourceQuote.slice(0, 240) : undefined,
    confidence: typeof c.confidence === "number" ? c.confidence : undefined,
  };
}

async function callGemini(instrument: string, jurisdiction: string, text: string, hint?: ExtractHint): Promise<{ doc: RawDoc; clauses: RawClause[] }> {
  const key = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `You are a legal-data extraction engine for digital-trade & data-governance law.

First describe the DOCUMENT as a whole ("document"):
- "level": the legal hierarchy — one of ${JSON.stringify(LEGAL_LEVELS)}
- "lawNumber": the act/decree/law number if present (e.g. "Act 709", "R.A. 10173"), else null
- "lastAmended": when the instrument was LAST amended if stated (not when it started), else null
- "coverage": the sectoral/subject-matter scope — e.g. "Cross-cutting", "Telecommunications services", "Personal Health Data", "Financial sector" — else "Cross-cutting" if the instrument applies broadly
- "timeframe": the instrument's temporal scope as stated in the text, e.g. "Since 2023", "Since 1988, last amended in 2024", else null

Then extract the most important regulatory clauses as structured atoms (max 12). For each clause:
- "type": one of ${JSON.stringify(CLAUSE_TYPES)}
- "text": the rule in plain, precise terms (one sentence)
- "actor": who it binds (e.g. data controller, processor, individual, government) or null
- "indicators": 1-3 UN ESCAP RDTII indicator IDs this clause maps to (a clause may map to several — NOT mutually exclusive). Use ONLY IDs from the CATALOG below (verbatim, e.g. "P7-I2"). If none genuinely apply, use [].
- "citation": the section/article number (e.g. "Section 13"), else null
- "locationReference": a more precise location than the section — e.g. "Part II, paragraph 3(a)" or page — distinct from citation, else null
- "mappingRationale": one short sentence explaining WHY those indicators were assigned, else null
- "penalty": the sanction if stated, else null
- "effectiveDate": if stated, else null
- "sourceQuote": a SHORT verbatim quote (<=200 chars) from the document supporting this clause
- "notes": a brief analyst note if useful (e.g. ambiguity, cross-reference), else null
- "impactComments": one short sentence on the practical impact of this clause on cross-border digital trade or compliance (e.g. "Raises compliance cost for foreign processors" or "Narrow exception limits its restrictive effect"), else null
- "confidence": 0-1

Only extract clauses actually grounded in the DOCUMENT text. Do not invent. If boilerplate/navigation, return an empty clauses list.

RDTII INDICATOR CATALOG (id (Pillar): focus):
${INDICATOR_CATALOG}
${focusLine(hint)}
INSTRUMENT: ${instrument} (${jurisdiction})
DOCUMENT:
${text.slice(0, MAX_INPUT)}

Return ONLY JSON: {"document":{...},"clauses":[ ... ]}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  recordGeminiUsage(model, data);
  const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(raw); } catch { return { doc: {}, clauses: [] }; }
  const d = parsed.document ?? {};
  const doc: RawDoc = {
    level: LEGAL_LEVELS.includes(d.level) ? d.level : undefined,
    lawNumber: typeof d.lawNumber === "string" ? d.lawNumber : undefined,
    lastAmended: typeof d.lastAmended === "string" ? d.lastAmended : undefined,
    coverage: typeof d.coverage === "string" ? d.coverage : undefined,
    timeframe: typeof d.timeframe === "string" ? d.timeframe : undefined,
  };
  return { doc, clauses: Array.isArray(parsed.clauses) ? parsed.clauses : [] };
}

/** Extract clauses for one source, validate, persist, and return them. */
export async function extractSource(sourceId: string, opts: { refresh?: boolean; hint?: ExtractHint } = {}): Promise<{ sourceId: string; instrument: string; jurisdiction: string; count: number; clauses: StoredClause[] }> {
  const source = findSource(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  if (!extractorEnabled()) throw new Error("GEMINI_API_KEY not configured.");
  const refresh = opts.refresh !== false;

  const text = await getDocText(source);
  if (!text || text.length < 200) {
    return { sourceId, instrument: source.instrument, jurisdiction: source.jurisdiction, count: 0, clauses: [] };
  }

  const { doc, raw } = await extractWindows(source.instrument, source.jurisdiction, text, opts.hint);
  const meta = { sourceId, jurisdiction: source.jurisdiction, instrument: source.instrument, url: source.url };
  const clauses: StoredClause[] = dedupeClauses(
    raw
      .filter((c) => c && typeof c.text === "string" && CLAUSE_TYPES.includes(c.type))
      .map((c) => toStoredClause(c, meta, doc)),
  );

  // embed each clause so it becomes a high-precision retrieval unit for RAG
  if (clauses.length) {
    const embs = await embedTexts(clauses.map((c) => `${c.instrument}. ${c.text}`)).catch(() => [] as number[][]);
    clauses.forEach((c, i) => { if (embs[i]?.length) c.embedding = embs[i]; });
  }

  await saveClauses(sourceId, clauses);
  if (refresh) await loadClauseIndex().catch(() => {}); // refresh in-memory clause index
  return { sourceId, instrument: source.instrument, jurisdiction: source.jurisdiction, count: clauses.length, clauses };
}

/** Extract + embed + persist clauses from raw text (used for uploaded documents). */
export async function extractFromText(
  id: string, instrument: string, jurisdiction: string, url: string, text: string, hint?: ExtractHint,
): Promise<StoredClause[]> {
  if (!extractorEnabled()) throw new Error("GEMINI_API_KEY not configured.");
  if (!text || text.length < 120) return [];
  const { doc, raw } = await extractWindows(instrument, jurisdiction, text.slice(0, MAX_DOC), hint);
  const clauses: StoredClause[] = dedupeClauses(
    raw
      .filter((c) => c && typeof c.text === "string" && CLAUSE_TYPES.includes(c.type))
      .map((c) => toStoredClause(c, { sourceId: id, jurisdiction, instrument, url }, doc)),
  );
  if (clauses.length) {
    const embs = await embedTexts(clauses.map((c) => `${c.instrument}. ${c.text}`)).catch(() => [] as number[][]);
    clauses.forEach((c, i) => { if (embs[i]?.length) c.embedding = embs[i]; });
  }
  await saveClauses(id, clauses);
  await loadClauseIndex().catch(() => {});
  return clauses;
}

/**
 * Zone-1 input (P2-4): analyse an economy NOT in the surveyed corpus from a
 * user-supplied seed URL. Fetches + (optionally) translates the document, runs
 * pillar/indicator-hinted extraction, and persists the clauses under an ad-hoc id.
 */
export async function extractZone1(
  economy: string,
  url: string,
  opts: { instrument?: string; indicatorId?: string; pillarId?: number } = {},
): Promise<{ id: string; economy: string; instrument: string; url: string; authority: ReturnType<typeof classifyAuthority>; count: number; clauses: StoredClause[]; note?: string }> {
  if (!extractorEnabled()) throw new Error("GEMINI_API_KEY not configured.");
  let host = ""; try { host = new URL(url).hostname; } catch { throw new Error("Invalid seed URL."); }

  const id = `zone1-${economy.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
  const instrument = opts.instrument || `${economy} — ${host}`;
  const source: RegulationSource = {
    id, jurisdiction: economy, instrument, url,
    region: "Zone-1", format: /\.pdf(\?|#|$)/i.test(url) ? "pdf" : "html", cadence: "monthly",
  };
  const authority = classifyAuthority(url);
  const text = await getDocText(source);
  if (!text || text.length < 200) {
    return { id, economy, instrument, url, authority, count: 0, clauses: [], note: "Could not extract enough text from the seed URL (may be JS-rendered, blocked, or empty)." };
  }
  // Register the ad-hoc source so the clauses FK is satisfied. sources.url is UNIQUE
  // and this URL may already be surveyed (or re-submitted), so anchor the registry row
  // to the unique run id; the clauses themselves keep the real url.
  await upsertSources([{ ...source, url: `${url}#z1=${id}` }]);
  const hint: ExtractHint | undefined =
    opts.indicatorId ? { indicatorId: opts.indicatorId } : (opts.pillarId != null ? { pillarId: opts.pillarId } : undefined);
  const clauses = await extractFromText(id, instrument, economy, url, text, hint);
  return { id, economy, instrument, url, authority, count: clauses.length, clauses };
}

// ── batch extraction across the whole active corpus ───────────────────────────
interface BatchState { running: boolean; total: number; processed: number; clauses: number; errors: number; startedAt: number; finishedAt: number | null; }
let batch: BatchState = { running: false, total: 0, processed: 0, clauses: 0, errors: 0, startedAt: 0, finishedAt: null };

export function batchStatus(): BatchState { return { ...batch }; }

/** Extract clauses for every active source (bounded concurrency). Runs in the background. */
export async function extractAll(concurrency = 2): Promise<void> {
  if (batch.running) return;
  if (!healthReady()) await refreshHealth(loadSources());
  const active = activeUrlSet();
  const sources = loadSources().filter((s) => active.has(s.url));
  batch = { running: true, total: sources.length, processed: 0, clauses: 0, errors: 0, startedAt: Date.now(), finishedAt: null };

  let cursor = 0;
  const worker = async () => {
    while (cursor < sources.length) {
      const s = sources[cursor++];
      try {
        const r = await extractSource(s.id, { refresh: false });
        batch.clauses += r.count;
      } catch {
        batch.errors++;
      }
      batch.processed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, worker));
  await loadClauseIndex().catch(() => {}); // refresh once at the end
  batch.running = false;
  batch.finishedAt = Date.now();
  console.log(`[extract] batch done: ${batch.clauses} clauses from ${batch.processed} sources (${batch.errors} errors)`);
}