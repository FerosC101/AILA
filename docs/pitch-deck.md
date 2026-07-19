# AILA — Technical Pitch Deck
### AI Legal Intelligence Assistant · UN ESCAP RDTII Global Hackathon

> One-line pitch: **AILA turns the manual, weeks-long job of reading digital-trade law into an auditable, citation-grounded pipeline — discovering official sources, extracting verbatim provisions, and mapping them to UN RDTII indicators with a confidence score on every claim.**

Each section below = one slide. `Speaker notes:` are what you say out loud; `Visual:` is what to show.

---

## Slide 1 — Title

**AILA — AI Legal Intelligence Assistant**
Automating regulatory discovery, extraction, and RDTII mapping for digital-trade governance.

- UN ESCAP RDTII Global Hackathon · [Team name]
- Live demo: `aila-one.vercel.app` · Code: `github.com/FerosC101/AILA`

`Visual:` The dark globe view with jurisdiction nodes lit up. Logo + tagline.

---

## Slide 2 — The Problem

**Mapping digital-trade regulation is slow, manual, and doesn't scale.**

- ESCAP's RDTII tracks **dozens of indicators × dozens of economies** — every cell needs a *verbatim* legal provision, an *official* citation, and a *rationale*.
- Today that's a human reading gazettes in multiple languages and formats, copy-pasting sections, and hand-mapping them to indicators.
- Result: **weeks of analyst time per economy**, inconsistent citations, and no audit trail when a policymaker asks "where did this come from?"

`Speaker notes:` The task isn't "find some info about a law" — it's produce a defensible, cited, indicator-mapped evidence table. That's what makes it hard and what most tools skip.

---

## Slide 3 — Why It's Technically Hard

Four walls that break naive "just scrape it" approaches:

1. **Format chaos** — laws live as HTML, born-digital PDFs, *scanned* PDFs, and multi-language documents.
2. **Bot-blocking** — official gazettes (legislation.gov.au, AGC, chinhphu.vn) actively block crawlers.
3. **Hallucination risk** — an LLM will happily invent a plausible "Article 26(2)" that doesn't exist.
4. **Provenance** — a citation is worthless unless it traces to the *official* source, verbatim.

`Speaker notes:` Our whole design is a response to these four. Every architectural choice maps back to one of them.

---

## Slide 4 — The Solution

**AILA is a validate-and-discover engine, not a database transcriber.**

Give it a seed (economy + law + indicator focus) and it:
1. **Discovers** the official source live,
2. **Extracts** the exact statutory text,
3. **Maps** it to the right RDTII indicator with a one-sentence rationale,
4. **Scores** its own confidence and **flags** anything below 0.80 for a human.

Everything is **verbatim, cited, and auditable** — or it's flagged, never faked.

`Visual:` The 4-step flow as a horizontal pipeline diagram.

---

## Slide 5 — The Extraction Pipeline  ⭐ (required: extraction logic)

*One provision, end to end:*

| Stage | What happens | How |
|---|---|---|
| **1. Discover** | Build a query from economy + law + indicator topic; rank results **official-first** | `websearch.ts` (Tavily) + `authority.ts` `classifyAuthority()` prefers `.gov`/gazette/AGC |
| **2. Fetch** | Pull the source in whatever format it is | `scraper.ts` (HTML via cheerio, PDF via unpdf/pdfjs) |
| **3. Bot-bypass** | If the official portal blocks us, retrieve the archived official page | Wayback Machine fallback + recognized mirrors |
| **4. OCR** | Scanned PDF → text, with a quality estimate | `ocr.ts` (Tesseract.js), records **CER** = (100 − mean confidence)/100 |
| **5. Translate** | Non-English source → English, cached | `translate.ts` (`ensureEnglish` via Gemini) |
| **6. Extract** | Pull provisions as **exact quotes** — never paraphrase | Gemini + `prompts.ts` `NO_FABRICATION` rules (verbatim-only, exact citations) |
| **7. Classify** | Compare each provision to the seed | `VERIFIED` / `UPDATED` (newer amendment) / `NEW` / `INVALID` (repealed/mis-cited) |
| **8. Persist** | One row per provision + surrounding **raw context** for review | `validations` table, traceable to the seed DB row |

`Speaker notes:` The key discipline is stage 6 — the prompt forbids fabrication and demands exact snippets. If the model can't find real text, it returns nothing, and the row is flagged rather than invented.

---

## Slide 6 — The Mapping Logic  ⭐ (required: mapping logic)

**Provisions map to the *official* RDTII indicator taxonomy — and hallucinated IDs are dropped.**

- Indicator IDs (`P6-I1`, `P7-I2`, …) are **auto-generated from the official `CrawlerSeed_v2.xlsx`** into `indicators.ts` — we never hand-type an ID.
- For each extracted provision the model proposes: `indicatorId`, `articleSection`, `verbatim`, and a **1-sentence Mapping Rationale** ("why this text maps to this indicator").
- Every proposed ID is validated with `isIndicatorId()` against the canonical `P#-I#` set — **anything not in the taxonomy is discarded**, so the mapping can't drift into invented indicators.
- Multi-indicator provisions keep all valid IDs.

`Visual:` A single validated row — verbatim snippet on the left, arrow, `P6-I1` + rationale on the right.

`Speaker notes:` This is where most LLM tools quietly hallucinate. We constrain the output space to the real taxonomy and reject the rest.

---

## Slide 7 — Audit & Explainability (the "Judge View")

**Every claim is defensible on screen.**

