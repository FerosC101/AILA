// Group A: RDTII raw-score indicators whose score is a static, economy-level
// fact (multilateral treaty/commitment membership) rather than something read
// off a specific clause. Per the master prompt's rule 1: unverified cells
// return "NOT FOUND", never guessed.
//
// Group B (see computeGroupBScore below): indicators scored via criteriaTable.ts's
// discrete tiers, converted from the criterionMatch tier number validate.ts's
// Gemini pipeline already selected and validated (see validate.ts Phase 1).
//
// MODULE CYCLE, RESOLVED: criteriaTable.ts needs the Group A id set (for its own
// Group A/B overlap guard) and this module needs criteriaTable.ts's findCriteria
// (for computeGroupBScore) — a direct two-way import would be circular. Broken by
// extracting GROUP_A_INDICATOR_IDS into its own leaf module (groupAIds.ts) that
// neither of these two files needs anything back from. Dependency graph is now a
// strict DAG: groupAIds.ts <- rawScore.ts -> criteriaTable.ts -> groupAIds.ts.
// No cycle, so this import is a normal static one and computeGroupBScore below is
// fully synchronous — no fire-and-forget dynamic import, no startup race window.
import { GROUP_A_INDICATOR_IDS } from "./groupAIds.js";
import { findCriteria } from "./criteriaTable.js";

export type RawScore = number | "NOT FOUND";

interface FactEntry {
  score: RawScore;
  note: string;     // audit trail: what's confirmed, what's still open
  source: string;
  verifiedAt: string; // YYYY-MM-DD
}

// economy -> indicatorId -> fact
export const GROUP_A_FACTS: Record<string, Record<string, FactEntry>> = {
  "Australia":   { "P4-I4": pct(0), "P1-I3": ita("neither-unresolved"), "P2-I4": gpaParty() },
  "Brunei Darussalam": { "P4-I4": pct(0), "P1-I3": ita("neither"), "P2-I4": gpaNonParty() },
  "Cambodia":    { "P4-I4": pct(0), "P1-I3": ita("neither"), "P2-I4": gpaNonParty() },
  "Indonesia":   { "P4-I4": pct(0), "P1-I3": ita("neither-unresolved"), "P2-I4": gpaNonParty() },
  "Lao People's Democratic Republic": { "P4-I4": pct(0), "P1-I3": ita("neither"), "P2-I4": gpaNonParty() },
  "Malaysia":    { "P4-I4": pct(0), "P1-I3": ita("neither-unresolved"), "P2-I4": gpaNonParty() },
  "Myanmar":     { "P4-I4": pct(1), "P1-I3": ita("neither"), "P2-I4": gpaNonParty() },
  "Philippines": { "P4-I4": pct(0), "P1-I3": ita("neither-unresolved"), "P2-I4": gpaNonParty() },
  "Republic of Korea": { "P4-I4": pct(0), "P1-I3": ita("neither-unresolved"), "P2-I4": gpaParty() },
  "Singapore":   { "P4-I4": pct(0), "P1-I3": ita("neither-unresolved"), "P2-I4": gpaParty() },
  "Thailand":    { "P4-I4": pct(0), "P1-I3": ita("neither-unresolved"), "P2-I4": gpaNonParty() },
  "United States of America": { "P4-I4": pct(0), "P1-I3": ita("neither-unresolved"), "P2-I4": gpaParty() },
  "Viet Nam":    { "P4-I4": pct(0), "P1-I3": ita("neither-unresolved"), "P2-I4": gpaNonParty() },
};

function pct(score: 0 | 1): FactEntry {
  return {
    score,
    note: score === 1 ? "Not a PCT contracting state." : "PCT contracting state.",
    source: "WIPO PCT Contracting States list",
    verifiedAt: "2026-07-18",
  };
}

// ITA I confirmed for 9/13 economies; ITA II (2015 expansion) status not yet
// checked for any of them, so the true 0/0.5 split is unresolved. The 4 with
// no ITA I membership at all resolve cleanly to 1 ("neither").
function ita(state: "neither" | "neither-unresolved"): FactEntry {
  if (state === "neither") {
    return { score: 1, note: "Not an ITA I participant.", source: "WTO ITA Participants (G/IT/1/Rev.60)", verifiedAt: "2026-07-18" };
  }
  return { score: "NOT FOUND", note: "ITA I confirmed; ITA II (Expansion) membership not yet verified — needed to resolve 0 vs 0.5.", source: "WTO ITA Participants (G/IT/1/Rev.60)", verifiedAt: "2026-07-18" };
}

function gpaNonParty(): FactEntry {
  return { score: 1, note: "Not a GPA party (some are observers only).", source: "WTO GPA Parties list / USTR GPA page", verifiedAt: "2026-07-18" };
}
function gpaParty(): FactEntry {
  return { score: "NOT FOUND", note: "Confirmed GPA party; ICT-service coverage tier in its Annex not yet checked — needed to resolve 0 vs 0.5.", source: "WTO GPA Parties list", verifiedAt: "2026-07-18" };
}

export function computeGroupAScore(economy: string, indicatorId: string): RawScore {
  if (!GROUP_A_INDICATOR_IDS.has(indicatorId)) return "NOT FOUND";
  return GROUP_A_FACTS[economy]?.[indicatorId]?.score ?? "NOT FOUND";
}

/**
 * Group B: convert a validated criterionMatch tier number into its score via
 * criteriaTable.ts. Never guesses — returns "NOT FOUND" whenever criterionMatch
 * is absent, the indicator has no criteria table, or the tier number doesn't
 * resolve to a real tier (defensive backstop only; validate.ts's Phase 1 already
 * discards any tier that doesn't exist for the indicator before this is ever called).
 */
export function computeGroupBScore(indicatorId: string, criterionMatch: number | null | undefined): RawScore {
  if (criterionMatch == null) return "NOT FOUND";

  // P12-I4 sub-check id form ("P12-I4.3") — look up within subCriteria using the
  // methodology's own 2-tier convention for each sub-check: 1 = measure present
  // (restrictive), 2 = no restriction (score 0). Nothing in the current pipeline
  // produces this id shape yet (validate.ts only ever emits bare P#-I# ids), but
  // handle it defensively rather than let it silently fall through to NOT FOUND.
  const subMatch = indicatorId.match(/^(P\d+-I\d+)\.(\d+)$/i);
  if (subMatch) {
    const [, base, subNum] = subMatch;
    const criteria = findCriteria(base);
    if (!criteria?.subCriteria?.length) return "NOT FOUND";
    const parts = base.match(/^P(\d+)-I(\d+)$/i);
    if (!parts) return "NOT FOUND";
    const expectedId = `${parts[1]}.${parts[2]}.${subNum}`;
    const sub = criteria.subCriteria.find((s) => s.id === expectedId);
    if (!sub) return "NOT FOUND";
    if (criterionMatch === 1) return sub.score;
    if (criterionMatch === 2) return 0;
    return "NOT FOUND";
  }

  const criteria = findCriteria(indicatorId);
  if (!criteria) return "NOT FOUND";
  // subCriteria/aggregation-based indicators (bare "P12-I4") have no single tier
  // scale of their own — only their individual sub-checks (handled above) do.
  if (!criteria.tiers?.length) return "NOT FOUND";

  const tier = criteria.tiers.find((t) => t.tier === criterionMatch);
  return tier?.score ?? "NOT FOUND";
}