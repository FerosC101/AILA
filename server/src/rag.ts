// Retrieval-Augmented Generation over the live regulation corpus.
// Pipeline: scrape active sources → chunk → Gemini embeddings → in-memory vector
// index → cosine retrieval → grounded answer with real citations + confidence.

import * as cheerio from "cheerio";
import { fetchText, fetchPdfText } from "./scraper.js";
import { renderText, renderEnabled } from "./render.js";
import { loadSources } from "./sources.js";
import { activeUrlSet, healthReady, refreshHealth } from "./scanner.js";
import { saveChunks, loadAllChunks, getSourceEmbeddedAt, loadClauseEmbeddings, upsertSources, type StoredClause } from "./db.js";
import { ensureEnglish } from "./translate.js";
import { recordGeminiUsage } from "./cost.js";
import { searchWeb } from "./websearch.js";
import { findSourceByUrl } from "./sources.js";



const EMBED_MODEL = "gemini-embedding-001";
const GEN_MODEL = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_SOURCES = 30;       // bound startup cost
const PAGE_CHARS = 4000;      // text pulled per source
const CHUNK = 900, OVERLAP = 120;
// FIX 2: hard cap on how many chunks live in RAM at once.
// loadAllChunks() was an unbounded SELECT * that silently grew with the corpus.
// At ~12KB per chunk (3072 floats × 4 bytes) this cap keeps the index under ~24MB.
const MAX_INDEX_CHUNKS = 2_000;

interface Chunk {
  id: number;
  sourceId: string;
  jurisdiction: string;
  instrument: string;
  url: string;
  text: string;
  embedding: number[];
}

let INDEX: Chunk[] = [];
let CLAUSE_INDEX: StoredClause[] = [];   // high-precision clause-level retrieval units
let building = false;
let builtAt = 0;

export function ragStatus() {
  return { chunks: INDEX.length, clauses: CLAUSE_INDEX.length, building, builtAt, ready: INDEX.length > 0 && !building };
}

/** Embed arbitrary texts (used by the clause extractor). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  return embedBatch(texts);
}

/** Load embedded clauses into memory as retrieval units. */
export async function loadClauseIndex(): Promise<void> {
  CLAUSE_INDEX = (await loadClauseEmbeddings()).filter((c) => c.embedding && c.embedding.length > 0);
}

/**
 * On server start: restore the index from DB so RAG works immediately.
 *
 * FIX 2: Previously called loadAllChunks() with no limit — a SELECT * that dumps
 * the entire chunks table into RAM. As the corpus grows this silently OOMs the server.
 * Now bounded to MAX_INDEX_CHUNKS most-recent rows; older chunks stay in SQLite.
 */
export async function loadIndexFromDb(): Promise<void> {
  const stored = await loadAllChunks(MAX_INDEX_CHUNKS);
  if (!stored.length) return;
  INDEX = stored.map((c, i) => ({
    id: i,
    sourceId: c.sourceId,
    jurisdiction: c.jurisdiction,
    instrument: c.instrument,
    url: c.url,
    text: c.text,
    embedding: c.embedding,
  }));
  builtAt = Date.now();
  console.log(`RAG index restored from DB: ${INDEX.length} chunks (cap: ${MAX_INDEX_CHUNKS})`);
}

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY not configured.");
  return k;
}

