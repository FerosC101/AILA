// AILA v5 — provision validation engine. For a seed Round-1 database row it:
//   discover official source (live) → fetch/translate → extract exact provisions →
//   classify VERIFIED / UPDATED / NEW / INVALID → map to RDTII indicators → persist.
// See docs/AILA-v5-methodology.md. This is the "validate-and-discover" pipeline,
// distinct from the document-atom clause extraction in extract.ts.

import * as cheerio from "cheerio";
import { fetchText, fetchPdfText, fetchWaybackSnapshot } from "./scraper.js";
import { ensureEnglish } from "./translate.js";
import { searchWeb } from "./websearch.js";
import { classifyAuthority } from "./authority.js";
import { RDTII_INDICATORS, isIndicatorId, findIndicator } from "./indicators.js";
import { recordGeminiUsage } from "./cost.js";
import { saveValidations, crossRefClauseFields, type ValidationRow, type DiscoveryTag } from "./db.js";

const INDICATOR_CATALOG = RDTII_INDICATORS.map((i) => `${i.id} (P${i.pillarId} ${i.pillar}): ${i.focus}`).join("\n");
const TAGS: DiscoveryTag[] = ["VERIFIED", "UPDATED", "NEW", "INVALID"];
const MAX_SOURCES = 3;         // official candidates fetched per seed row
const TEXT_PER_SOURCE = 8000;  // chars kept per source
const MAX_PROVISIONS = 12;

export interface SeedRow {
  dbRow?: string | number;
  economy: string;
  lawName?: string;
  lawNumber?: string;
  lastAmended?: string; 
  coverage?: string; 
  timeframe?: string;
  indicators?: string[];
  pillar?: string;
  context?: string;
  seedUrl?: string;
}

export function validatorEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

const rowRef = (s: SeedRow): string | undefined =>
  s.dbRow == null ? undefined : (String(s.dbRow).toLowerCase().startsWith("db row") ? String(s.dbRow) : `DB Row ${s.dbRow}`);

// Primary portals that refuse automated crawlers (per the Round-1 submission's own flags).
const BOT_BLOCKED = /legislation\.gov\.au|lom\.agc\.gov\.my|federalgazette\.agc\.gov\.my|(^|\.)agc\.gov\.my/i;

