import * as cheerio from "cheerio";
import type { RegulationSource } from "./types.js";
import { scrapeAll } from "./scraper.js";
import { probeUrl, fetchText } from "./scraper.js";

export type LinkHealth = "live" | "redirected" | "dead" | "blocked" | "timeout" | "error";

export interface ScanEntry {
  sourceId: string;
  jurisdiction: string;
  instrument: string;
  url: string;
  health: LinkHealth;
  status: number;
  finalUrl?: string;
  note?: string;
}

export interface Candidate {
  url: string;
  via: "redirect" | "sitemap" | "origin" | "search";
  ok: boolean;
  status: number;
  score: number; // 0..1 token overlap with the instrument name
}

export interface ResolveReport {
  sourceId: string;
  instrument: string;
  originalUrl: string;
  health: LinkHealth;
  candidates: Candidate[];
  best?: Candidate;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export function classify(status: number, ok: boolean, error?: string): LinkHealth {
  if (ok) return "live";
  if (status === 404 || status === 410) return "dead";
  if (status === 401 || status === 403 || status === 429) return "blocked";
  if (status >= 300 && status < 400) return "blocked"; // unresolved redirect / challenge loop
  if (error && /abort|timeout/i.test(error)) return "timeout";
  if (status === 0) return "error";
  return "error";
}

/** Anything that could plausibly be fixed by finding a new URL. */
const isRecoverable = (h: LinkHealth) => h === "dead" || h === "error" || h === "timeout";

/** Scan every source and classify link health. */
export async function scanAll(sources: RegulationSource[]): Promise<ScanEntry[]> {
  const scraped = await scrapeAll(sources, 5);
  return scraped.map((r) => {
    const health = classify(r.status, r.ok, r.error);
    return {
      sourceId: r.sourceId,
      jurisdiction: r.jurisdiction,
      instrument: r.instrument,
      url: r.url,
      health,
      status: r.status,
      note: r.error,
    };
  });
}

// ---------------------------------------------------------------------------
// Candidate scoring
// ---------------------------------------------------------------------------

const STOP = new Set([
  "the", "and", "for", "of", "in", "on", "to", "a", "an", "act", "law",
  "agreement", "republic", "between",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

/** Fraction of instrument tokens that appear in the candidate URL. */
function score(instrument: string, url: string): number {
  const want = tokens(instrument);
  if (!want.size) return 0;
  const got = tokens(decodeURIComponent(url));
  let hit = 0;
  for (const t of want) if (got.has(t)) hit++;
  return hit / want.size;
}

// ---------------------------------------------------------------------------
// Heuristic candidate generation
// ---------------------------------------------------------------------------

async function fromSitemap(origin: string, instrument: string): Promise<string[]> {
  const urls: string[] = [];
  const tried = new Set<string>();

  async function readSitemap(sm: string, depth: number) {
    if (depth > 1 || tried.has(sm) || urls.length > 4000) return;
    tried.add(sm);
    const xml = await fetchText(sm, 10_000);
    if (!xml) return;
    const $ = cheerio.load(xml, { xmlMode: true });
    // sitemap index → recurse into child sitemaps (bounded)
    const children = $("sitemap > loc").map((_, el) => $(el).text().trim()).get();
    for (const c of children.slice(0, 3)) await readSitemap(c, depth + 1);
    $("url > loc").each((_, el) => {
      urls.push($(el).text().trim());
    });
  }

  await readSitemap(new URL("/sitemap.xml", origin).toString(), 0);
  if (!urls.length) return [];

  return urls
    .map((u) => ({ u, s: score(instrument, u) }))
    .filter((x) => x.s > 0.25)
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map((x) => x.u);
}

/**
 * Optional web-search resolver. Enabled only when TAVILY_API_KEY is set.
 * Returns candidate URLs ranked by the provider. No key → returns [].
 */
async function fromSearch(instrument: string, jurisdiction: string): Promise<string[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: `${instrument} ${jurisdiction} official government source`,
        max_results: 5,
        search_depth: "basic",
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Array<{ url: string }> };
    return (data.results ?? []).map((r) => r.url).filter(Boolean);
  } catch {
    return [];
  }
}

/** Try to find a working replacement URL for a single source. */
export async function resolveSource(source: RegulationSource): Promise<ResolveReport> {
  const probe = await probeUrl(source.url);
  const health = classify(probe.status, probe.ok, probe.error);

  const report: ResolveReport = {
    sourceId: source.id,
    instrument: source.instrument,
    originalUrl: source.url,
    health,
    candidates: [],
  };

  if (!isRecoverable(health)) return report; // live / blocked → nothing to fix

  const origin = new URL(source.url).origin;
  const raw: Array<{ url: string; via: Candidate["via"] }> = [];

  // 1) redirect target (when the original itself redirected somewhere live)
  if (probe.finalUrl && probe.finalUrl !== source.url) raw.push({ url: probe.finalUrl, via: "redirect" });
  // 2) sitemap best matches
  for (const u of await fromSitemap(origin, source.instrument)) raw.push({ url: u, via: "sitemap" });
  // 3) optional web search
  for (const u of await fromSearch(source.instrument, source.jurisdiction)) raw.push({ url: u, via: "search" });
  // 4) fallback: site origin (at least a reachable landing page)
  raw.push({ url: origin, via: "origin" });

  // de-dupe, verify, score
  const seen = new Set<string>();
  for (const { url, via } of raw) {
    if (seen.has(url) || url === source.url) continue;
    seen.add(url);
    const p = await probeUrl(url, 10_000);
    report.candidates.push({ url, via, ok: p.ok, status: p.status, score: Number(score(source.instrument, url).toFixed(2)) });
  }

  // best = reachable, highest score (origin fallback de-prioritised)
  report.candidates.sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    const aOrigin = a.via === "origin";
    const bOrigin = b.via === "origin";
    if (aOrigin !== bOrigin) return aOrigin ? 1 : -1;
    return b.score - a.score;
  });
  report.best = report.candidates.find((c) => c.ok);
  return report;
}
