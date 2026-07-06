// Semantic Diff Engine — compares two versions of a regulation at the level of
// legal *meaning*, not characters. Splits each text into sentences, embeds them,
// and matches by cosine similarity to classify each as added / removed / modified,
// then assigns a severity. Powers "GitHub for regulations" (proposal 5.4).

import { embedTexts } from "./rag.js";
import { getLatestTwoVersions, snapshotVersion } from "./db.js";
import { findSource } from "./sources.js";
import { fetchText, fetchPdfText } from "./scraper.js";
import * as cheerio from "cheerio";

const SAME = 0.93;    // ≥ this cosine = unchanged
const RELATED = 0.72; // ≥ this (but < SAME) = a modified version of the same rule; below = genuinely added/removed
const MAX_SENTENCES = 60;

export type ChangeSeverity = "low" | "medium" | "high";
export interface DiffChange { kind: "added" | "removed" | "modified"; text: string; from?: string; severity: ChangeSeverity; score?: number }
export interface DiffResult {
  changes: DiffChange[];
  summary: { added: number; removed: number; modified: number; high: number };
  note?: string;
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.;])\s+(?=[A-Z0-9(])/)          // split on sentence ends, not on ":" (keeps "Heading: rule" together)
    .map((s) => s.trim())
    .filter((s) => s.length > 40 && /\s/.test(s) && /[a-z]/.test(s)) // drop short/heading-only fragments
    .filter((s) => s.length < 600)
    .slice(0, MAX_SENTENCES);
}

const cosine = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};

// obligation/penalty language → a change here matters more.
// Stems (no trailing \b) so inflections match: prohibit→prohibited, requir→required, etc.
const HIGH = /\b(shall|must|prohibit|requir|mandator|penal|fine|imprison|localis|localiz|consent|breach|liab|restrict|ban|offence|sanction)/i;
function severityOf(text: string, kind: DiffChange["kind"]): ChangeSeverity {
  if (HIGH.test(text)) return kind === "modified" ? "medium" : "high";
  return kind === "modified" ? "low" : "medium";
}

/** Diff two raw texts at the sentence/meaning level. */
export async function semanticDiff(oldText: string, newText: string): Promise<DiffResult> {
  const oldS = sentences(oldText), newS = sentences(newText);
  if (!oldS.length || !newS.length) {
    return { changes: [], summary: { added: 0, removed: 0, modified: 0, high: 0 }, note: "Not enough text to compare." };
  }

  const [oldE, newE] = [await embedTexts(oldS), await embedTexts(newS)];
  const changes: DiffChange[] = [];

  // new sentences → added or modified
  const matchedOld = new Set<number>();
  newE.forEach((ne, i) => {
    if (!ne.length) return;
    let best = -1, bestJ = -1;
    oldE.forEach((oe, j) => { if (oe.length) { const s = cosine(ne, oe); if (s > best) { best = s; bestJ = j; } } });
    if (best >= SAME) { matchedOld.add(bestJ); return; }            // unchanged
    if (best >= RELATED) {                                          // modified
      matchedOld.add(bestJ);
      changes.push({ kind: "modified", text: newS[i], from: oldS[bestJ], severity: severityOf(newS[i], "modified"), score: Number(best.toFixed(2)) });
    } else {
      changes.push({ kind: "added", text: newS[i], severity: severityOf(newS[i], "added") });
    }
  });

  // old sentences with no match → removed
  oldE.forEach((oe, j) => {
    if (!oe.length || matchedOld.has(j)) return;
    let best = -1;
    newE.forEach((ne) => { if (ne.length) best = Math.max(best, cosine(oe, ne)); });
    if (best < RELATED) changes.push({ kind: "removed", text: oldS[j], severity: severityOf(oldS[j], "removed") });
  });

  const summary = {
    added: changes.filter((c) => c.kind === "added").length,
    removed: changes.filter((c) => c.kind === "removed").length,
    modified: changes.filter((c) => c.kind === "modified").length,
    high: changes.filter((c) => c.severity === "high").length,
  };
  // surface high-severity first
  const order = { high: 0, medium: 1, low: 2 };
  changes.sort((a, b) => order[a.severity] - order[b.severity]);
  return { changes, summary };
}

/** Diff the two most recent stored versions of a source. */
export async function diffSource(sourceId: string): Promise<DiffResult & { versions: number }> {
  const v = await getLatestTwoVersions(sourceId);
  if (v.length < 2) {
    return { versions: v.length, changes: [], summary: { added: 0, removed: 0, modified: 0, high: 0 },
      note: v.length === 1 ? "Only one version captured so far — re-crawl after the regulation changes to see a diff." : "No versions captured yet." };
  }
  const [newer, older] = v; // newest first
  return { versions: v.length, ...(await semanticDiff(older.text, newer.text)) };
}

/** Live compare of two URLs (snapshots each, then diffs) — useful for ad-hoc comparison. */
async function urlText(url: string): Promise<string> {
  if (/\.pdf(\?|#|$)/i.test(url)) return (await fetchPdfText(url, 25000, 20000).catch(() => null)) ?? "";
  const html = await fetchText(url, 12000);
  if (!html) return "";
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, header, footer, nav, form").remove();
  return ($("main").length ? $("main") : $("body")).text().replace(/\s+/g, " ").trim().slice(0, 20000);
}

export async function diffUrls(urlA: string, urlB: string): Promise<DiffResult> {
  const [a, b] = [await urlText(urlA), await urlText(urlB)];
  return semanticDiff(a, b);
}

export { snapshotVersion };