/** Extract raw text from a single URL (PDF via unpdf, HTML via cheerio). */
async function extractAt(url: string): Promise<string> {
  const isPdf = /\.pdf(\?|#|$)/i.test(url);
  if (isPdf) return (await fetchPdfText(url, 25_000, TEXT_PER_SOURCE).catch(() => null)) ?? "";
  const html = await fetchText(url, 12_000).catch(() => null);
  if (!html) return "";
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, header, footer, nav, form").remove();
  return ($("main").length ? $("main") : $("body")).text().replace(/\s+/g, " ").trim().slice(0, TEXT_PER_SOURCE);
}

/**
 * Pull clean text from a URL, translated to English — with a BOT-BLOCK BYPASS:
 * bot-walled primary portals (legislation.gov.au, AGC) are re-fetched through the
 * Internet Archive snapshot, which serves the original page without the crawler wall.
 */
async function sourceText(url: string, economy: string): Promise<string> {
  let text = await extractAt(url).catch(() => "");
  if (text.length < 800 || BOT_BLOCKED.test(url)) {
    const snap = await fetchWaybackSnapshot(url).catch(() => null);
    if (snap) {
      const archived = await extractAt(snap.url).catch(() => "");
      if (archived.length > text.length) text = archived; // keep the richer of direct vs archived
    }
  }
  if (!text || text.length < 200) return "";
  return ensureEnglish(text, `val-${Buffer.from(url).toString("base64url").slice(0, 16)}`, economy);
}

/** Discover official candidate URLs for a seed row (seed URL first, then authority-ranked search). */
async function discoverSources(seed: SeedRow): Promise<string[]> {
  const focus = (seed.indicators ?? []).map((id) => findIndicator(id)?.focus).filter(Boolean).join(" ");
  const query = [seed.economy, seed.lawName, seed.lawNumber, focus || seed.context, "official legislation act section"]
    .filter(Boolean).join(" ");
  const found = await searchWeb(query, 8).catch(() => [] as string[]);
  const ranked = [...new Set([...(seed.seedUrl ? [seed.seedUrl] : []), ...found])]
    // official/primary first (searchWeb already ranks, but keep the seed URL honest too)
    .sort((a, b) => (classifyAuthority(a).tier === "primary" ? 0 : 1) - (classifyAuthority(b).tier === "primary" ? 0 : 1));
  return ranked.slice(0, MAX_SOURCES);
}

async function callGemini(seed: SeedRow, sources: { url: string; text: string }[]): Promise<any[]> {
  const key = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const { SOURCE_HIERARCHY, NO_FABRICATION, INDICATOR_RULES, DISCOVERY_TAGS } = await import("./prompts.js");

  const seedBlock = `SEED DATABASE ROW (context only — NOT authoritative):
- Economy: ${seed.economy}
- Law (as in DB): ${seed.lawName ?? "—"} ${seed.lawNumber ? `(${seed.lawNumber})` : ""}
- Last Amended (as in DB, verify — do not trust blindly): ${seed.lastAmended ?? "—"}
- Coverage (as in DB): ${seed.coverage ?? "—"}
- Indicator(s) to test: ${(seed.indicators ?? []).join(", ") || "—"}
- Pillar/topic: ${seed.pillar ?? "—"}
- Context/notes: ${seed.context ?? "—"}`;

  const srcBlock = sources.map((s, i) => `[S${i + 1}] ${s.url}\n${s.text}`).join("\n\n");

  const prompt = `You are AILA, an autonomous legal validation engine for digital-trade & data-governance law.
Validate the SEED ROW against the OFFICIAL SOURCES and extract the exact provision(s) that satisfy the indicator(s).

${NO_FABRICATION}
${SOURCE_HIERARCHY}
${INDICATOR_RULES}
${DISCOVERY_TAGS}

For each relevant provision return an object:
- "lawName": official title of the law
- "lawNumber": act/decree/gazette number if present, else null
- "lastAmended": latest amendment in force if stated, else null
- "indicatorId": ONE RDTII id (P#-I#) from the catalog it maps to
- "articleSection": exact citation (e.g. "s. 129(2)", "APP 8, cl. 8.1")
- "discoveryTag": one of ${JSON.stringify(TAGS)} (classify vs the seed)
- "verbatim": EXACT statutory text from a source (<=400 chars); "" if not officially retrieved
- "mappingRationale": <=300 chars, "This [section] requires/prohibits/… Maps to Indicator X because…"
- "sourceIndex": the [S#] number the provision came from (1-based), or null
- "confidence": 0-1 (High≈0.85+, Medium≈0.5-0.85, Low<0.5)
- "notes": validation findings, amendment/version discrepancies, or why text couldn't be retrieved
- "coverage": the instrument's sectoral/subject-matter scope — e.g. "Cross-cutting", "Telecommunications services", "Personal Health Data", "Financial sector" — else "Cross-cutting" if it applies broadly
- "timeframe": the instrument's temporal scope as stated in the source, e.g. "Since 2023", "Since 1988, last amended in 2024", else null
- "impactComments": one short sentence on the practical impact of this provision on cross-border digital trade or compliance (e.g. "Raises compliance cost for foreign processors"), else null

Extract up to ${MAX_PROVISIONS}. A provision mapping to several indicators → one object per indicator.
Do NOT use INVALID merely because exact verbatim text could not be retrieved — use INVALID ONLY when there is positive evidence the seed law/section is repealed, superseded, or mis-cited. If the law is confirmed to exist and apply but you could not pin the exact section text, use VERIFIED (or UPDATED) with LOWER confidence and a Notes flag, and leave verbatim "".
If NO statutory text is available at all, return a single object with verbatim "", low confidence, and a Notes flag — do NOT invent text and do NOT assert INVALID.

RDTII INDICATOR CATALOG:
${INDICATOR_CATALOG}

${seedBlock}

OFFICIAL SOURCES:
${srcBlock || "(no source text retrieved)"}

Return ONLY JSON: {"provisions":[ ... ]}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  recordGeminiUsage(model, data);
  try { return JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}").provisions ?? []; }
  catch { return []; }
}

/**
 * Locate the verbatim in the source text and return the surrounding window (HITL review
 * context). Returns undefined when the snippet can't be located — honest null beats page chrome.
 */
function contextAround(text: string, verbatim: string, window = 240): string | undefined {
  if (!text || verbatim.length < 12) return undefined;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
  const hay = norm(text);
  // try progressively shorter leading probes so light reformatting still matches
  for (const len of [60, 40, 25]) {
    const probe = norm(verbatim).slice(0, len).trim();
    const idx = hay.indexOf(probe);
    if (idx >= 0) return text.slice(Math.max(0, idx - window), Math.min(text.length, idx + verbatim.length + window)).replace(/\s+/g, " ").trim();
  }
  return undefined; // couldn't locate — leave null rather than emit navigation boilerplate
}

/** Validate one seed row → persisted ValidationRow[] (one per provision). */
export async function validateSeedRow(seed: SeedRow, opts: { persist?: boolean } = {}): Promise<ValidationRow[]> {
  if (!validatorEnabled()) throw new Error("GEMINI_API_KEY not configured.");
  const dbRow = rowRef(seed);
  const t0 = Date.now();

  const urls = await discoverSources(seed);
  const sources: { url: string; text: string }[] = [];
  for (const url of urls) {
    const text = await sourceText(url, seed.economy).catch(() => "");
    if (text) sources.push({ url, text });
  }

  let rows: ValidationRow[] = [];
  if (!sources.length) {
    rows = (seed.indicators?.length ? seed.indicators : [undefined]).map((ind) => ({
      dbRow, economy: seed.economy, lawName: seed.lawName, lawNumber: seed.lawNumber,
      indicatorId: ind, discoveryTag: undefined, verbatim: "",
      mappingRationale: undefined, sourceUrl: seed.seedUrl, confidence: 0.2,
      notes: "Flagged, not populated — no official source retrievable this session (portal block / dead link). Needs manual fetch.",
      seed,
      lastAmended: seed.lastAmended || undefined,
      coverage: seed.coverage || seed.context || undefined,
      timeframe: seed.timeframe || undefined,
    }));
  } else {
    const provisions = await callGemini(seed, sources);
    rows = provisions
      .filter((p: any) => p && typeof p === "object")
      .slice(0, MAX_PROVISIONS)
      .map((p: any) => {
        const indicatorId = isIndicatorId(p.indicatorId) ? p.indicatorId : (seed.indicators?.[0] && isIndicatorId(seed.indicators[0]) ? seed.indicators[0] : undefined);
        const si = Number(p.sourceIndex);
        const sourceUrl = Number.isFinite(si) && sources[si - 1] ? sources[si - 1].url : sources[0].url;
        const verbatim = typeof p.verbatim === "string" ? p.verbatim.slice(0, 400) : "";
        let notes: string | undefined = typeof p.notes === "string" ? p.notes : undefined;
        let tag: DiscoveryTag | undefined = TAGS.includes(p.discoveryTag) ? p.discoveryTag : "NEW";
        // Guard: INVALID is a strong claim — require positive evidence (repeal/supersede/mis-cite),
        // not mere inability to pin verbatim text. Otherwise flag it, don't assert INVALID.
        if (tag === "INVALID" && !verbatim && !/repeal|supersed|replac|obsolete|no longer|revok|not (in force|current)/i.test(notes ?? "")) {
          tag = undefined;
          notes = `Could not confirm the exact provision from an official source this session — flagged for manual verification. ${notes ?? ""}`.trim();
        }
        const srcText = sources.find((s) => s.url === sourceUrl)?.text ?? sources[0]?.text ?? "";
        return {
          dbRow, economy: seed.economy,
          lawName: typeof p.lawName === "string" && p.lawName ? p.lawName : seed.lawName,
          lawNumber: typeof p.lawNumber === "string" ? p.lawNumber : seed.lawNumber,
          lastAmended: typeof p.lastAmended === "string" ? p.lastAmended : undefined,
          indicatorId, articleSection: typeof p.articleSection === "string" ? p.articleSection : undefined,
          discoveryTag: tag,
          verbatim,
          mappingRationale: typeof p.mappingRationale === "string" ? p.mappingRationale.slice(0, 300) : undefined,
          sourceUrl, confidence: typeof p.confidence === "number" ? Math.max(0, Math.min(1, p.confidence)) : 0.5,
          notes, seed,
          rawContext: contextAround(srcText, verbatim),
          coverage: typeof p.coverage === "string" && p.coverage ? p.coverage : (seed.context || undefined),
          timeframe: typeof p.timeframe === "string" && p.timeframe ? p.timeframe : undefined,
          impactComments: typeof p.impactComments === "string" && p.impactComments ? p.impactComments : undefined,
        } as ValidationRow;
      });
    if (!rows.length) {
      rows = [{ dbRow, economy: seed.economy, lawName: seed.lawName, lawNumber: seed.lawNumber,
        indicatorId: seed.indicators?.[0], discoveryTag: undefined, verbatim: "", confidence: 0.25,
        notes: "Sources retrieved but no provision could be validated for the seed indicator(s). Needs manual review.", seed,
        coverage: seed.context || undefined }];
    }
  }

  // Cross-reference against already-extracted clauses for the same law — zero
  // Gemini cost, fills gaps this pipeline's own prompt doesn't reliably return
  // (Level especially: not asked for above at all). Only fills blanks, never
  // overwrites what Gemini/the seed already gave us. Cached per unique law
  // name within this batch since several provisions usually share one law.
  const xrefCache = new Map<string, Awaited<ReturnType<typeof crossRefClauseFields>>>();
  for (const row of rows) {
    const key = `${row.economy.toLowerCase()}::${(row.lawName ?? "").toLowerCase()}`;
    if (!xrefCache.has(key)) xrefCache.set(key, await crossRefClauseFields(row.economy, row.lawName));
    const xref = xrefCache.get(key);
    if (xref) {
      if (!row.level) row.level = xref.level;
      if (!row.lawNumber) row.lawNumber = xref.lawNumber;
      if (!row.lastAmended) row.lastAmended = xref.lastAmended;
      if (!row.coverage) row.coverage = xref.coverage;
      if (!row.timeframe) row.timeframe = xref.timeframe;
    }
  }

  const processingMs = Date.now() - t0;
  rows = rows.map((r) => ({ ...r, processingMs }));
  if (opts.persist !== false) await saveValidations(rows, dbRow);
  return rows;
}

// ── batch runner (mirrors extractAll / batchStatus) ───────────────────────────
interface BatchState { running: boolean; total: number; processed: number; provisions: number; errors: number; startedAt: number; finishedAt: number | null }
let batch: BatchState = { running: false, total: 0, processed: 0, provisions: 0, errors: 0, startedAt: 0, finishedAt: null };
export function validateStatus(): BatchState { return { ...batch }; }

/** Validate a whole seed database (bounded concurrency). Runs in the background. */
export async function validateAll(seeds: SeedRow[], concurrency = 2): Promise<void> {
  if (batch.running) return;
  batch = { running: true, total: seeds.length, processed: 0, provisions: 0, errors: 0, startedAt: Date.now(), finishedAt: null };
  let cursor = 0;
  const worker = async () => {
    while (cursor < seeds.length) {
      const seed = seeds[cursor++];
      try { const r = await validateSeedRow(seed); batch.provisions += r.length; }
      catch { batch.errors++; }
      batch.processed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, seeds.length || 1) }, worker));
  batch.running = false; batch.finishedAt = Date.now();
  console.log(`[validate] batch done: ${batch.provisions} provisions from ${batch.processed} seed rows (${batch.errors} errors)`);
}