// AILA v5 — provision validation engine. For a seed Round-1 database row it:
//   discover official source (live) → fetch (ORIGINAL LANGUAGE, structure-preserving) →
//   extract exact provisions from the ORIGINAL text → ground each verbatim claim against
//   that same text → translate only for display → classify VERIFIED / UPDATED / NEW / INVALID →
//   map to RDTII indicators → persist.
// See docs/AILA-v5-methodology.md. This is the "validate-and-discover" pipeline,
// distinct from the document-atom clause extraction in extract.ts.
//
// FIX LOG (this revision) — closes the four verbatim-integrity gaps identified in review:
//   1. Translation no longer happens before extraction. Gemini sees the ORIGINAL-language
//      source text and is told to quote from it verbatim in the original language; English
//      translation is produced separately, after extraction, as a display-only field
//      (`verbatimEn`) that never substitutes for `verbatim` itself.
//   2. Every returned `verbatim` is now grounded: normalized and checked as a fuzzy
//      substring of the source text it claims to come from (`sourceIndex`). Ungrounded
//      claims are blanked, confidence is capped low, and `notes` records why — instead of
//      silently persisting a plausible-sounding but unverifiable quote.
//   3. Long sources are chunked instead of hard-truncated. Each chunk is sent and searched
//      independently; if a source had to be split, `notes` says so and cites which chunk(s)
//      a provision came from, so "clause not found" and "clause past the cutoff" are no
//      longer indistinguishable.
//   4. HTML extraction now preserves block boundaries (paragraph/section breaks) instead of
//      collapsing all whitespace to one space, and the final verbatim slice trims to the
//      nearest sentence/clause boundary near the cap instead of cutting mid-word.
//   5. Confidence is now exported per the ESCAP template as a High/Medium/Low label
//      (`confidenceLabel`), computed deterministically in computeConfidenceLabel() from
//      match quality / OCR / citation-completeness / truncation — never from Gemini's own
//      self-reported confidence number. The original 0–1 `confidence` field is kept as a
//      dual column, but is now DERIVED from the label (not the reverse).
//
// ⚠ SCHEMA DEPENDENCY: this file now sets two fields — `verbatimEn` (fix #1) and
// `confidenceLabel` (fix #5) — on the `ValidationRow` object returned to db.ts's
// saveValidations(). ValidationRow is defined in ./db.ts (not shown here); if it's a
// strict/closed TS interface, add these two fields there or this file won't compile:
//   verbatimEn?: string;
//   confidenceLabel?: "High" | "Medium" | "Low";

import * as cheerio from "cheerio";
import { fetchText, fetchPdfText, fetchWaybackSnapshot, BROWSER_HEADERS } from "./scraper.js";
import { ocrPdf, likelyScanned } from "./ocr.js";
import { ensureEnglish } from "./translate.js"; // non-destructive: returns a translation, does not replace input
import { searchWeb } from "./websearch.js";
import { classifyAuthority } from "./authority.js";
import { RDTII_INDICATORS, isIndicatorId, findIndicator } from "./indicators.js";
import { findCriteria } from "./criteriaTable.js";
import { recordGeminiUsage } from "./cost.js";
import { saveValidations, crossRefClauseFields, type ValidationRow, type DiscoveryTag } from "./db.js";

// ValidationRow (defined in db.ts) doesn't declare `verbatimEn` or `confidenceLabel` yet.
// Extending it locally means this file compiles standalone; ValidationRowPlus is a strict
// superset of ValidationRow, so passing it to saveValidations(rows: ValidationRow[]) still
// type-checks. If/when you add these two fields to ValidationRow in db.ts directly, this
// alias becomes redundant (but harmless) and can be removed.
type ValidationRowPlus = ValidationRow & {
  verbatimEn?: string;
  confidenceLabel?: ConfidenceLabel;
};

const INDICATOR_CATALOG = RDTII_INDICATORS.map((i) => `${i.id} (P${i.pillarId} ${i.pillar}): ${i.focus}`).join("\n");
const TAGS: DiscoveryTag[] = ["VERIFIED", "UPDATED", "NEW", "INVALID"];
const MAX_SOURCES = 3;          // official candidates fetched per seed row
const CHUNK_SIZE = 8000;        // chars per chunk sent to Gemini (was: hard truncation limit)
const CHUNK_OVERLAP = 400;      // chars of overlap between chunks so a clause spanning a
                                 // chunk boundary isn't split in half
