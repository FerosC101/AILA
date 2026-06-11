// Retrieval-Augmented Generation over the live regulation corpus.
// Pipeline: scrape active sources → chunk → Gemini embeddings → in-memory vector
// index → cosine retrieval → grounded answer with real citations + confidence.

import * as cheerio from "cheerio";
import { fetchText, fetchPdfText } from "./scraper.js";
import { loadSources } from "./sources.js";
import { activeUrlSet, healthReady, refreshHealth } from "./scanner.js";
import { saveChunks, loadAllChunks, getSourceEmbeddedAt } from "./db.js";


const EMBED_MODEL = "gemini-embedding-001";
const GEN_MODEL = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_SOURCES = 30;     // bound startup cost
const PAGE_CHARS = 4000;    // text pulled per source
const CHUNK = 900, OVERLAP = 120;

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
let building = false;
let builtAt = 0;

export function ragStatus() {
  return { chunks: INDEX.length, building, builtAt, ready: INDEX.length > 0 && !building };
}

/** On server start: restore the index from DB so RAG works immediately. */
export async function loadIndexFromDb(): Promise<void> {
  const stored = await loadAllChunks();
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
  console.log(`RAG index restored from DB: ${INDEX.length} chunks`);
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
  return (data?.embedding?.values as number[]) ?? [];
}

async function embedBatch(texts: string[], concurrency = 8): Promise<number[][]> {
  const out = new Array<number[]>(texts.length).fill([]);
  let cursor = 0;
  const worker = async () => {
    while (cursor < texts.length) {
      const i = cursor++;
      out[i] = await embedOne(texts[i]);
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
  if (!html) return "";
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, header, footer, nav, form").remove();
  const root = $("main").length ? $("main") : $("body");
  return root.text().replace(/\s+/g, " ").trim().slice(0, PAGE_CHARS);
}

// ---- index build -------------------------------------------------------------
export async function buildIndex(): Promise<{ chunks: number; sources: number }> {
  if (building) return { chunks: INDEX.length, sources: 0 };
  building = true;
  try {
    if (!healthReady()) await refreshHealth(loadSources());
    const active = activeUrlSet();
    const allActive = loadSources().filter((s) => active.has(s.url)).slice(0, MAX_SOURCES);
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
        texts[idx] = await pageText(sources[idx].url, sources[idx].format).catch(() => "");
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
export interface RagCitation { n: number; instrument: string; jurisdiction: string; url: string; score: number; snippet: string }
export interface RagResult {
  question: string;
  answer: string;
  confidence: number;          // 0..1, self-reflective (retrieval × model)
  grounded: boolean;
  citations: RagCitation[];
  retrieved: number;
}

export async function ragQuery(question: string, k = 6): Promise<RagResult> {
  if (!INDEX.length) await buildIndex();
  const [qEmb] = await embedBatch([question]);

  const ranked = INDEX
    .map((c) => ({ c, score: cosine(qEmb, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  const topScore = ranked[0]?.score ?? 0;
  const context = ranked
    .map((r, i) => `[${i + 1}] ${r.c.instrument} — ${r.c.jurisdiction}\nURL: ${r.c.url}\n${r.c.text}`)
    .join("\n\n");

  const prompt = `You are AILA, a digital-trade regulatory analyst. Answer the QUESTION using ONLY the CONTEXT excerpts.
Rules:
- Cite the excerpts you rely on with bracketed numbers like [1], [2].
- If the context is insufficient, say so plainly and set confidence low — do NOT invent rules.
- Be concise (3-5 sentences), neutral, and practical for a business reader.

Return ONLY JSON: {"answer":"<text with [n] citations>","confidence":<0-1>,"citations":[<numbers used>]}

QUESTION: ${question}

CONTEXT:
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
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch { parsed = { answer: text, confidence: 0.4, citations: [] }; }

  const used: number[] = Array.isArray(parsed.citations) ? parsed.citations : [];
  const citations: RagCitation[] = (used.length ? used : ranked.map((_, i) => i + 1))
    .map((n) => ranked[n - 1])
    .filter(Boolean)
    .map((r, i) => ({
      n: i + 1, instrument: r.c.instrument, jurisdiction: r.c.jurisdiction, url: r.c.url,
      score: Number(r.score.toFixed(3)),
      snippet: r.c.text.replace(`${r.c.instrument} (${r.c.jurisdiction}). `, "").slice(0, 240).trim() + "…",
    }));

  const modelConf = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
  // self-reflective: discount when retrieval is weak
  const confidence = Number((modelConf * (0.45 + 0.55 * Math.min(1, topScore / 0.8))).toFixed(2));

  return {
    question,
    answer: typeof parsed.answer === "string" ? parsed.answer : "I could not find enough in the corpus to answer confidently.",
    confidence,
    grounded: topScore > 0.45 && citations.length > 0,
    citations,
    retrieved: ranked.length,
  };
}