// ---- Gemini embeddings (single embedContent, bounded concurrency) -----------
async function embedOne(text: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${key()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] } }),
    },
  );
  if (!res.ok) throw new Error(`Embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  recordGeminiUsage(EMBED_MODEL, data);
  return (data?.embedding?.values as number[]) ?? [];
}

async function embedBatch(texts: string[], concurrency = 3): Promise<number[][]> {
  const out = new Array<number[]>(texts.length).fill([]);
  let cursor = 0;

  const worker = async () => {
    while (cursor < texts.length) {
      const i = cursor++;
      try {
        out[i] = await embedOne(texts[i]);
      } catch (err: any) {
        // 429 rate limit — wait 10 seconds and retry once
        if (err?.message?.includes("429")) {
          console.log(`[RAG] Rate limited — waiting 10s before retry...`);
          await new Promise(r => setTimeout(r, 10_000));
          try {
            out[i] = await embedOne(texts[i]);
          } catch {
            out[i] = [];
          }
        } else {
          out[i] = [];
        }
      }
      // small delay between each request to stay under rate limit
      await new Promise(r => setTimeout(r, 500));
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, texts.length) }, worker));
  return out;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function chunkText(t: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < t.length && chunks.length < 6; i += CHUNK - OVERLAP) chunks.push(t.slice(i, i + CHUNK));
  return chunks;
}

async function pageText(url: string, format: string): Promise<string> {
  // PDFs: extract real text (clause-level evidence); HTML: cheerio body text.
  if (format === "pdf" || /\.pdf(\?|#|$)/i.test(url)) {
    const pdf = await fetchPdfText(url, 25000, PAGE_CHARS).catch(() => null);
    return pdf ?? "";
  }
  const html = await fetchText(url, 12000);
  let text = "";
  if (html) {
    const $ = cheerio.load(html);
    $("script, style, noscript, svg, header, footer, nav, form").remove();
    const root = $("main").length ? $("main") : $("body");
    text = root.text().replace(/\s+/g, " ").trim().slice(0, PAGE_CHARS);
  }
  // JS-rendered / WAF-shell pages return little text → try headless browser
  if (text.length < 300 && renderEnabled()) {
    const rendered = await renderText(url, 25000, PAGE_CHARS).catch(() => null);
    if (rendered && rendered.length > text.length) text = rendered;
  }
  return text;
}

// ---- index build -------------------------------------------------------------
export async function buildIndex(): Promise<{ chunks: number; sources: number }> {
  if (building) return { chunks: INDEX.length, sources: 0 };
  building = true;
  try {
    if (!healthReady()) await refreshHealth(loadSources());
    const active = activeUrlSet();
    const priority = ["Singapore", "Malaysia", "Philippines", "Thailand", "Indonesia", "Vietnam", "Australia"];
    const allActive = loadSources()
      .filter((s) => active.has(s.url))
      .sort((a, b) => {
        const ai = priority.indexOf(a.jurisdiction);
        const bi = priority.indexOf(b.jurisdiction);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      })
      .slice(0, MAX_SOURCES);
    // skip sources already embedded in the last 24 hours
    const sources = (await Promise.all(
      allActive.map(async s => {
        const embeddedAt = await getSourceEmbeddedAt(s.id);
        const ageMs = embeddedAt ? Date.now() - embeddedAt * 1000 : Infinity;
        return ageMs < 24 * 60 * 60 * 1000 ? null : s;
      })
    )).filter(Boolean) as typeof allActive;

    if (!sources.length) {
      console.log("All sources already embedded — loading from DB");
      await loadIndexFromDb();
      return { chunks: INDEX.length, sources: 0 };
    }

    // fetch page text with bounded concurrency
    const texts = new Array<string>(sources.length).fill("");
    let cursor = 0;
    const worker = async () => {
      while (cursor < sources.length) {
        const idx = cursor++;
        const raw = await pageText(sources[idx].url, sources[idx].format).catch(() => "");
        texts[idx] = await ensureEnglish(raw, sources[idx].id, sources[idx].jurisdiction).catch(() => raw);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));

    const chunks: Chunk[] = [];
    sources.forEach((s, i) => {
      const body = texts[i];
      const pieces = body ? chunkText(body) : [s.instrument];
      for (const piece of pieces) {
        chunks.push({
          id: chunks.length, sourceId: s.id, jurisdiction: s.jurisdiction, instrument: s.instrument,
          url: s.url, text: `${s.instrument} (${s.jurisdiction}). ${piece}`, embedding: [],
        });
      }
    });

    const embeds = await embedBatch(chunks.map((c) => c.text));
    chunks.forEach((c, i) => { c.embedding = embeds[i] ?? []; });
    INDEX = chunks.filter((c) => c.embedding.length);
    builtAt = Date.now();

    // persist chunks to DB grouped by source
    const bySource = new Map<string, typeof INDEX>();
    for (const c of INDEX) {
      if (!bySource.has(c.sourceId)) bySource.set(c.sourceId, []);
      bySource.get(c.sourceId)!.push(c);
    }
    for (const [sourceId, sourceChunks] of bySource) {
      await saveChunks(sourceId, sourceChunks.map(c => ({
        text: c.text,
        embedding: c.embedding,
        jurisdiction: c.jurisdiction,
        instrument: c.instrument,
        url: c.url,
      })));
    }
    console.log(`RAG index saved to DB: ${INDEX.length} chunks`);

    return { chunks: INDEX.length, sources: sources.length };
  } finally {
    building = false;
  }
}

// ---- query -------------------------------------------------------------------
export interface RagCitation { n: number; instrument: string; jurisdiction: string; url: string; score: number; snippet: string; live?: boolean }
export interface RagKeyPoint { heading: string; detail: string; citations: number[] }
export interface RagResult {
  question: string;
  answer: string;              // plain-text summary (back-compat + eval)
  summary: string;             // direct answer, 2-3 sentences
  verdict: string;             // short label e.g. "Permitted with conditions"
  keyPoints: RagKeyPoint[];    // obligations / conditions, each cited
  risks: string[];
  recommendations: string[];
  confidence: number;          // 0..1, self-reflective (retrieval × model)
  grounded: boolean;
  citations: RagCitation[];
  retrieved: number;
  sourcesAdded?: number;       // sources scraped live from the web and added to the corpus
}

interface RetrievedItem {
  instrument: string; jurisdiction: string; url: string; text: string;
  citation?: string; sourceQuote?: string; kind: "chunk" | "clause" | "live"; score: number;
}

const LIVE_THRESHOLD = 0.62;   // below this top score, trigger live web retrieval

// ASEAN+ jurisdictions we can name-match from a question (for nicer live citations).
const KNOWN_JURISDICTIONS = ["Singapore", "Malaysia", "Thailand", "Vietnam", "Indonesia", "Philippines",
  "Cambodia", "Laos", "Myanmar", "Brunei", "Timor-Leste", "Australia", "China", "Japan", "Korea", "India"];

function guessJurisdiction(question: string, url: string): string {
  const q = question.toLowerCase();
  const hit = KNOWN_JURISDICTIONS.find((j) => q.includes(j.toLowerCase()));
  if (hit) return hit;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Web"; }
}

/** Derive a readable instrument title from a page (HTML <title>) or URL basename. */
function titleFor(html: string | null, url: string): string {
  if (html) {
    const $ = cheerio.load(html);
    const t = ($('meta[property="og:title"]').attr("content") || $("title").first().text() || "").replace(/\s+/g, " ").trim();
    if (t) return t.slice(0, 120);
  }
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean).pop() || new URL(url).hostname;
    return decodeURIComponent(seg).replace(/[-_]+/g, " ").replace(/\.[a-z]+$/i, "").slice(0, 120) || url;
  } catch { return url; }
}

/**
 * Live web retrieval: search → scrape top authority-ranked results → embed →
 * persist to the corpus (so future queries benefit) → return retrieval items.
 */
async function liveRetrieve(question: string, qEmb: number[]): Promise<{ items: RetrievedItem[]; sourcesAdded: number }> {
  const urls = (await searchWeb(`${question} regulation law official`, 6))
    .filter((u) => !findSourceByUrl(u))   // skip URLs already in the corpus
    .slice(0, 3);
  const items: RetrievedItem[] = [];
  let added = 0;

  for (const url of urls) {
    try {
      const isPdf = /\.pdf(\?|#|$)/i.test(url);
      let html: string | null = null;
      let text = "";
      if (isPdf) {
        text = (await fetchPdfText(url, 25_000, PAGE_CHARS).catch(() => null)) ?? "";
      } else {
        html = await fetchText(url, 12_000).catch(() => null);
        if (html) {
          const $ = cheerio.load(html);
          $("script, style, noscript, svg, header, footer, nav, form").remove();
          text = ($("main").length ? $("main") : $("body")).text().replace(/\s+/g, " ").trim().slice(0, PAGE_CHARS);
        }
      }
      if (!text || text.length < 200) continue;

      const sourceId = `live-${Buffer.from(url).toString("base64url").slice(0, 32)}`;
      const jurisdiction = guessJurisdiction(question, url);
      const instrument = titleFor(html, url);
      text = await ensureEnglish(text, sourceId, jurisdiction);

      const parts = chunkText(text);
      const embs = await embedBatch(parts);
      const chunks = parts
        .map((t, i) => ({ text: t, embedding: embs[i] ?? [] }))
        .filter((c) => c.embedding.length);
      if (!chunks.length) continue;

      // retrieval items for this query
      for (const c of chunks) items.push({ instrument, jurisdiction, url, text: c.text, kind: "live", score: cosine(qEmb, c.embedding) });

      // persist to the corpus permanently
      await upsertSources([{ id: sourceId, jurisdiction, instrument, url, region: "Live", format: isPdf ? "pdf" : "html", cadence: "monthly" }]);
      await saveChunks(sourceId, chunks.map((c) => ({ text: c.text, embedding: c.embedding, jurisdiction, instrument, url })));
      for (const c of chunks) INDEX.push({ id: Date.now() + INDEX.length, sourceId, jurisdiction, instrument, url, text: c.text, embedding: c.embedding });
      added++;
    } catch { /* skip this URL */ }
  }
  return { items, sourcesAdded: added };
}

/** Generate a grounded answer over a ranked set of retrieved items. */
async function answerFrom(question: string, ranked: RetrievedItem[], priorFindings?: string): Promise<RagResult> {
  const topScore = ranked[0]?.score ?? 0;
  const priorBlock = priorFindings
    ? `PRIOR FINDINGS FROM THIS CONVERSATION (reuse and reference where relevant):\n${priorFindings}\n\n`
    : "";
  const context = ranked
    .map((r, i) => `[${i + 1}] ${r.instrument} — ${r.jurisdiction}${r.citation ? ` (${r.citation})` : ""}\nURL: ${r.url}\n${r.sourceQuote || r.text}`)
    .join("\n\n");

  const prompt = `You are AILA, a digital-trade regulatory analyst. Answer the QUESTION using ONLY the CONTEXT excerpts.
Produce a structured, practical brief for a business reader. Ground every claim in the excerpts and cite with bracketed numbers like [1], [2].
If the context is insufficient, say so in "summary", keep arrays short/empty, set verdict "Unclear from sources", and set a low confidence — do NOT invent rules.

Return ONLY JSON of this shape:
{
  "summary": "<2-3 sentence direct answer to the question, with [n] citations>",
  "verdict": "<one short label: Permitted | Permitted with conditions | Restricted | Prohibited | Unclear from sources>",
  "keyPoints": [ {"heading":"<short obligation/condition>","detail":"<1 sentence, with [n]>","citations":[<numbers>]} ],
  "risks": ["<concrete risk or exposure, with [n] where possible>"],
  "recommendations": ["<actionable step>"],
  "confidence": <0-1>,
  "citations": [<all excerpt numbers used>]
}
Keep keyPoints to 2-5, risks and recommendations to 0-4 each.

QUESTION: ${question}

${priorBlock}CONTEXT:
${context}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEN_MODEL()}:generateContent?key=${key()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  recordGeminiUsage(GEN_MODEL(), data);
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch { parsed = { summary: text, confidence: 0.4, citations: [] }; }

  const used: number[] = Array.isArray(parsed.citations) ? parsed.citations : [];
  const citations: RagCitation[] = (used.length ? used : ranked.map((_, i) => i + 1))
    .map((n) => ranked[n - 1])
    .filter(Boolean)
    .map((r, i) => ({
      n: i + 1,
      instrument: r.citation ? `${r.instrument} · ${r.citation}` : r.instrument,
      jurisdiction: r.jurisdiction, url: r.url,
      score: Number(Math.min(1, r.score).toFixed(3)),
      snippet: (r.sourceQuote || r.text).replace(`${r.instrument} (${r.jurisdiction}). `, "").slice(0, 240).trim() + "…",
      live: r.kind === "live",
    }));

  const modelConf = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
  // self-reflective: discount when retrieval is weak
  const confidence = Number((modelConf * (0.45 + 0.55 * Math.min(1, topScore / 0.8))).toFixed(2));

  const str = (v: any, fb = "") => (typeof v === "string" ? v : fb);
  const strArr = (v: any) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 4) : []);
  const summary = str(parsed.summary, "I could not find enough in the corpus to answer this confidently.");
  const keyPoints: RagKeyPoint[] = Array.isArray(parsed.keyPoints)
    ? parsed.keyPoints
        .filter((p: any) => p && typeof p.heading === "string")
        .slice(0, 5)
        .map((p: any) => ({
          heading: str(p.heading),
          detail: str(p.detail),
          citations: Array.isArray(p.citations) ? p.citations.filter((n: any) => typeof n === "number") : [],
        }))
    : [];

  return {
    question,
    answer: summary,
    summary,
    verdict: str(parsed.verdict, "Unclear from sources"),
    keyPoints,
    risks: strArr(parsed.risks),
    recommendations: strArr(parsed.recommendations),
    confidence,
    grounded: topScore > 0.45 && citations.length > 0,
    citations,
    retrieved: ranked.length,
  };
}