const MAX_CHUNKS_PER_SOURCE = 6; // hard ceiling so one giant PDF can't blow the batch budget
const MAX_PROVISIONS = 12;
const VERBATIM_MAX = 400;       // display cap — trimmed to a clause boundary, not blind-sliced
const GROUNDING_MIN_RATIO = 0.85; // fuzzy-match threshold (see groundVerbatim)

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
const BOT_BLOCKED = /legislation\.gov\.au|lom\.agc\.gov\.my|federalgazette\.agc\.gov\.my|(^|\.)agc\.gov\.my|(^|\.)agc\.gov\.sg/i;

// ── text extraction (structure-preserving) ─────────────────────────────────

/**
 * Extract raw text from a single URL (PDF via unpdf, HTML via cheerio).
 * FIX #4: block-level elements are joined with double newlines instead of the whole
 * document being flattened to one space-separated line — this keeps article/section
 * boundaries visible, which both the model and the grounding check rely on.
 * No length cap here anymore — chunking happens one layer up in sourceChunks().
 */
interface ExtractResult { text: string; ocr: boolean }

async function extractAt(url: string, jurisdiction?: string): Promise<ExtractResult> {
  const isPdf = /\.pdf(\?|#|$)/i.test(url);
  if (isPdf) {
    const text = await fetchPdfText(url, 25_000, Infinity).catch(() => null);
    if (text) return { text, ocr: false };
    // fetchPdfText came back empty → likely a scanned/image-only PDF (e.g. Malaysia gazette PDFs).
    if (likelyScanned(url, text)) {
      const buf = await fetch(url, { headers: BROWSER_HEADERS }).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b)).catch(() => null);
      if (buf) {
        const ocrText = await ocrPdf(buf, `val-${Buffer.from(url).toString("base64url").slice(0, 16)}`, Infinity, { jurisdiction }).catch(() => null);
        if (ocrText) return { text: ocrText, ocr: true }; // OCR-derived — must downgrade confidence downstream
      }
    }
    return { text: "", ocr: false };
  }
  const html = await fetchText(url, 12_000).catch(() => null);
  if (!html) return { text: "", ocr: false };
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, header, footer, nav, form").remove();
  const root = $("main").length ? $("main") : $("body");
  // Preserve block boundaries: pull text per block-level element, join with blank lines,
  // so a clause never gets silently stitched to the next section's text.
  const blocks: string[] = [];
  root.find("p, li, td, h1, h2, h3, h4, h5, h6, div, section, article").each((_, el) => {
    const t = $(el).clone().children("p, li, td, div, section, article").remove().end().text().replace(/[ \t]+/g, " ").trim();
    if (t) blocks.push(t);
  });
  const text = blocks.length ? blocks.join("\n\n") : root.text().replace(/[ \t]+/g, " ").trim();
  return { text, ocr: false };
}

/**
 * FIX #1: no translation here. This returns the ORIGINAL-language text only — the exact
 * text that any verbatim extraction and grounding check must be checked against. Bot-wall
 * bypass via Wayback snapshot is unchanged.
 */
async function sourceOriginalText(url: string, economy: string): Promise<ExtractResult> {
  let result = await extractAt(url, economy).catch((): ExtractResult => ({ text: "", ocr: false }));
  if (result.text.length < 800 || BOT_BLOCKED.test(url)) {
    const snap = await fetchWaybackSnapshot(url).catch(() => null);
    if (snap) {
      const archived = await extractAt(snap.url, economy).catch((): ExtractResult => ({ text: "", ocr: false }));
      if (archived.text.length > result.text.length) result = archived; // keep the richer of direct vs archived
    }
  }
  return result.text && result.text.length >= 200 ? result : { text: "", ocr: false };
}

/**
 * FIX #3: split a long original-language source into overlapping chunks instead of hard-
 * truncating. Each chunk is sent to Gemini as its own [Sx.y] source so the model can find
 * a clause anywhere in the document, and we can report exactly how much of the document
 * was actually searched.
 */
function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length && chunks.length < MAX_CHUNKS_PER_SOURCE) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks;
}

interface SourceChunk {
  url: string;
  chunkIndex: number;   // 1-based within this URL
  chunkCount: number;   // total chunks this URL produced
  truncated: boolean;   // true if the document was longer than MAX_CHUNKS_PER_SOURCE * chunkSize
  ocr: boolean;         // true if this text came from an OCR pass, not native text extraction
  text: string;         // ORIGINAL-language text of this chunk
}

async function sourceChunks(url: string, economy: string): Promise<SourceChunk[]> {
  const { text: full, ocr } = await sourceOriginalText(url, economy);
  if (!full) return [];
  const pieces = chunkText(full);
  const truncated = full.length > MAX_CHUNKS_PER_SOURCE * CHUNK_SIZE;
  return pieces.map((text, i) => ({ url, chunkIndex: i + 1, chunkCount: pieces.length, truncated, ocr, text }));
}