- **Side-by-side Evidence Viewer** — source excerpt on the left, the extracted citation on the right; audit each claim against its origin.
- **Confidence on everything** — a 0.00–1.00 score per extraction; anything **< 0.80 is auto-flagged "Review Needed"** and surfaced in a review queue.
- **Raw context captured** — the surrounding source text travels with each provision for human-in-the-loop verification.
- **Discovery tags** — VERIFIED / UPDATED / NEW / INVALID make the engine's judgement explicit.

`Visual:` Screenshot of the Evidence Viewer + a red "Review Needed" flag on a low-confidence row.

---

## Slide 8 — Data Coverage & Sourcing Discipline

**Official sources only — we'd rather show less than cite a blog.**

- **Round 1 — complete, 100% official:** Australia (`legislation.gov.au`), Singapore (`sso.agc.gov.sg`), Malaysia (`pdp.gov.my`, `agc.gov.my`, `hasil.gov.my`).
- **Round 2:** Thailand (`mdes.go.th`, Ministry of Digital Economy) added from its official portal.
- **Sourcing rule enforced in code** — `classifyAuthority()` ranks gov/gazette sources first; during cleanup we **purged every non-official row** (aggregators, law-firm blogs, document mirrors) rather than pass them off as official.

`Speaker notes (honest framing that judges respect):` We hit real bot-blocks on some national gazettes. Our answer was *not* to launder mirror text as "official" — it was to refuse it. For blocked portals, the human-in-the-loop uploads the official PDF and the same pipeline validates it with genuine provenance.

---

## Slide 9 — Required Outputs

**Two deliverables, generated from the same validated table.**

- **CSV (13 columns, judge-friendly):** Economy · Law Name · Law Number · Last Amended · Indicator ID · Article/Section · Discovery Tag · Location Reference · Verbatim Snippet · Mapping Rationale · Source URL · Confidence · Notes. RFC-4180 + Excel BOM → opens cleanly for non-technical reviewers.
- **JSON (deep metadata):** adds `ocr_quality_cer`, `processing_time`, `model_version`, `source_pdf_path`, `raw_context` — everything an engineer needs to reproduce a run.

`Visual:` A snippet of the CSV open in Excel next to the JSON metadata block.

---

## Slide 10 — Beyond the Table: the Product

The engine powers an analyst-facing platform:

- **Regulatory Graph & 3D Globe** — every tracked jurisdiction and scraped source as a live, pillar-colored network.
- **Consultation (RAG chatbot)** — ask a question, get a *grounded* answer with live web retrieval, citations, and a confidence score; scan a document with your **camera** to add it to the corpus.
- **Compliance Digital Twin** — model a data-handling scenario and run what-ifs across ASEAN jurisdictions.
- **Cross-border Comparison** — friction levels + citations per economy, derived live from the validated corpus.

`Visual:` 2×2 grid of product screenshots.

---

## Slide 11 — Architecture / Tech Stack

- **Frontend:** React + Vite + TypeScript, canvas 3D force-graph, react-globe.gl → deployed on **Vercel**.
- **Backend:** Node + Express (TypeScript) → containerized on **Render**.
- **Data:** SQLite via `@libsql/client` (Turso-ready).
- **AI:** Google **Gemini** (`2.5-flash` extraction/RAG, `2.0-flash` classify, `embedding-001` retrieval) · **Tesseract.js** OCR · **Tavily** live discovery.
- **Cost-aware:** per-call token + cost tracking (`cost.ts`); bounded concurrency for batch validation.

`Visual:` Simple boxes-and-arrows: Frontend → API → {Discovery, Extraction, Mapping, Export} → SQLite, with Gemini/OCR/Tavily as side services.

---

## Slide 12 — Why AILA Wins

1. **Verbatim-or-nothing** — a no-fabrication prompt contract; flagged, never invented.
2. **Official-source-first + bot-block resilience** — authority ranking + Wayback fallback.
3. **Taxonomy-constrained mapping** — hallucinated indicator IDs are rejected by construction.
4. **Auditable by design** — side-by-side evidence, per-claim confidence, <0.80 review gate.
5. **Full submission artifact** — 13-column CSV + deep JSON generated straight from the engine.

`Speaker notes:` The theme is trust. A regulatory tool that can't show its work is unusable for policy; ours shows its work on every row.

---

## Slide 13 — Roadmap

- **Coverage:** human-in-the-loop official-PDF upload → 3+ Round-2 economies with genuine provenance.
- **Durability:** move the corpus to Turso; mount persistent storage for validations.
- **OCR hardening:** fix the rasterized-scan worker path for fully-scanned gazettes.
- **Change detection:** scheduled re-crawls + semantic diff to catch amendments automatically (`diff.ts` foundation already in place).

---

## Slide 14 — Closing

**AILA makes regulatory evidence fast to produce and impossible to fake.**

- Live: `aila-one.vercel.app`
- Code + README: `github.com/FerosC101/AILA`
- Contact: [team emails]

`Visual:` Return to the globe; overlay the one-line pitch.

---

### Appendix (optional back-up slides)
- **A. Extraction prompt contract** — the exact `NO_FABRICATION` rules (verbatim-only, exact citations, official-source-first).
- **B. A worked example** — Malaysia PDPA s.129 flagged **UPDATED** after the 2024 amendment removed the transfer ban (matches ESCAP's own finding).
- **C. Confidence calibration** — how the 0.80 threshold was chosen and what falls in the review queue.
- **D. Cost & latency** — tokens/economy, batch concurrency, `/cost` tracking.
