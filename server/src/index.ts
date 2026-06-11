import express from "express";
import cors from "cors";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadSources, loadPolicies, findSource } from "./sources.js";
import { scrapeAll, scrapeSource } from "./scraper.js";
import { scanAll, resolveSource, refreshHealth, activeUrlSet, healthReady, healthState } from "./scanner.js";
import { buildGraph } from "./graph.js";
import { classifyInstrument, classifierEnabled } from "./classify.js";
import { runSimulation, simulationOptions } from "./simulate.js";
import { ragQuery, buildIndex, ragStatus, loadIndexFromDb } from "./rag.js";
import { initDb, upsertSources } from "./db.js";

// Minimal .env loader (no dependency) — reads server/.env into process.env.
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch { /* no .env — fine */ }

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

/**
 * GET /graph — countries as hubs, each unique crawled URL as a regulation node.
 * Active-only by default (reachable URLs, from the health cache). Pass ?all=1 to
 * include everything regardless of reachability.
 */
app.get("/graph", async (req, res) => {
  const STALE_MS = 15 * 60 * 1000;
  if (req.query.all === "1") return res.json({ ...buildGraph(), mode: "all" });

  if (!healthReady()) {
    await refreshHealth(loadSources()); // first request warms the cache
  } else if (Date.now() - healthState().scannedAt > STALE_MS) {
    void refreshHealth(loadSources()); // stale → refresh in background, serve cached now
  }
  res.json({ ...buildGraph(activeUrlSet()), mode: "active", health: healthState() });
});

// =============================================================================
// AI auto-classification (Gemini)
// =============================================================================

/** GET /classify/:id — scrape a source, then classify it into pillars/policy focus. */
app.get("/classify/:id", async (req, res) => {
  if (!classifierEnabled()) return res.status(503).json({ error: "GEMINI_API_KEY not configured." });
  const source = findSource(req.params.id);
  if (!source) return res.status(404).json({ error: `Unknown source: ${req.params.id}` });

  try {
    const scrape = await scrapeSource(source);
    const classification = await classifyInstrument({
      instrument: source.instrument,
      jurisdiction: source.jurisdiction,
      excerpt: scrape.excerpt || scrape.title,
    });
    res.json({
      sourceId: source.id,
      instrument: source.instrument,
      jurisdiction: source.jurisdiction,
      url: source.url,
      reachable: scrape.ok,
      classification,
    });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** POST /classify — classify an ad-hoc instrument: { instrument, excerpt?, jurisdiction?, url? }.
 *  If a url is given and no excerpt, the page is scraped first for context. */
app.post("/classify", async (req, res) => {
  if (!classifierEnabled()) return res.status(503).json({ error: "GEMINI_API_KEY not configured." });
  const { instrument, excerpt, jurisdiction, url } = req.body ?? {};
  if (!instrument) return res.status(400).json({ error: "instrument is required." });
  try {
    let context = excerpt as string | undefined;
    if (!context && url) {
      const scrape = await scrapeSource({
        id: "adhoc", jurisdiction: jurisdiction || "Unknown", instrument,
        url, region: "", format: "html", cadence: "monthly",
      });
      context = scrape.excerpt || scrape.title;
    }
    res.json(await classifyInstrument({ instrument, excerpt: context, jurisdiction }));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// =============================================================================
// Compliance simulation — the "digital twin" / what-if engine
// =============================================================================

/** GET /simulate/options — dataset-derived choices for the scenario form. */
app.get("/simulate/options", (_req, res) => {
  res.json(simulationOptions());
});

/** POST /simulate — run a what-if scenario against the policy dataset. */
app.post("/simulate", async (req, res) => {
  const scenario = req.body ?? {};
  if (!Array.isArray(scenario.targetJurisdictions) || scenario.targetJurisdictions.length === 0) {
    return res.status(400).json({ error: "targetJurisdictions[] is required." });
  }
  try {
    res.json(await runSimulation(scenario));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// =============================================================================
// RAG — grounded Q&A over the live regulation corpus (citation-first)
// =============================================================================

/** GET /rag/status — index readiness. */
app.get("/rag/status", (_req, res) => res.json(ragStatus()));

/** POST /rag/index — (re)build the embedding index. */
app.post("/rag/index", async (_req, res) => {
  if (!classifierEnabled()) return res.status(503).json({ error: "GEMINI_API_KEY not configured." });
  try {
    res.json(await buildIndex());
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** POST /rag/query — retrieve + answer with real citations. */
app.post("/rag/query", async (req, res) => {
  if (!classifierEnabled()) return res.status(503).json({ error: "GEMINI_API_KEY not configured." });
  const { question } = req.body ?? {};
  if (!question || typeof question !== "string") return res.status(400).json({ error: "question is required." });
  try {
    res.json(await ragQuery(question));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
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

app.listen(PORT, async () => {
  console.log(`AILA backend listening on http://localhost:${PORT}`);
  console.log(`Loaded ${loadPolicies().length} policy rows → ${loadSources().length} unique crawl targets.`);

  // ── initialize DB ──
  await initDb();
  await upsertSources(loadSources());
  console.log("Database ready");
  await loadIndexFromDb();
  console.log(`AI classifier: ${classifierEnabled() ? `enabled (${process.env.GEMINI_MODEL || "gemini-2.5-flash"})` : "disabled (set GEMINI_API_KEY)"}.`);
  // Warm the active-URL health cache, then build the RAG index — both in the
  // background so /graph and /rag/query are fast once a user arrives.
  console.log("Warming link-health cache…");
  void refreshHealth(loadSources()).then(() => {
    console.log(`Health cache ready: ${activeUrlSet().size}/${loadSources().length} URLs active.`);
    if (classifierEnabled()) {
      console.log("Building RAG index…");
      void buildIndex()
        .then((r) => console.log(`RAG index ready: ${r.chunks} chunks from ${r.sources} sources.`))
        .catch((e) => console.log(`RAG index build failed: ${e.message}`));
    }
  });
});