// ── grounding: verify a claimed verbatim quote actually appears in its source ──────────

/** Lowercase, collapse whitespace, strip common OCR/typography noise for fuzzy comparison. */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[""'']/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

type MatchQuality = "exact" | "fuzzy" | "none";

/**
 * Cheap Levenshtein-ratio fuzzy match, tolerant of OCR noise, over a sliding window.
 * Reports match QUALITY, not just presence — "exact" (post-normalization word-for-word)
 * vs "fuzzy" (close but not identical, e.g. OCR noise) is exactly the line the ESCAP
 * confidence rules draw between HIGH and MEDIUM, so this can't just return a boolean.
 * Normalization (case, curly quotes, dashes, whitespace) does NOT count as "not exact" —
 * those are typographic/encoding variants of the same text, not a textual discrepancy.
 */
function matchQuality(needle: string, haystack: string, minRatio = GROUNDING_MIN_RATIO): MatchQuality {
  const n = normalizeForMatch(needle);
  const h = normalizeForMatch(haystack);
  if (!n) return "none";
  if (h.includes(n)) return "exact"; // exact (post-normalization) match — the common case
  if (n.length < 20) return "none"; // too short to fuzzy-match reliably; require exact above
  // Slide a window slightly larger than the needle across the haystack and check edit distance.
  const windowSlack = Math.ceil(n.length * 0.15);
  const windowSize = n.length + windowSlack;
  const step = Math.max(1, Math.floor(n.length / 4));
  for (let i = 0; i <= Math.max(0, h.length - n.length); i += step) {
    const window = h.slice(i, i + windowSize);
    if (window.length < n.length * 0.85) continue;
    const dist = levenshtein(n, window.slice(0, n.length + windowSlack));
    const ratio = 1 - dist / Math.max(n.length, window.length);
    if (ratio >= minRatio) return "fuzzy"; // close but not identical — never HIGH, at best MEDIUM
  }
  return "none";
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * FIX #2: the core grounding check. Given a claimed verbatim quote and the chunk(s) it
 * says it came from, confirm the quote is actually (fuzzy-)present in that source text.
 * Returns the matched chunk index (for citation) or null if ungrounded.
 */
function groundVerbatim(
  verbatim: string,
  chunks: SourceChunk[],
  claimedChunkIndex?: number
): { grounded: boolean; chunkIndex?: number; matchQuality: MatchQuality; ocr: boolean; truncated: boolean } {
  if (!verbatim) return { grounded: true, matchQuality: "none", ocr: false, truncated: false }; // empty verbatim is honest, not a grounding failure
  // Check the claimed chunk first (cheap, and usually right), then fall back to all chunks
  // for this source in case the model mis-cited which chunk it pulled from.
  const ordered = claimedChunkIndex
    ? [...chunks.filter((c) => c.chunkIndex === claimedChunkIndex), ...chunks.filter((c) => c.chunkIndex !== claimedChunkIndex)]
    : chunks;
  for (const c of ordered) {
    const quality = matchQuality(verbatim, c.text);
    if (quality !== "none") {
      return { grounded: true, chunkIndex: c.chunkIndex, matchQuality: quality, ocr: c.ocr, truncated: c.truncated };
    }
  }
  return { grounded: false, matchQuality: "none", ocr: false, truncated: false };
}

// ── ESCAP confidence labeling ────────────────────────────────────────────
//
// Rules (verbatim from the ESCAP template — do not soften these):
//   HIGH   – Verified directly against the official source. Verbatim text and
//            citation exactly match.
//   MEDIUM – Strong evidence, but one element (page number, OCR quality, or
//            anchor) could not be fully verified.
//   LOW    – Source could not be reliably accessed or verified. Do not
//            populate the verbatim snippet; flag for manual review.
//
// Implementation rules this function enforces:
//   - HIGH only if the snippet is an EXACT word-for-word match (matchQuality === "exact").
//   - The label is computed ONLY from pipeline-verifiable signals (match quality, OCR
//     involvement, citation completeness, source accessibility, truncation). Gemini's own
//     self-reported `confidence` number is NEVER consulted here — that's "AI judgment,"
//     which the rules explicitly forbid using to raise confidence.
//   - OCR uncertainty, a missing article/section citation, or an inaccessible source can
//     only pull the label down, never up.
//   - LOW ⇒ caller must blank the verbatim snippet (enforced at the call site, not here,
//     since only the caller knows whether it already blanked it for other reasons).

export type ConfidenceLabel = "High" | "Medium" | "Low";

interface ConfidenceInputs {
  sourceAccessible: boolean;   // did we retrieve any source text at all for this row
  matchQuality: MatchQuality;  // "exact" | "fuzzy" | "none" — from groundVerbatim
  hasArticleSection: boolean;  // citation present (the "anchor" element in the ESCAP rule)
  ocrInvolved: boolean;        // text came from an OCR pass rather than native extraction
  sourceTruncated: boolean;    // source exceeded the fetch/chunk limit
}

export function computeConfidenceLabel(inputs: ConfidenceInputs): ConfidenceLabel {
  const { sourceAccessible, matchQuality, hasArticleSection, ocrInvolved, sourceTruncated } = inputs;

  // LOW: source unreachable, or the claimed verbatim couldn't be grounded at all.
  if (!sourceAccessible || matchQuality === "none") return "Low";

  // HIGH: exact word-for-word match AND a citation is present AND nothing else undermines it
  // (no OCR involved, source wasn't truncated before the match was found).
  if (matchQuality === "exact" && hasArticleSection && !ocrInvolved && !sourceTruncated) return "High";

  // Everything else that's still grounded (fuzzy match, missing citation, OCR-derived,
  // or truncated source) is real evidence but with one unverified element — MEDIUM.
  return "Medium";
}

/** Trim a verbatim string to VERBATIM_MAX chars at a sentence/clause boundary, not mid-word. */
function trimToClauseBoundary(s: string, max = VERBATIM_MAX): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  // Prefer the last sentence-ending punctuation; fall back to the last whitespace.
  const lastPunct = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("。"), slice.lastIndexOf("; "), slice.lastIndexOf("；"));
  if (lastPunct > max * 0.6) return slice.slice(0, lastPunct + 1).trim();
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim() + "…";
}

