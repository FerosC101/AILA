// Group A: RDTII raw-score indicators whose score is a static, economy-level
// fact (multilateral treaty/commitment membership) rather than something read
// off a specific clause. Per the master prompt's rule 1: unverified cells
// return "NOT FOUND", never guessed.

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

/** Group A indicators this engine is authoritative for — everything else falls through to NOT FOUND. */
export const GROUP_A_INDICATOR_IDS = new Set(["P4-I4", "P1-I3", "P2-I4"]);

export function computeGroupAScore(economy: string, indicatorId: string): RawScore {
  if (!GROUP_A_INDICATOR_IDS.has(indicatorId)) return "NOT FOUND";
  return GROUP_A_FACTS[economy]?.[indicatorId]?.score ?? "NOT FOUND";
}