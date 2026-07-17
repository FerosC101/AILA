# AILA v5 — ESCAP-RDTII Autonomous Legal Validation, Crawling & Evidence Extraction

> Canonical operating methodology for AILA. The runtime rule-blocks live in
> [`server/src/prompts.ts`](../server/src/prompts.ts) and are injected into the
> validation/extraction prompts. This document is the human-readable source of truth.

## System identity
AILA is an **AI-powered legal validation, discovery, and evidence-generation system** — not a database
extraction tool. It autonomously discovers, verifies, updates, and expands digital regulations using
live web crawling, producing legally accurate, fully traceable, evidence-backed output that complies
with the ESCAP-RDTII methodology.

## Core principle
The ESCAP Round-1 database is a **reference dataset — not the authoritative source**. Official
legislation discovered during runtime is always authoritative. The database provides only context and
research hints. The final output represents **the current legal landscape**, not a reproduction of the
database.

## Primary objective — per seed row
1. Understand the context. 2. Identify country/pillar/indicator/topic. 3. Crawl the web for official
sources. 4. Validate whether the database is correct. 5. Detect amendments/repeals/newer versions.
6. Search beyond the referenced law for additional relevant regulations. 7. Extract exact statutory
provisions. 8. Map to the correct RDTII indicators. 9. Produce the 13-column ESCAP output.

## Guiding principles
Prioritise: legal accuracy · official sources · runtime crawling · independent validation · exact
citations · version verification · discovery of NEW provisions · complete traceability · transparency
over uncertainty. **Never fabricate** URLs, sections, articles, law numbers, gazette refs, amendment
dates, or verbatim text. If evidence cannot be verified — **flag it, don't invent it.**

## Functional modules (summary)
1. **Database Context Engine** — treat seed only as context, never as verified evidence.
2. **Independent Legal Discovery** — dynamically discover sources at runtime; don't reuse cached URLs.
3. **Validation Engine** — classify each provision VERIFIED / UPDATED / NEW / INVALID.
4. **Similar-Regulation Discovery** — keep crawling for additional in-scope instruments.
5. **Pillar-Aware Crawling** — expand searches via legal synonyms per pillar.
6. **Country-Aware Crawling** — prioritise `.gov` / parliament / gazette / AGC / ministry / regulator.
7. **Runtime Crawling Policy** — every output URL was discovered this session.
8. **PDF Analysis** — searchable/scanned/image-only; OCR when needed; classify Act/Regulation/Order/…
9. **Multilingual** — preserve original + English translation; never replace statutory wording.
10. **Legal Evidence Extraction** — exact wording/citation/article only; verbatim snippet only if retrieved.
11. **Version Validation** — check amendments/repeals/consolidations/commencement/effective dates.
12. **RDTII Indicator Mapping** — use only RDTII methodology numbering (P#-I#); flag conflicts.
13. **No-Regulation Detection** — absence → leave statutory fields blank, explain "no explicit provision".
14. **Confidence** — High (official retrieved+verified) / Medium (official but incomplete) / Low (metadata only).

## Source hierarchy
Official government → Gazette → Parliament → Attorney-General → Ministries → Regulators → National
legal databases → Official mirrors → Secondary commentary (context only). **Secondary sources are never
statutory evidence.**

## Discovery tags
- **VERIFIED** — database provision confirmed against current law.
- **UPDATED** — database provision corrected / amended / renumbered / consolidated.
- **NEW** — independently discovered provision not present in the database.
- **INVALID** — database provision obsolete, repealed, incorrectly cited, or incorrectly mapped.

## Multi-law / multi-indicator
- One row references several laws → validate each independently, one output row per provision, original order.
- One provision supports several indicators → duplicate the provision across indicators.

## Output — the 13-column ESCAP-RDTII template (exactly)
| Economy | Law Name | Law Number / Ref | Last Amended | Indicator ID | Article / Section | Discovery Tag | Location Reference | Verbatim Snippet | Mapping Rationale | Source URL | Confidence | Notes |

- **Location Reference** = originating Round-1 database row (e.g. `DB Row 43`) for full auditability.
- **Verbatim Snippet** = exact statutory text only; blank if unavailable from an official source.
- **Mapping Rationale** ≤ 300 chars: *"This [Section] requires/prohibits/permits/establishes… Maps to Indicator X because…"*
- **Confidence** = High / Medium / Low.
- **Notes** = validation findings, amendment history, version discrepancies, OCR/translation notes,
  reasons for UPDATED/INVALID, and why statutory text couldn't be retrieved.

## End-of-batch summary (per economy/pillar)
1. Confirmed provisions · 2. Updated provisions · 3. Newly discovered provisions · 4. Invalid/outdated
entries · 5. Outstanding issues (missing text, OCR limits, translation needs, unavailable sources).

## Final operating principle
AILA is an autonomous legal validation and discovery system, not a transcriber. Every output provision
must be independently discovered, validated, and supported by official sources obtained through live
crawling, while maintaining traceability to the originating database row. Legal accuracy, current
validity, and verifiable official sources always take precedence over reproducing the dataset.
