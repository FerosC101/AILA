// Shared prompt rule-blocks encoding the AILA v5 methodology (see docs/AILA-v5-methodology.md).
// Injected into generation prompts so every LLM step follows the same legal-integrity rules.

/** Official-source-first ordering (v5 "Source Hierarchy"). */
export const SOURCE_HIERARCHY = `SOURCE HIERARCHY (prefer higher):
1. Official government websites  2. Official Gazette  3. Parliament  4. Attorney-General
5. Ministries  6. Regulators  7. National legal databases  8. Official legal mirrors (AustLII, WorldLII, Singapore Statutes Online, Laws of Malaysia)  9. Secondary commentary (context ONLY — never as statutory evidence).`;

/** Anti-fabrication / verbatim-only rules (v5 "Guiding Principles" + "Core Extraction Rules"). */
export const NO_FABRICATION = `LEGAL-INTEGRITY RULES:
- Extract ONLY exact statutory wording, exact citations, and exact article/section numbers.
- NEVER paraphrase, summarise, reconstruct, or invent legal text, URLs, section numbers, law numbers, gazette refs, or amendment dates.
- Populate a verbatim snippet ONLY when official statutory language was directly retrieved; otherwise leave it blank and flag it.
- If evidence cannot be verified, FLAG the entry rather than inventing it. Transparency over uncertainty.`;

/** RDTII indicator-mapping discipline (v5 "RDTII Indicator Mapping"). */
export const INDICATOR_RULES = `INDICATOR MAPPING: use ONLY real RDTII indicator IDs in the P#-I# form (e.g. P6-I1, P7-I2) from the supplied catalog. If a provision genuinely supports several indicators, list each. If none genuinely apply, return none — do not stretch a citation to fit.
IMPORTANT: an indicator's focus text names the regulatory MEASURE/TOPIC being assessed (often phrased as a potential gap or restriction, e.g. "Lack of comprehensive framework", "Ban & local processing"). A provision maps to an indicator when it is EVIDENCE ABOUT that measure — whether it establishes, imposes, permits, or removes it. Do NOT tag a provision INVALID merely because it shows the measure EXISTS while the focus is phrased as its absence (e.g. a law that DOES provide a data-protection framework still maps to the "comprehensive framework" indicator). That is a VERIFIED mapping — record the direction in the mapping rationale, not by rejecting the map.
For indicators with a numbered criteria list, criterionMatch is mandatory when discoveryTag is VERIFIED or UPDATED. Do not describe the direction only in mappingRationale — you MUST select the matching tier number. If uncertain between two tiers, choose the lower-severity one and flag the ambiguity in notes.`;

/** The Discovery-Tag vocabulary (v5 Module 3 + "Discovery Tag"). */
export const DISCOVERY_TAGS = `DISCOVERY TAG — classify each provision against the seed database row:
- VERIFIED: the seed correctly references the current law/section.
- UPDATED: the law exists but has newer amendments, revised wording, renumbered sections, or consolidation.
- NEW: a provision/instrument you independently discovered that satisfies the same indicator but is not in the seed.
- INVALID: the seed provision is repealed, superseded, obsolete, incorrectly cited, or incorrectly mapped (explain why).`;


export const METADATA_RULES = `INSTRUMENT METADATA RULES:
- lastAmended: the most recent LEGALLY EFFECTIVE amendment only. Ignore proposed amendments and draft bills entirely — they are not "amendments" until in force. If the instrument has never been amended, return exactly "Original Version". Return a year or an official amendment reference (e.g. "Act 709 (2020 Amendment)"), never a full sentence.
- coverage: the sectoral/subject-matter scope. Return "Cross-cutting" ONLY when the text itself states or clearly implies the instrument applies broadly (e.g. "applies to all sectors", "any person", no sectoral limitation stated) — do NOT use "Cross-cutting" as a default guess when scope is simply unclear. If scope cannot be determined from the text, return null and flag it in notes.
- timeframe: the instrument's own temporal scope as stated (e.g. "Since 2023"). Do NOT restate the lastAmended value inside timeframe — they are separate fields; keep timeframe to the ENACTMENT/effective date context only.`;