# AILA — AI Legal Intelligence Assistant

**UN ESCAP RDTII Global Hackathon — Round 1 (Indicators 6 & 7: Cross-border Data Flows + Domestic Data Protection)**

AILA is an **autonomous legal validation & evidence-extraction engine**. Given the ESCAP seed database, it crawls live government portals, extracts **verbatim** statutory provisions, maps them to real RDTII indicators (`P6-I1`, `P7-I2`, …), and produces the mandated **13-column CSV** + **supplementary JSON** — with full source traceability and confidence calibration.

- **Frontend:** React 18 + Vite + TypeScript (regulatory knowledge graph, globe, research assistant, digital twin, document archive).
- **Backend:** Node + Express + TypeScript (`server/`), SQLite (`@libsql/client`), Google **Gemini** for extraction/mapping, **Tesseract.js** for OCR.

---

## Quick Start

### 1. Prerequisites
- Node.js ≥ 18
- A **Google Gemini API key** (AI Studio) — required for extraction, mapping, and the assistant.
- *(Optional)* a **Tavily API key** — upgrades live web search from keyless DuckDuckGo to Tavily.

### 2. Install
```bash
git clone <repo> && cd "AILA---Artificial-Intelligence-for-Legal-Analysis"
npm install                    # frontend deps
npm --prefix server install    # backend deps
```

### 3. Configure environment
**`server/.env`** (backend — copy from `server/.env.example`):
```ini
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-2.5-flash        # optional (default)
TAVILY_API_KEY=your_tavily_key       # optional — live web search
# optional tuning: EXTRACT_MAX_WINDOWS=3   REVIEW_THRESHOLD=0.8
```
**`.env.local`** (frontend — points the UI at the backend):
```ini
VITE_AILA_API_BASE_URL=http://localhost:8787
```

### 4. Run (backend + frontend together)
```bash
npm run dev:all
```
- Frontend → **http://localhost:5173**
- Backend  → **http://localhost:8787** (`/health` to check)

Or separately: `npm --prefix server run dev` and `npm run dev`.

---

## Produce the Round-1 submission

The engine turns the ESCAP seed database into the validated 13-column output.

```bash
cd server
# 1. Ingest the seed / prior submission CSV (preserves populated rows, marks blanks)
npm run ingest:round1 -- data/round1-submission.csv

# 2. Fill blanks by validating live against official portals (bot-block bypass built in)
npm run seed -- --fill                      # or: --economy=Malaysia  --limit=20

# 3. Download the outputs
#   Primary CSV        : http://localhost:8787/export/round1.csv
#   Supplementary JSON : http://localhost:8787/export/round1.json
```
Run a whole seed DB from scratch with `npm run seed -- data/seed.csv` (CrawlerSeed columns are auto-mapped). In the UI, the **Document Archive** has **Round-1 CSV** / **JSON** download buttons and a **⚑ Needs-review** filter (auto-flags confidence < 0.80).

### Output formats
- **CSV (primary):** exactly `Economy, Law Name, Law Number/Ref, Last Amended, Indicator ID, Article/Section, Discovery Tag (KNOWN/NEW), Location Reference, Verbatim Snippet, Mapping Rationale, Source URL, Confidence (0.00–1.00), Notes`.
- **JSON (technical):** `model_version`, `processing_time`, `source_pdf_path`, `ocr_quality_cer`, `raw_context`, and `provisions[]` grouped per law.

---

## Evaluation harnesses
```bash
cd server
npm run eval          # RAG retrieval: hit-rate, precision, grounded-rate
npm run eval:extract  # extraction accuracy: indicator F1, field accuracy, Cohen's κ
```

## How it works (extraction & mapping logic)
1. **Discovery** — live search (`websearch.ts`) ranks **official/primary** sources first (`authority.ts`); never trusts cached URLs.
2. **Retrieval** — HTML (cheerio) or PDF (unpdf); **scanned PDFs → OCR** (`ocr.ts`, multilingual). **Bot-blocked portals** (legislation.gov.au, AGC) are recovered via the **Internet Archive** (`fetchWaybackSnapshot`).
3. **Extraction** — Gemini pulls **exact verbatim** provisions under strict anti-fabrication rules (`prompts.ts`); flags (never invents) when text can't be retrieved.
4. **Mapping** — validates each indicator ID against the real RDTII taxonomy (`indicators.ts`); supports **multi-indicator** provisions.
5. **Classification** — tags each provision `KNOWN` (in seed) or `NEW` (independently discovered); confidence 0.00–1.00, `< 0.80` flagged for human review.

See [`docs/AILA-v5-methodology.md`](docs/AILA-v5-methodology.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Project layout
- `src/app/App.tsx` — main UI (graph, globe, assistant, digital twin, document archive)
- `server/src/` — `validate.ts` (v5 engine), `extract.ts` (clauses), `export.ts` (CSV/JSON), `ocr.ts`, `scraper.ts`, `websearch.ts`, `authority.ts`, `indicators.ts`, `rag.ts`, `db.ts`
- `server/eval/` — accuracy harnesses + gold sets

> **Note:** `GEMINI_API_KEY` / `TAVILY_API_KEY` live only in the gitignored `server/.env`. Never commit real keys.
