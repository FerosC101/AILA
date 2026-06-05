import express from "express";
import cors from "cors";
import { loadSources, loadPolicies, findSource } from "./sources.js";
import { scrapeAll, scrapeSource } from "./scraper.js";
import { scanAll, resolveSource } from "./scanner.js";
import { buildGraph } from "./graph.js";

const app = express();
const PORT = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json());

// --- in-memory stores (prototype) -------------------------------------------
type DocStatus = "queued" | "uploaded" | "analyzing" | "ready" | "failed";
interface UploadRecord {
  id: string;
  fileName: string;
  jurisdiction: string;
  documentType: string;
  status: DocStatus;
  uploadedAt: string;
  sourceLabel?: string;
  notes?: string;
}
const uploads: UploadRecord[] = [];
const results: unknown[] = [];
const alerts: unknown[] = [];

// --- health ------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "aila-backend", time: new Date().toISOString() });
});

// =============================================================================
// Digital-trade scraping layer
// =============================================================================

/** GET /sources — de-duplicated crawl targets parsed from the markdown lists. */
app.get("/sources", (_req, res) => {
  const sources = loadSources();
  res.json({ count: sources.length, sources });
});

/**
 * GET /policies — full policy-level dataset.
 * Filters: ?country= ?region= ?pillar= ?policy= (case-insensitive substring).
 */
app.get("/policies", (req, res) => {
  const q = (k: string) => (req.query[k] as string | undefined)?.toLowerCase();
  const [country, region, pillar, policy] = [q("country"), q("region"), q("pillar"), q("policy")];

  let rows = loadPolicies();
  if (country) rows = rows.filter((r) => r.jurisdiction.toLowerCase().includes(country));
  if (region) rows = rows.filter((r) => r.region.toLowerCase().includes(region));
  if (pillar) rows = rows.filter((r) => (r.pillar ?? "").toLowerCase().includes(pillar));
  if (policy) rows = rows.filter((r) => (r.policyFocus ?? "").toLowerCase().includes(policy));

  res.json({ count: rows.length, policies: rows });
});

/** GET /graph — countries as hubs, each unique crawled URL as a regulation node. */
app.get("/graph", (_req, res) => {
  res.json(buildGraph());
});

/** POST /scrape — scrape all sources, or a subset via ?region= / body.ids. */
app.post("/scrape", async (req, res) => {
  let sources = loadSources();

  const region = (req.query.region as string | undefined)?.toLowerCase();
  if (region) sources = sources.filter((s) => s.region.toLowerCase() === region);

  const ids: string[] | undefined = req.body?.ids;
  if (Array.isArray(ids) && ids.length) sources = sources.filter((s) => ids.includes(s.id));

  if (!sources.length) return res.status(404).json({ error: "No matching sources." });

  const scraped = await scrapeAll(sources);
  res.json({
    requested: sources.length,
    succeeded: scraped.filter((r) => r.ok).length,
    results: scraped,
  });
});

/** GET /scrape/:id — scrape a single source by id. */
app.get("/scrape/:id", async (req, res) => {
  const source = findSource(req.params.id);
  if (!source) return res.status(404).json({ error: `Unknown source: ${req.params.id}` });
  res.json(await scrapeSource(source));
});

// =============================================================================
// Dead-link scanner + URL resolver
// =============================================================================

/** GET /scan — classify link health (live/redirected/dead/blocked/timeout/error). */
app.get("/scan", async (req, res) => {
  let sources = loadSources();
  const region = (req.query.region as string | undefined)?.toLowerCase();
  if (region) sources = sources.filter((s) => s.region.toLowerCase() === region);

  const entries = await scanAll(sources);
  const summary = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.health] = (acc[e.health] ?? 0) + 1;
    return acc;
  }, {});
  res.json({ total: entries.length, summary, entries });
});

/** GET /resolve/:id — find a working replacement URL for one source. */
app.get("/resolve/:id", async (req, res) => {
  const source = findSource(req.params.id);
  if (!source) return res.status(404).json({ error: `Unknown source: ${req.params.id}` });
  res.json(await resolveSource(source));
});

/**
 * POST /resolve — scan all sources, then attempt to fix every dead/error/timeout
 * one. Returns the suggested replacements (does NOT rewrite the markdown).
 * Search-assisted only when TAVILY_API_KEY is set; heuristic otherwise.
 */
app.post("/resolve", async (_req, res) => {
  const sources = loadSources();
  const scan = await scanAll(sources);
  const broken = scan.filter((e) => e.health === "dead" || e.health === "error" || e.health === "timeout");

  const reports = [];
  for (const entry of broken) {
    const source = sources.find((s) => s.id === entry.sourceId)!;
    reports.push(await resolveSource(source));
  }

  res.json({
    searchProvider: process.env.TAVILY_API_KEY ? "tavily" : "heuristic-only",
    scanned: scan.length,
    broken: broken.length,
    fixable: reports.filter((r) => r.best).length,
    reports,
  });
});

// =============================================================================
// Frontend contract (mirrors README + src/services/*)
// =============================================================================

/** POST /upload */
app.post("/upload", (req, res) => {
  const { fileName, jurisdiction, documentType, sourceLabel, notes } = req.body ?? {};
  if (!fileName || !jurisdiction || !documentType) {
    return res.status(400).json({ error: "fileName, jurisdiction, documentType are required." });
  }
  const record: UploadRecord = {
    id: `upload-${Date.now()}`,
    fileName,
    jurisdiction,
    documentType,
    status: "uploaded",
    uploadedAt: new Date().toISOString(),
    sourceLabel,
    notes,
  };
  uploads.push(record);
  res.status(201).json(record);
});

/** GET /status — upload queue */
app.get("/status", (_req, res) => res.json(uploads));

/** POST /analyze — stub that flips an upload to ready */
app.post("/analyze", (req, res) => {
  const { uploadId } = req.body ?? {};
  const upload = uploads.find((u) => u.id === uploadId);
  if (!upload) return res.status(404).json({ error: "Unknown uploadId." });
  upload.status = "ready";
  res.json({ ok: true, uploadId, status: upload.status });
});

/** GET /results */
app.get("/results", (_req, res) => res.json(results));

/** GET /alerts */
app.get("/alerts", (_req, res) => res.json(alerts));

app.listen(PORT, () => {
  console.log(`AILA backend listening on http://localhost:${PORT}`);
  console.log(`Loaded ${loadPolicies().length} policy rows → ${loadSources().length} unique crawl targets.`);
});