export async function ragQuery(
  question: string,
  opts: { k?: number; live?: boolean; priorFindings?: string } = {},
): Promise<RagResult> {
  const k = opts.k ?? 6;
  if (!INDEX.length) await loadIndexFromDb();   // prefer the persisted index
  if (!INDEX.length) await buildIndex();         // only embed from scratch if DB is empty
  if (!CLAUSE_INDEX.length) await loadClauseIndex(); // high-precision clause units
  const [qEmb] = await embedBatch([question]);

  const chunkItems: RetrievedItem[] = INDEX.map((c) => ({
    instrument: c.instrument, jurisdiction: c.jurisdiction, url: c.url, text: c.text,
    kind: "chunk", score: cosine(qEmb, c.embedding),
  }));
  // clauses are precise + already cited → small ranking boost
  const clauseItems: RetrievedItem[] = CLAUSE_INDEX.map((c) => ({
    instrument: c.instrument, jurisdiction: c.jurisdiction, url: c.url,
    text: c.text, citation: c.citation, sourceQuote: c.sourceQuote,
    kind: "clause", score: cosine(qEmb, c.embedding!) * 1.07,
  }));

  const corpusRanked = [...chunkItems, ...clauseItems].sort((a, b) => b.score - a.score).slice(0, k);

  // First pass over the local corpus.
  let result = await answerFrom(question, corpusRanked, opts.priorFindings);
  let sourcesAdded = 0;

  // Decide whether to go to the web: forced on, or (auto) the corpus answer is weak.
  const weak = result.confidence < 0.45 || !result.grounded || /unclear/i.test(result.verdict);
  const goLive = opts.live === true || (opts.live !== false && weak);
  if (goLive) {
    const live = await liveRetrieve(question, qEmb).catch(() => ({ items: [], sourcesAdded: 0 }));
    sourcesAdded = live.sourcesAdded;
    if (live.items.length) {
      const merged = [...chunkItems, ...clauseItems, ...live.items].sort((a, b) => b.score - a.score).slice(0, k);
      const liveResult = await answerFrom(question, merged, opts.priorFindings);
      // keep whichever answer is more confident (live usually wins when it found real material)
      if (liveResult.confidence >= result.confidence) result = liveResult;
    }
  }

  return { ...result, sourcesAdded };
}