// ── source discovery ────────────────────────────────────────────────────────

/** Discover official candidate URLs for a seed row (seed URL first, then authority-ranked search). */
async function discoverSources(seed: SeedRow): Promise<string[]> {
  const focus = (seed.indicators ?? []).map((id) => findIndicator(id)?.focus).filter(Boolean).join(" ");
  const query = [seed.economy, seed.lawName, seed.lawNumber, focus || seed.context, "official legislation act section"]
    .filter(Boolean).join(" ");
  const found = await searchWeb(query, 8).catch(() => [] as string[]);
  const ranked = [...new Set([...(seed.seedUrl ? [seed.seedUrl] : []), ...found])]
    .sort((a, b) => (classifyAuthority(a).tier === "primary" ? 0 : 1) - (classifyAuthority(b).tier === "primary" ? 0 : 1));
  return ranked.slice(0, MAX_SOURCES);
}

// ── Gemini extraction (operates on ORIGINAL-language chunked text) ─────────

/**
 * For each of the seed's target indicators that has a Group-B criteriaTable.ts entry,
 * render its numbered tiers verbatim so the model can select criterionMatch instead of
 * only describing the scoring direction in free-text mappingRationale. Indicators with
 * no criteria table (Group A / unscored — findCriteria() returns undefined, or an entry
 * with no `tiers`, e.g. P12-I4's subCriteria shape) are skipped, never fabricated.
 */
function buildCriteriaBlock(indicatorIds: string[] | undefined): string {
  if (!indicatorIds?.length) return "";
  const blocks = indicatorIds
    .map((id) => {
      const c = findCriteria(id);
      if (!c?.tiers?.length) return null;
      const lines = c.tiers.map((t) => `  ${t.tier}) ${t.description}`).join("\n");
      return `Indicator ${id} scoring criteria — choose the ONE option that matches the evidence:\n${lines}`;
    })
    .filter((b): b is string => !!b);
  return blocks.join("\n\n");
}

