# AILA Backend

Node + Express + TypeScript backend for AILA. It does two things:

1. **Implements the frontend contract** the React app expects
   (`POST /upload`, `POST /analyze`, `GET /results`, `GET /status`, `GET /alerts`).
2. **Serves digital-trade / digital-governance regulation data** parsed from
   human-editable markdown source lists, and scrapes those source URLs.

### Source files (markdown, in `sources/`)

| File | Purpose |
|------|---------|
| [`digital-trade-regulations.md`](sources/digital-trade-regulations.md) | Curated starter scrape targets (region · instrument · url · format · cadence) |
| [`digital-governance-dataset.md`](sources/digital-governance-dataset.md) | Research dataset broken down to the **policy-measure** level (country · act · coverage · timeframe · pillar · policy focus · url) |

The parser is **header-driven** — it reads whatever column names a table declares
(`Country`/`Jurisdiction`, `Act / Practice`/`Instrument`, `References`/`URL`, …), so
both schemas work and you can add more files via `SOURCE_FILES` in `src/sources.ts`.

## Quick start

```bash
cd server
npm install          # or: pnpm install
cp .env.example .env
npm run dev          # http://localhost:8787
```

Point the frontend at it by setting, in the repo root:

```bash
# .env.local (root)
VITE_AILA_API_BASE_URL=http://localhost:8787
```

## Scraping endpoints

| Method | Path           | Description |
|--------|----------------|-------------|
| GET    | `/sources`     | De-duplicated crawl targets (one per unique URL) |
| GET    | `/policies`    | Full policy-level dataset. Filter `?country=` `?region=` `?pillar=` `?policy=` |
| GET    | `/scrape/:id`  | Scrape one source (id = `jurisdiction--instrument` slug) |
| POST   | `/scrape`      | Scrape all sources. Filter with `?region=Singapore` or `{ "ids": [...] }` |
| GET    | `/scan`        | Classify every link: `live` / `redirected` / `dead` / `blocked` / `timeout` / `error` |
| GET    | `/resolve/:id` | Suggest a working replacement URL for one source |
| POST   | `/resolve`     | Scan all, then suggest fixes for every dead/error/timeout source |
| GET    | `/classify/:id`| AI-classify a source into pillars / policy focus (Gemini) |
| POST   | `/classify`    | AI-classify an ad-hoc `{ instrument, excerpt?, jurisdiction? }` |
| GET    | `/health`      | Liveness check |

### AI auto-classification (Gemini)

`/classify` maps an instrument onto the dataset's controlled vocabularies — the two
**pillars** and the **policy-focus** taxonomy — so newly scraped sources can be
tagged automatically. It scrapes the source for context, sends title + excerpt to
Gemini, and returns validated labels (values outside the taxonomy are dropped).

Set `GEMINI_API_KEY` (+ optional `GEMINI_MODEL`, default `gemini-2.5-flash`) in
`.env`. Get a key at <https://aistudio.google.com/apikey>; its project needs the
Generative Language API enabled with free-tier quota, otherwise the call returns
`429 (limit: 0)`. Without a key, `/classify` returns `503`.

### Dead-link scanner

`/scan` fetches each source and buckets it by health. `/resolve` then tries to find
a corrected URL for the broken ones, generating candidates from (1) redirect
targets, (2) the site's `sitemap.xml` ranked by name overlap, (3) an optional web
search, and (4) the site origin as a fallback — every candidate is verified by a
real fetch and scored. **It reports suggestions; it does not rewrite the markdown.**

Search-assisted recovery is **opt-in**: set `TAVILY_API_KEY` to enable it
(see `.env.example`). With no key the resolver is heuristic-only — no AI/search
key is required to run the scanner.

Example:

```bash
curl http://localhost:8787/sources
curl -X POST "http://localhost:8787/scrape?region=Singapore"
curl http://localhost:8787/scrape/singapore--personal-data-protection-act-pdpa
```

Each scrape returns page `title`, a text `excerpt`, and candidate `documentLinks`
(PDFs / circulars / regulation pages) for downstream ingestion into the analysis
pipeline.

## Adding sources

Edit [`sources/digital-trade-regulations.md`](sources/digital-trade-regulations.md).
Add a row to any markdown table under a `##` region heading:

```
| Jurisdiction | Instrument | URL | Format | Cadence | Notes |
```

`loadSources()` re-parses the file on every request, so new rows are picked up
without a restart. **Check each site's `robots.txt` and terms of use before
enabling automated scraping.**

## How it fits together

```
sources/digital-trade-regulations.md   ← edit me (the curated URL list)
            │  parsed by
            ▼
src/sources.ts   → RegulationSource[]
            │  fed to
            ▼
src/scraper.ts   → fetch + cheerio extraction → ScrapeResult[]
            │  exposed by
            ▼
src/index.ts     → Express routes (/sources, /scrape, + frontend contract)
```
