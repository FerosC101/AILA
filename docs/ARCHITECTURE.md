# AILA — Architecture & Engineering Overview

**AILA (Artificial Intelligence for Legal Analysis)** is an AI-powered regulatory-intelligence
platform for digital-trade and data-governance law. It **discovers, extracts, maps, and
categorizes** regulations from government sources and lets users query, simulate, and
compare them — with citation-first, machine-readable outputs.

- **Frontend:** React + Vite + TypeScript (`src/`) — graph/globe, Consultation (RAG), Simulation, Document Archive.
- **Backend:** Node + Express + TypeScript (`server/`) — the engine + REST API.
- **Database:** SQLite via libSQL (`server/data/aila.db`, auto-created).
- **AI:** Google **Gemini** via API — `gemini-2.5-flash` (generation) + `gemini-embedding-001` (embeddings). No model is trained or hosted; it's an API key.

> Setup & run instructions live in [`RUNBOOK.md`](../RUNBOOK.md). This document is the
> architecture + API reference.

---

## 1. The pipeline (what "the engine" does)

```
Discovery ─▶ Extraction ─▶ Mapping ─▶ Categorization ─▶ Outputs
 crawl/scrape   clause-level   RDTII         pillars +        machine-readable
 + PDF + OCR    "atoms" with   indicator     policy-focus      JSON, graph,
 + translate    citations +    codes                           RAG answers,
                verbatim                                        simulation, diff
                snippets
```

Every stage is a module under `server/src/` and is exposed as one or more REST endpoints.

---

## 2. Backend modules (`server/src/`)

| Module | Responsibility |
|---|---|
| `index.ts` | Express app + all routes + startup cache-warming |
| `sources.ts` | Parses the markdown source lists into `RegulationSource[]` (header-driven) |
| `scraper.ts` | Fetch (browser headers) + HTML (cheerio) + PDF text (`unpdf`) + version snapshot |
| `ocr.ts` | Tesseract OCR for scanned PDFs / images (persistent worker + queue) |
| `translate.ts` | Language detection + Gemini translation to English (DB-cached) |
| `render.ts` | Optional Playwright headless fallback for JS-blocked pages (`USE_PLAYWRIGHT=1`) |
| `scanner.ts` | Dead-link classification, heuristic URL resolver, active-URL health cache |
| `graph.ts` | Builds the country → pillar → URL knowledge graph (active-only) |
| `classify.ts` | Gemini classification → **RDTII categories** + pillars + policy focus |
| `extract.ts` | Gemini **clause extraction** → structured atoms + citations + embeddings |
| `rag.ts` | Embedding index (chunks + clauses) → retrieval → grounded, cited answers |
| `simulate.ts` | Compliance "digital twin" — what-if scenario → per-jurisdiction verdict |
| `diff.ts` | Semantic version diff (added/removed/modified + severity) |
| `engine.ts` | Orchestrates discovery→extraction→mapping into one **Output Sample** |
| `upload.ts` | Same engine, fed by an uploaded file (PDF / image OCR / text) |
| `db.ts` | libSQL persistence: sources, scrapes, chunks, clauses, translations, versions |

### Data model (SQLite)
`sources` (crawl targets) · `scrapes` (crawl audit trail) · `chunks` (RAG text + embeddings) ·
`clauses` (extracted atoms + embeddings) · `translations` (cache) · `versions` (content-hash history for diffing).

Embeddings are stored as base64 Float32; the RAG index is restored into memory on boot.

---

## 3. API reference

Base URL: `http://localhost:8787`. All bodies are JSON unless noted.

### Health & contract
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service status + DB counts + OCR/translation/render status |
| GET | `/status` | Upload queue (legacy contract) |
| GET | `/results` · `/alerts` | Legacy contract stubs |
| POST | `/analyze` | Legacy contract stub |

### Discovery — sources, scraping, link health
| Method | Path | Description |
|---|---|---|
| GET | `/sources` | De-duplicated crawl targets parsed from the markdown lists |
| GET | `/policies` | Full policy-level dataset. Filters: `?country= ?region= ?pillar= ?policy=` |
| GET | `/scrape/:id` | Scrape one source (HTML text / PDF text / OCR) |
| POST | `/scrape` | Scrape all sources. `?region=` or body `{ ids: [...] }` |
| GET | `/scan` | Classify every link: `live / dead / blocked / timeout / error` |
| GET | `/resolve/:id` | Suggest a working replacement URL for one source |
| POST | `/resolve` | Scan all, then suggest fixes for every dead source |

### Knowledge graph
| Method | Path | Description |
|---|---|---|
| GET | `/graph` | Country → pillar → URL graph (active-only by default; `?all=1` for everything) |

### Classification (RDTII)
| Method | Path | Description |
|---|---|---|
| GET | `/classify/:id` | Scrape a source, then classify → `{ rdtii[], pillars[], policyFocus[], coverage, rationale }` |
| POST | `/classify` | Classify ad-hoc `{ instrument, jurisdiction?, url?, excerpt? }` |

