// Clause-level extraction — turns a regulation's text into structured
// "regulatory atoms" (obligation / restriction / exception / penalty / right /
// definition) with the verbatim source quote used as evidence, RDTII tags, and
// a citation reference. Persisted to the `clauses` table.

import * as cheerio from "cheerio";
import { fetchText, fetchPdfText } from "./scraper.js";
import { renderText, renderEnabled } from "./render.js";
import { ensureEnglish } from "./translate.js";
import { RDTII_CATEGORIES } from "./classify.js";
import { findSource, loadSources } from "./sources.js";
import { activeUrlSet, healthReady, refreshHealth } from "./scanner.js";
import { saveClauses, type StoredClause } from "./db.js";
import { embedTexts, loadClauseIndex } from "./rag.js";
import type { RegulationSource } from "./types.js";

const RDTII_NAMES = RDTII_CATEGORIES.map((c) => c.name);
const CLAUSE_TYPES = ["obligation", "restriction", "exception", "penalty", "right", "definition"];
const MAX_INPUT = 7000;

export function extractorEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/** Pull (and translate) the document body for a source. */
async function getDocText(source: RegulationSource): Promise<string> {
  let text = "";
  if (source.format === "pdf" || /\.pdf(\?|#|$)/i.test(source.url)) {
    text = (await fetchPdfText(source.url, 25000, MAX_INPUT).catch(() => null)) ?? "";
  } else {
    const html = await fetchText(source.url, 12000);
    if (html) {
      const $ = cheerio.load(html);
      $("script, style, noscript, svg, header, footer, nav, form").remove();
      text = ($("main").length ? $("main") : $("body")).text().replace(/\s+/g, " ").trim().slice(0, MAX_INPUT);
    }
    if (text.length < 300 && renderEnabled()) {
      const rendered = await renderText(source.url, 25000, MAX_INPUT).catch(() => null);
      if (rendered && rendered.length > text.length) text = rendered;
    }
  }
  if (!text) return "";
  return ensureEnglish(text, source.id, source.jurisdiction);
}

interface RawClause {
  type: string; text: string; actor?: string; rdtii?: string[];
  penalty?: string; effectiveDate?: string; citation?: string; sourceQuote?: string; confidence?: number;
}

async function callGemini(instrument: string, jurisdiction: string, text: string): Promise<RawClause[]> {
  const key = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `You are a legal-data extraction engine for digital-trade & data-governance law.
From the DOCUMENT, extract the most important regulatory clauses as structured atoms (max 12).
For each clause:
- "type": one of ${JSON.stringify(CLAUSE_TYPES)}
- "text": the rule in plain, precise terms (one sentence)
- "actor": who it binds (e.g. data controller, processor, individual, government) or null
- "rdtii": 1-2 categories, ONLY from ${JSON.stringify(RDTII_NAMES)}
- "penalty": the sanction if stated, else null
- "effectiveDate": if stated, else null
- "citation": the section/article/paragraph reference if present (e.g. "Section 13"), else null
- "sourceQuote": a SHORT verbatim quote (<=200 chars) from the document that supports this clause
- "confidence": 0-1

Only extract clauses actually grounded in the DOCUMENT text. Do not invent. If the text is navigation/boilerplate with no legal content, return [].

INSTRUMENT: ${instrument} (${jurisdiction})
DOCUMENT:
${text.slice(0, MAX_INPUT)}

Return ONLY JSON: {"clauses":[ ... ]}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(raw); } catch { return []; }
  return Array.isArray(parsed.clauses) ? parsed.clauses : [];
}

/** Extract clauses for one source, validate, persist, and return them. */
export async function extractSource(sourceId: string, opts: { refresh?: boolean } = {}): Promise<{ sourceId: string; instrument: string; jurisdiction: string; count: number; clauses: StoredClause[] }> {
  const source = findSource(sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  if (!extractorEnabled()) throw new Error("GEMINI_API_KEY not configured.");
  const refresh = opts.refresh !== false;

  const text = await getDocText(source);
  if (!text || text.length < 200) {
    return { sourceId, instrument: source.instrument, jurisdiction: source.jurisdiction, count: 0, clauses: [] };
  }

  const raw = await callGemini(source.instrument, source.jurisdiction, text);
  const clauses: StoredClause[] = raw
    .filter((c) => c && typeof c.text === "string" && CLAUSE_TYPES.includes(c.type))
    .slice(0, 12)
    .map((c) => ({
      sourceId, jurisdiction: source.jurisdiction, instrument: source.instrument, url: source.url,
      type: c.type, text: c.text.trim(),
      actor: c.actor || undefined,
      rdtii: (c.rdtii ?? []).filter((n) => RDTII_NAMES.includes(n)),
      penalty: c.penalty || undefined,
      effectiveDate: c.effectiveDate || undefined,
      citation: c.citation || undefined,
      sourceQuote: c.sourceQuote ? c.sourceQuote.slice(0, 240) : undefined,
      confidence: typeof c.confidence === "number" ? c.confidence : undefined,
    }));

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
  id: string, instrument: string, jurisdiction: string, url: string, text: string,
): Promise<StoredClause[]> {
  if (!extractorEnabled()) throw new Error("GEMINI_API_KEY not configured.");
  if (!text || text.length < 120) return [];
  const raw = await callGemini(instrument, jurisdiction, text);
  const clauses: StoredClause[] = raw
    .filter((c) => c && typeof c.text === "string" && CLAUSE_TYPES.includes(c.type))
    .slice(0, 12)
    .map((c) => ({
      sourceId: id, jurisdiction, instrument, url,
      type: c.type, text: c.text.trim(), actor: c.actor || undefined,
      rdtii: (c.rdtii ?? []).filter((n) => RDTII_NAMES.includes(n)),
      penalty: c.penalty || undefined, effectiveDate: c.effectiveDate || undefined,
      citation: c.citation || undefined,
      sourceQuote: c.sourceQuote ? c.sourceQuote.slice(0, 240) : undefined,
      confidence: typeof c.confidence === "number" ? c.confidence : undefined,
    }));
  if (clauses.length) {
    const embs = await embedTexts(clauses.map((c) => `${c.instrument}. ${c.text}`)).catch(() => [] as number[][]);
    clauses.forEach((c, i) => { if (embs[i]?.length) c.embedding = embs[i]; });
  }
  await saveClauses(id, clauses);
  await loadClauseIndex().catch(() => {});
  return clauses;
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