async function callGemini(seed: SeedRow, allChunks: SourceChunk[]): Promise<any[]> {
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

  const criteriaBlock = buildCriteriaBlock(seed.indicators);

  // Sources are labeled by URL AND chunk, e.g. [S1.1], [S1.2], [S2.1] — the model must
  // cite exactly which chunk a quote came from so the grounding check can verify it fast.
  const srcBlock = allChunks
    .map((c, _i, arr) => {
      const urlIndex = [...new Set(arr.map((x) => x.url))].indexOf(c.url) + 1;
      return `[S${urlIndex}.${c.chunkIndex}/${c.chunkCount}] ${c.url}${c.truncated ? " (NOTE: document exceeds fetch limit; later sections may be unsearched)" : ""}\n${c.text}`;
    })
    .join("\n\n");

  const prompt = `You are AILA, an autonomous legal validation engine for digital-trade & data-governance law.
Validate the SEED ROW against the OFFICIAL SOURCES and extract the exact provision(s) that satisfy the indicator(s).

${NO_FABRICATION}
${SOURCE_HIERARCHY}
${INDICATOR_RULES}
${DISCOVERY_TAGS}

CRITICAL — verbatim extraction rules (do not skip):
- "verbatim" MUST be copied character-for-character from the ORIGINAL-LANGUAGE source text
  below (do NOT translate it, do NOT paraphrase it, do NOT clean up OCR artifacts).
- Every "verbatim" you return will be automatically checked against the exact source chunk
  you cite in "sourceChunk" — if it is not actually present there, the row will be rejected
  and flagged for manual review, wasting this extraction. Only quote text you can see verbatim
  in the source block below.
- If the source is not in English, leave "verbatim" in its original language — translation
  happens separately downstream.
- If a source block is marked "(NOTE: document exceeds fetch limit...)" and you cannot find
  the relevant clause in what's shown, say so in "notes" rather than guessing it's absent —
  e.g. "clause not found in the portion of the document that was fetched."

For each relevant provision return an object:
- "lawName": official title of the law
- "lawNumber": act/decree/gazette number if present, else null
- "lastAmended": latest amendment in force if stated, else null
- "indicatorId": ONE RDTII id (P#-I#) from the catalog it maps to
- "articleSection": exact citation (e.g. "s. 129(2)", "APP 8, cl. 8.1")
- "discoveryTag": one of ${JSON.stringify(TAGS)} (classify vs the seed)
- "criterionMatch": if a numbered scoring-criteria list was given above for this
  provision's indicatorId, the INTEGER tier number (e.g. 1, 2, 3) that best matches
  the evidence; null if that indicator has no criteria list above (Group A / unscored)
  or the evidence doesn't clearly support any single tier. See the mandatory-when-
  VERIFIED/UPDATED rule above — do not leave this null merely because it's easier.
- "verbatim": EXACT original-language statutory text (<=500 chars, will be trimmed to a
  clause boundary downstream); "" if not officially retrieved
- "sourceChunk": which source chunk label (e.g. "S1.2") the verbatim text came from, or null
- "mappingRationale": <=300 chars, "This [section] requires/prohibits/… Maps to Indicator X because…"
- "sourceIndex": the S# number (ignoring the .chunk suffix) the provision came from, or null
- "confidence": 0-1 (High≈0.85+, Medium≈0.5-0.85, Low<0.5)
- "notes": validation findings, amendment/version discrepancies, truncation caveats, or why
  text couldn't be retrieved
- "coverage": the instrument's sectoral/subject-matter scope, else "Cross-cutting"
- "timeframe": the instrument's temporal scope as stated in the source, else null
- "impactComments": one short sentence on practical impact on cross-border digital trade or
  compliance, else null

Extract up to ${MAX_PROVISIONS}. A provision mapping to several indicators → one object per indicator.
Do NOT use INVALID merely because exact verbatim text could not be retrieved — use INVALID ONLY when there is positive evidence the seed law/section is repealed, superseded, or mis-cited. If the law is confirmed to exist and apply but you could not pin the exact section text, use VERIFIED (or UPDATED) with LOWER confidence and a Notes flag, and leave verbatim "".
If NO statutory text is available at all, return a single object with verbatim "", low confidence, and a Notes flag — do NOT invent text and do NOT assert INVALID.

RDTII INDICATOR CATALOG:
${INDICATOR_CATALOG}

${seedBlock}

${criteriaBlock ? `${criteriaBlock}\n\n` : ""}OFFICIAL SOURCES (original language, chunked; cite the exact [Sx.y] label you quote from):
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

// ── VERIFIED/UPDATED evidence-guard helpers (see guards in validateSeedRow) ────

// Known placeholder/degenerate articleSection values seen in practice — not real
// citations, just the model punting when it couldn't locate a specific provision.
// "general" was added after the Pillar 7 re-test: the model returned it twice in a
// row for the ASIO Act/P7-I5 case where the original pilot saw the bare law name
// repeated instead — same underlying failure (no specific provision located),
// different placeholder text. Extend this set as further variants surface.
const DEGENERATE_ARTICLE_SECTION_STRINGS = new Set(["whole act", "long title", "preamble", "n/a", "unknown", "general"]);

/**
 * True if `articleSection` isn't a real, specific citation: blank/whitespace-only,
 * a known placeholder string ("Whole Act", "Long title", ...), or just the law's
 * own name repeated back (matched against whatever law-name candidates are passed —
 * typically p.lawName and seed.lawName) rather than an actual section/article.
 */
function isDegenerateArticleSection(articleSection: unknown, ...lawNames: (string | undefined)[]): boolean {
  if (typeof articleSection !== "string") return true;
  const trimmed = articleSection.trim();
  if (!trimmed) return true;
  const normalized = trimmed.toLowerCase();
  if (DEGENERATE_ARTICLE_SECTION_STRINGS.has(normalized)) return true;
  return lawNames.some((name) => name && normalized === name.trim().toLowerCase());
}

// Fix 3: lightweight tier-vs-rationale coherence check — a single conservative word
// pair (restrictive: "sectoral"/"limited"/"non-dedicated" vs broad: "comprehensive"/
// "cross-sectoral"/"applies broadly"/"horizontal") matching the actual conflict class
// observed in the Pillar 7 pilot. Checked BIDIRECTIONALLY: the pilot's real case was
// tier 3 "Comprehensive data protection framework" (broad) selected while the model's
// own mappingRationale argued "sectoral/limited nature" (restrictive) — i.e. broad
// tier + restrictive rationale, not the other way round. Both directions are real
// possible mismatches, so both are checked. Deliberately narrow: false positives here
// are more costly than missed cases, since this only ever flags for human review — it
// never auto-corrects.
const RESTRICTIVE_WORDS = /\b(sectoral|sector-specific|non-dedicated|limited)\b/i;
const BROAD_WORDS = /\b(comprehensive|cross-sectoral|applies broadly|not sector-limited|horizontal(?:ly)?)\b/i;

function tierRationaleConflict(tierDescription: string, mappingRationale: string): boolean {
  const tierBroad = BROAD_WORDS.test(tierDescription);
  const tierRestrictive = RESTRICTIVE_WORDS.test(tierDescription);
  const rationaleBroad = BROAD_WORDS.test(mappingRationale);
  const rationaleRestrictive = RESTRICTIVE_WORDS.test(mappingRationale);
  return (tierBroad && rationaleRestrictive) || (tierRestrictive && rationaleBroad);
}

// ── main entry point ─────────────────────────────────────────────────────

/** Validate one seed row → persisted ValidationRow[] (one per provision). */
export async function validateSeedRow(seed: SeedRow, opts: { persist?: boolean } = {}): Promise<ValidationRowPlus[]> {
  if (!validatorEnabled()) throw new Error("GEMINI_API_KEY not configured.");
  const dbRow = rowRef(seed);

  const urls = await discoverSources(seed);
  const perUrlChunks = await Promise.all(urls.map((u) => sourceChunks(u, seed.economy)));
  const allChunks = perUrlChunks.flat();
  const uniqueUrls = [...new Set(allChunks.map((c) => c.url))];

  let rows: ValidationRowPlus[] = [];
  if (!allChunks.length) {
    // No source reachable at all → LOW by definition, verbatim stays blank.
    rows = (seed.indicators?.length ? seed.indicators : [undefined]).map((ind) => ({
      dbRow, economy: seed.economy, lawName: seed.lawName, lawNumber: seed.lawNumber,
      indicatorId: ind, discoveryTag: undefined, verbatim: "", verbatimEn: undefined,
      mappingRationale: undefined, sourceUrl: seed.seedUrl, confidence: 0.2,
      confidenceLabel: "Low" as ConfidenceLabel,
      notes: "Flagged, not populated — no official source retrievable this session (portal block / dead link). Needs manual fetch.",
      seed,
      lastAmended: seed.lastAmended || undefined,
      coverage: seed.coverage || seed.context || undefined,
      timeframe: seed.timeframe || undefined,
      criterionMatch: null, // no evidence was ever retrieved — never a guess
    }));
  } else {
    const provisions = await callGemini(seed, allChunks);
    rows = await Promise.all(
      provisions
        .filter((p: any) => p && typeof p === "object")
        .slice(0, MAX_PROVISIONS)
        .map(async (p: any) => {
          const indicatorId = isIndicatorId(p.indicatorId) ? p.indicatorId : (seed.indicators?.[0] && isIndicatorId(seed.indicators[0]) ? seed.indicators[0] : undefined);
          const si = Number(p.sourceIndex);
          const sourceUrl = Number.isFinite(si) && uniqueUrls[si - 1] ? uniqueUrls[si - 1] : uniqueUrls[0];
          const sourceUrlChunks = allChunks.filter((c) => c.url === sourceUrl);

          const claimedChunk = typeof p.sourceChunk === "string" ? parseInt(p.sourceChunk.split(".")[1] ?? "", 10) : undefined;
          const rawVerbatim = typeof p.verbatim === "string" ? p.verbatim.trim() : "";
          const hasArticleSection = typeof p.articleSection === "string" && p.articleSection.trim().length > 0;

          // FIX #2 in action: ground the claim before trusting it.
          const { grounded, matchQuality, ocr: ocrInvolved, truncated: sourceTruncated } =
            groundVerbatim(rawVerbatim, sourceUrlChunks, claimedChunk);

          let notes: string | undefined = typeof p.notes === "string" ? p.notes : undefined;
          let verbatim = "";
          let verbatimEn: string | undefined;

          if (rawVerbatim && !grounded) {
            // Do not persist an unverifiable quote as if it were confirmed verbatim text.
            notes = `UNGROUNDED VERBATIM DISCARDED — model returned a quote that could not be matched (even fuzzily) to the source chunk it cited. Original claim withheld pending manual verification. ${notes ?? ""}`.trim();
          } else if (rawVerbatim && grounded) {
            verbatim = trimToClauseBoundary(rawVerbatim, VERBATIM_MAX);
            // FIX #1 in action: translate for display only, after grounding, never before.
            try {
              verbatimEn = await ensureEnglish(verbatim, `disp-${Buffer.from(sourceUrl).toString("base64url").slice(0, 16)}-${claimedChunk ?? "x"}`, seed.economy);
            } catch {
              verbatimEn = undefined; // translation failure shouldn't drop the verified original text
            }
            if (sourceTruncated) {
              notes = `${notes ?? ""} (Source document exceeded fetch limit — verified text is grounded in what was fetched, but later sections were not searched.)`.trim();
            }
            if (matchQuality === "fuzzy") {
              notes = `${notes ?? ""} (Fuzzy match — grounded text differs slightly from the model's quote, likely OCR/typographic noise; not an exact match.)`.trim();
            }
          }
          // rawVerbatim empty → verbatim stays "" (honest "not retrieved"), matches prior behavior.

          // ESCAP confidence label: computed ONLY from the verifiable signals above.
          // Gemini's self-reported p.confidence is deliberately NOT an input here — see
          // computeConfidenceLabel's docstring ("never increase confidence based on AI judgment").
          const confidenceLabel = computeConfidenceLabel({
            sourceAccessible: sourceUrlChunks.length > 0,
            matchQuality,
            hasArticleSection,
            ocrInvolved,
            sourceTruncated,
          });

          // Rule: "If confidence is LOW, leave the verbatim snippet blank instead of guessing."
          // Enforced here as a hard backstop, independent of how verbatim/grounding above
          // arrived at its value — LOW can never leave the building with text attached.
          if (confidenceLabel === "Low" && verbatim) {
            notes = `${notes ?? ""} (Verbatim withheld: confidence resolved to LOW after grounding — see ESCAP rule.)`.trim();
            verbatim = "";
            verbatimEn = undefined;
          }

          // Numeric confidence is retained as an internal/sortable field (dual-column export,
          // per the request) but is now DERIVED from the label's floor, not from Gemini's
          // self-reported number, so it can't silently disagree with the label a reviewer sees.
          const confidence =
            confidenceLabel === "High" ? 0.9 : confidenceLabel === "Medium" ? 0.6 : 0.2;

          let tag: DiscoveryTag | undefined = TAGS.includes(p.discoveryTag) ? p.discoveryTag : "NEW";
          // Guard: INVALID is a strong claim — require positive evidence (repeal/supersede/mis-cite),
          // not mere inability to pin verbatim text. Otherwise flag it, don't assert INVALID.
          if (tag === "INVALID" && !verbatim && !/repeal|supersed|replac|obsolete|no longer|revok|not (in force|current)/i.test(notes ?? "")) {
            tag = undefined;
            notes = `Could not confirm the exact provision from an official source this session — flagged for manual verification. ${notes ?? ""}`.trim();
          }

          // Guard: VERIFIED/UPDATED are strong claims — require actual grounding evidence,
          // not just existence belief. Downgrade to NEW with a Notes flag unless there's
          // non-empty verbatim OR a real, specific articleSection. Deliberately does NOT
          // consult the model's own self-reported p.confidence as an escape hatch — that's
          // exactly the "AI judgment" signal computeConfidenceLabel() elsewhere in this file
          // refuses to trust for raising confidence, and the Pillar 7 pilot showed it letting
          // a zero-evidence row (SOCI Act, P7-I2) through with a confidently-scored rawScore.
          let wasDowngraded = false;
          if (
            (tag === "VERIFIED" || tag === "UPDATED") &&
            !verbatim &&
            isDegenerateArticleSection(p.articleSection, p.lawName, seed.lawName)
          ) {
            const downgradedFrom = tag;
            tag = "NEW";
            wasDowngraded = true;
            notes = `Existence-only match — no specific provision or verbatim text located this session; downgraded from ${downgradedFrom} pending manual verification. ${notes ?? ""}`.trim();
          }

          // criterionMatch: the Group-B tier the model selected. Never trust it blindly —
          // force null for Group A/unscored indicators (no criteria list was ever shown to
          // the model for these), discard any tier number that doesn't actually exist in
          // that indicator's criteria table (nonsensical — same defensive posture as
          // groundVerbatim), and separately withhold it when the VERIFIED/UPDATED guard
          // above just downgraded this row for lack of evidence (unsupported — a real tier
          // number with nothing behind it). Different failure modes, different notes text,
          // so a reviewer can tell which happened.
          const criteria = indicatorId ? findCriteria(indicatorId) : undefined;
          let criterionMatch: number | null =
            typeof p.criterionMatch === "number" && Number.isInteger(p.criterionMatch) ? p.criterionMatch : null;
          if (!criteria?.tiers?.length) {
            criterionMatch = null;
          } else if (criterionMatch != null && !criteria.tiers.some((t) => t.tier === criterionMatch)) {
            notes = `${notes ?? ""} (criterionMatch ${criterionMatch} is not a valid tier for ${indicatorId} — discarded.)`.trim();
            criterionMatch = null;
          }
          if (wasDowngraded && criterionMatch != null) {
            criterionMatch = null;
            notes = `${notes ?? ""} criterionMatch also withheld — insufficient evidence to support a specific tier.`.trim();
          }

          // Fix 3: tier-vs-rationale coherence check — flag only, never auto-correct or
          // downgrade. A soft text-matching signal (see tierRationaleConflict's own note on
          // false-positive risk), so it only ever appends a manual-review note; it must not
          // touch criterionMatch or discoveryTag by itself.
          if (criterionMatch != null && criteria?.tiers?.length) {
            const tierDescription = criteria.tiers.find((t) => t.tier === criterionMatch)?.description ?? "";
            const rationale = typeof p.mappingRationale === "string" ? p.mappingRationale : "";
            if (tierRationaleConflict(tierDescription, rationale)) {
              notes = `${notes ?? ""} criterionMatch tier ${criterionMatch} may conflict with the stated mappingRationale — flagged for manual review, not auto-corrected.`.trim();
            }
          }

          return {
            dbRow, economy: seed.economy,
            lawName: typeof p.lawName === "string" && p.lawName ? p.lawName : seed.lawName,
            lawNumber: typeof p.lawNumber === "string" ? p.lawNumber : seed.lawNumber,
            lastAmended: typeof p.lastAmended === "string" ? p.lastAmended : undefined,
            indicatorId, articleSection: typeof p.articleSection === "string" ? p.articleSection : undefined,
            discoveryTag: tag,
            verbatim,        // original-language, grounded, clause-boundary-trimmed
            verbatimEn,       // display translation of the grounded verbatim — NEVER the extraction source
            mappingRationale: typeof p.mappingRationale === "string" ? p.mappingRationale.slice(0, 300) : undefined,
            sourceUrl, confidence,
            confidenceLabel,  // ESCAP High/Medium/Low export label — see computeConfidenceLabel
            notes, seed,
            coverage: typeof p.coverage === "string" && p.coverage ? p.coverage : (seed.context || undefined),
            timeframe: typeof p.timeframe === "string" && p.timeframe ? p.timeframe : undefined,
            impactComments: typeof p.impactComments === "string" && p.impactComments ? p.impactComments : undefined,
            criterionMatch,
          } as ValidationRowPlus;
        })
    );
    if (!rows.length) {
      rows = [{ dbRow, economy: seed.economy, lawName: seed.lawName, lawNumber: seed.lawNumber,
        indicatorId: seed.indicators?.[0], discoveryTag: undefined, verbatim: "", confidence: 0.25,
        confidenceLabel: "Low" as ConfidenceLabel,
        notes: "Sources retrieved but no provision could be validated for the seed indicator(s). Needs manual review.", seed,
        coverage: seed.context || undefined, criterionMatch: null }];
    }
  }

  // Cross-reference against already-extracted clauses for the same law — zero
  // Gemini cost, fills gaps this pipeline's own prompt doesn't reliably return.
  // Only fills blanks, never overwrites what Gemini/the seed already gave us.
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