### Clause extraction
| Method | Path | Description |
|---|---|---|
| POST | `/extract/:id` | Extract structured clauses for one source (by id), persist + embed |
| POST | `/extract` | Extract by `{ url }` (used by the graph node drawer) |
| POST | `/extract/all` | Background batch extraction across all active sources |
| GET | `/extract/status` | Batch progress |
| GET | `/clauses` | Query stored clauses. Filters: `?jurisdiction= ?type= ?sourceId=` |

### The Engine — one-document Output Sample
| Method | Path | Description |
|---|---|---|
| POST | `/engine/analyze` | Full pipeline on `{ id }` or `{ url }` → machine-readable Output Sample. `?download=1` returns a file |
| GET | `/engine/analyze/:id` | Same, as a downloadable JSON |
| POST | `/upload` | **multipart** `file` (+ optional `jurisdiction`) → OCR/extract/map → Output Sample; persists to the archive |

**Output Sample shape** (indicator mapping · exact citations · verbatim snippets · discovery tags):
```json
{
  "engine": "aila-engine/1.0",
  "document": { "instrument": "...", "jurisdiction": "...", "sourceType": "pdf",
                "language": "en", "discoveryTags": ["...","DP-1","CB-1"] },
  "pipeline": { "discovery": {...}, "extraction": {...}, "mapping": { "rdtii": [...] } },
  "clauses": [ { "type": "obligation", "citation": "Section 13", "snippet": "…verbatim…",
                 "indicators": [ { "code": "CB-1", "name": "Cross-border data flows" } ] } ]
}
```

### RAG — grounded, cited Q&A
| Method | Path | Description |
|---|---|---|
| POST | `/rag/query` | `{ question }` → structured brief: verdict, summary, key points, risks, recommendations, **citations**, confidence |
| POST | `/rag/index` | (Re)build the embedding index |
| GET | `/rag/status` | Index readiness (chunks + clause units) |

### Simulation — the compliance digital twin
| Method | Path | Description |
|---|---|---|
| GET | `/simulate/options` | Dataset-derived form choices (jurisdictions, data categories, storage regions) |
| POST | `/simulate` | `{ businessType, dataCategories, storageRegion, targetJurisdictions, controls }` → per-jurisdiction verdict + AI narrative |

### Version control & semantic diff
| Method | Path | Description |
|---|---|---|
| GET | `/versions/:id` | Version history for a source |
| GET | `/diff/:id` | Semantic diff of the two most recent versions of a source |
| POST | `/diff` | Ad-hoc diff: `{ url }` (its own versions), `{ urlA, urlB }`, or `{ textA, textB }` |

---

## 4. AI usage (Gemini)

| Task | Model | Where |
|---|---|---|
| Answer generation, classification, clause extraction, diff-narrative, simulation narrative | `gemini-2.5-flash` | `rag.ts`, `classify.ts`, `extract.ts`, `simulate.ts` |
| Embeddings (RAG chunks, clause units, diff sentences, query) | `gemini-embedding-001` | `rag.ts` |

**Citation-first & self-reflective:** RAG answers cite retrieved excerpts by `[n]`, and
confidence is discounted when retrieval is weak (`grounded: false`) so the system doesn't
overstate. Clause extraction records the **verbatim source quote** and **exact citation**
for auditability.

---

## 5. Retrieval design

- **Two retrieval indexes**, ranked together: page **chunks** and extracted **clause units**
  (clauses get a small boost — they're precise and pre-cited).
- Cosine similarity over Gemini embeddings, in-memory, restored from SQLite on boot.
- Running "Extract clauses" on more sources permanently sharpens retrieval for those instruments.
- **Accuracy harness:** `npm run eval` reports retrieval hit-rate, top-1 precision, grounded-rate, and average confidence against `server/eval/gold-set.json`.

---

## 6. Configuration (`server/.env`)

| Var | Purpose |
|---|---|
| `GEMINI_API_KEY` | **Required.** Enables all AI features |
| `GEMINI_MODEL` | Generation model (default `gemini-2.5-flash`) |
| `PORT` | Backend port (default 8787) |
| `USE_PLAYWRIGHT` | `1` to enable the headless-browser fallback (needs `npx playwright install chromium`) |
| `TAVILY_API_KEY` | Optional — search-assisted dead-link recovery |

---

## 7. Startup behavior

On boot the backend: initializes the DB, upserts sources, restores the RAG index from the DB,
then **warms the link-health cache** and **rebuilds the RAG index** in the background — so the
first `/graph` and `/rag/query` are fast. Run `npm run prewarm` (root) before a demo to warm
everything (add `-- --extract` to also batch-extract clauses).

---

## 8. Known limitations

- **JS-blocked gov sites** return thin text without Playwright (chromium not installed by default) → lower RAG confidence on those.
- **Scanned PDFs** depend on Tesseract OCR (slower, per-page).
- **Gemini free tier** rate-limits (`429`) under heavy batch use — pre-warm before demos or use a paid key.
- **Country map (globe view)** fetches a GeoJSON at runtime; falls back to a plain globe offline.
