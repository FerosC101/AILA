// Just the Group A indicator-id set — split out from rawScore.ts so it can be a
// shared leaf dependency for both rawScore.ts (Group A scoring) and criteriaTable.ts
// (Group A/B overlap guard) without those two modules importing each other.
// See rawScore.ts's module-cycle note for why this file exists.

/** Group A indicators this engine is authoritative for — everything else falls through to NOT FOUND. */
export const GROUP_A_INDICATOR_IDS = new Set(["P4-I4", "P1-I3", "P2-I4"]);
