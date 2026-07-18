// AUTO-GENERATED from CrawlerSeed_v2.xlsx — the OFFICIAL UN ESCAP RDTII indicator taxonomy.
// This is the ground-truth controlled vocabulary the classifier must map to.
// Regenerate if the seed changes; do not hand-edit indicator IDs.
//
// P1-I1/I2/I3, P2-I4, P4-I4/I7/I8, P5-I6, P9-I2, P12-I9..I13 added manually —
// present in the RDTII 2.1 scoring rules but missing from CrawlerSeed_v2.xlsx.
// Flag for the next seed regen so they get folded back into the auto-gen source.

export interface RdtiiIndicator { id: string; pillarId: number; pillar: string; focus: string; }

export const RDTII_PILLARS: Record<number, string> = {
  1: "Tariffs & trade defence",
  2: "Public procurement",
  3: "Foreign direct investment",
  4: "Intellectual property rights",
  5: "Telecom regulations and competition",
  6: "Cross-border data policies",
  7: "Domestic data protection & privacy",
  8: "Internet intermediary liability",
  9: "Content access",
  10: "Non-technical NTMs",
  11: "Standards & procedures",
  12: "Online sales & transactions",
};

export const RDTII_INDICATORS: RdtiiIndicator[] = [
  { id: "P1-I1", pillarId: 1, pillar: "Tariffs & trade defence", focus: "Effective tariffs" },
  { id: "P1-I2", pillarId: 1, pillar: "Tariffs & trade defence", focus: "No duty-free tariff lines" },
  { id: "P1-I3", pillarId: 1, pillar: "Tariffs & trade defence", focus: "Not in WTO Information Technology Agreement (ITA)" },
  { id: "P1-I4", pillarId: 1, pillar: "Tariffs & trade defence", focus: "Trade defence measures" },
  { id: "P2-I1", pillarId: 2, pillar: "Public procurement", focus: "Foreign exclusions" },
  { id: "P2-I2", pillarId: 2, pillar: "Public procurement", focus: "Specific requirements" },
  { id: "P2-I3", pillarId: 2, pillar: "Public procurement", focus: "Limitations in procurement bidding" },
  { id: "P2-I4", pillarId: 2, pillar: "Public procurement", focus: "Not in WTO Government Procurement Agreement (GPA)" },
  { id: "P3-I1", pillarId: 3, pillar: "Foreign direct investment", focus: "Foreign equity limits" },
  { id: "P3-I2", pillarId: 3, pillar: "Foreign direct investment", focus: "Joint venture requirements" },
  { id: "P3-I3", pillarId: 3, pillar: "Foreign direct investment", focus: "Nationality or residency requirements" },
  { id: "P3-I4", pillarId: 3, pillar: "Foreign direct investment", focus: "Investment screenings" },
  { id: "P3-I5", pillarId: 3, pillar: "Foreign direct investment", focus: "Commercial presence requirements" },
  { id: "P4-I1", pillarId: 4, pillar: "Intellectual property rights", focus: "Patent application issues" },
  { id: "P4-I2", pillarId: 4, pillar: "Intellectual property rights", focus: "Patent enforcement issues: civil/administrative/provisional remedies and measures" },
  { id: "P4-I3", pillarId: 4, pillar: "Intellectual property rights", focus: "Patent enforcement issues: others" },
  { id: "P4-I4", pillarId: 4, pillar: "Intellectual property rights", focus: "Not a member of the Patent Cooperation Treaty (PCT)" },
  { id: "P4-I5", pillarId: 4, pillar: "Intellectual property rights", focus: "Lack of copyright framework and exceptions" },
  { id: "P4-I6", pillarId: 4, pillar: "Intellectual property rights", focus: "Online copyright enforcement issues: civil/administrative/provisional remedies and measures" },
  { id: "P4-I7", pillarId: 4, pillar: "Intellectual property rights", focus: "Not a member of the WIPO Copyright Treaty (WCT)" },
  { id: "P4-I8", pillarId: 4, pillar: "Intellectual property rights", focus: "Not a member of the WIPO Performances and Phonograms Treaty (WPPT)" },
  { id: "P4-I9", pillarId: 4, pillar: "Intellectual property rights", focus: "Mandatory disclosure of trade secrets" },
  { id: "P4-I10", pillarId: 4, pillar: "Intellectual property rights", focus: "Lack of effective trade secrets legal framework" },
  { id: "P5-I1", pillarId: 5, pillar: "Telecom regulations and competition", focus: "Lack of passive infrastructure sharing" },
  { id: "P5-I2", pillarId: 5, pillar: "Telecom regulations and competition", focus: "Foreign equity limits in telecom sector" },
  { id: "P5-I3", pillarId: 5, pillar: "Telecom regulations and competition", focus: "Shares owned by the Government" },
  { id: "P5-I4", pillarId: 5, pillar: "Telecom regulations and competition", focus: "Lack of functional/accounting separation" },
  { id: "P5-I5", pillarId: 5, pillar: "Telecom regulations and competition", focus: "Licensing requirements in telecom sector" },
  { id: "P5-I6", pillarId: 5, pillar: "Telecom regulations and competition", focus: "Not appended to WTO Telecom Reference Paper" },
  { id: "P5-I7", pillarId: 5, pillar: "Telecom regulations and competition", focus: "Lack of independent telecom authority" },
  { id: "P6-I1", pillarId: 6, pillar: "Cross-border data policies", focus: "Ban & local processing requirements" },
  { id: "P6-I2", pillarId: 6, pillar: "Cross-border data policies", focus: "Local storage requirements" },
  { id: "P6-I3", pillarId: 6, pillar: "Cross-border data policies", focus: "Infrastructure requirements" },
  { id: "P6-I4", pillarId: 6, pillar: "Cross-border data policies", focus: "Conditional flow regimes" },
  { id: "P6-I5", pillarId: 6, pillar: "Cross-border data policies", focus: "Not in agreement with binding commitments on data transfer" },
  { id: "P7-I1", pillarId: 7, pillar: "Domestic data protection & privacy", focus: "Lack of comprehensive legal framework for data protection" },
  { id: "P7-I2", pillarId: 7, pillar: "Domestic data protection & privacy", focus: "Lack of dedicated legal framework for cybersecurity" },
  { id: "P7-I3", pillarId: 7, pillar: "Domestic data protection & privacy", focus: "Minimum period of data retention requirements" },
  { id: "P7-I4", pillarId: 7, pillar: "Domestic data protection & privacy", focus: "Data Protection Impact Assessment or Data Protection Officer requirements" },
  { id: "P7-I5", pillarId: 7, pillar: "Domestic data protection & privacy", focus: "Requirements to allow government access to personal data" },
  { id: "P8-I1", pillarId: 8, pillar: "Internet intermediary liability", focus: "Lack of safe harbor for copyright infringements" },
  { id: "P8-I2", pillarId: 8, pillar: "Internet intermediary liability", focus: "Lack of safe harbor for other illegal activities" },
  { id: "P8-I3", pillarId: 8, pillar: "Internet intermediary liability", focus: "User identity requirements" },
  { id: "P8-I4", pillarId: 8, pillar: "Internet intermediary liability", focus: "Monitoring requirements" },
  { id: "P9-I1", pillarId: 9, pillar: "Content access", focus: "Blocking/filtering" },
  { id: "P9-I2", pillarId: 9, pillar: "Content access", focus: "Internet shutdowns (V-Dem score)" },
  { id: "P9-I3", pillarId: 9, pillar: "Content access", focus: "Online advertising restrictions" },
  { id: "P9-I4", pillarId: 9, pillar: "Content access", focus: "Licensing requirements" },
  { id: "P10-I1", pillarId: 10, pillar: "Non-technical NTMs", focus: "Import bans" },
  { id: "P10-I2", pillarId: 10, pillar: "Non-technical NTMs", focus: "Other import restrictions" },
  { id: "P10-I3", pillarId: 10, pillar: "Non-technical NTMs", focus: "Local content requirements" },
  { id: "P10-I4", pillarId: 10, pillar: "Non-technical NTMs", focus: "Export restrictions" },
  { id: "P11-I1", pillarId: 11, pillar: "Standards & procedures", focus: "Technical standard issues" },
  { id: "P11-I2", pillarId: 11, pillar: "Standards & procedures", focus: "Self-certification limitations" },
  { id: "P11-I3", pillarId: 11, pillar: "Standards & procedures", focus: "Product screening & testing requirements" },
  { id: "P11-I4", pillarId: 11, pillar: "Standards & procedures", focus: "Encryption standard issues" },
  { id: "P12-I1", pillarId: 12, pillar: "Online sales & transactions", focus: "Foreign equity limits in e-commerce sector" },
  { id: "P12-I2", pillarId: 12, pillar: "Online sales & transactions", focus: "Online purchases and delivery limitations" },
  { id: "P12-I3", pillarId: 12, pillar: "Online sales & transactions", focus: "Licensing scheme for e-commerce providers (B2B and B2C)" },
  { id: "P12-I4", pillarId: 12, pillar: "Online sales & transactions", focus: "Online payment limitations" },
  { id: "P12-I5", pillarId: 12, pillar: "Online sales & transactions", focus: "Low De Minimis" },
  { id: "P12-I6", pillarId: 12, pillar: "Online sales & transactions", focus: "Imposition of custom duties on electronic transmission" },
  { id: "P12-I7", pillarId: 12, pillar: "Online sales & transactions", focus: "Domain name requirements" },
  { id: "P12-I8", pillarId: 12, pillar: "Online sales & transactions", focus: "Local presence requirements for online service providers" },
  { id: "P12-I9", pillarId: 12, pillar: "Online sales & transactions", focus: "Lack of online consumer protection framework" },
  { id: "P12-I10", pillarId: 12, pillar: "Online sales & transactions", focus: "Not signed/ratified UN Convention on Electronic Communications" },
  { id: "P12-I11", pillarId: 12, pillar: "Online sales & transactions", focus: "UNCITRAL Model Law on Electronic Commerce not adopted/notified" },
  { id: "P12-I12", pillarId: 12, pillar: "Online sales & transactions", focus: "UNCITRAL Model Law on Electronic Signatures not adopted/notified" },
  { id: "P12-I13", pillarId: 12, pillar: "Online sales & transactions", focus: "UNCITRAL Model Law [CONFIRM EXACT TITLE — see note below] not adopted/notified" },
];

const BY_ID = new Map(RDTII_INDICATORS.map((i) => [i.id, i]));
export const INDICATOR_IDS = RDTII_INDICATORS.map((i) => i.id);

/**
 * Normalize a candidate indicator id to the canonical "P#-I#" form before lookup.
 * Tolerates case ("p7-i2"), stray whitespace ("P7 - I2"), and the seed's
 * numeric dot form ("7.2" → "P7-I2"). Returns undefined if it can't be resolved
 * to a real id — never guesses.
 */
function normalizeIndicatorId(id: string): string | undefined {
  const raw = id.trim();
  if (BY_ID.has(raw)) return raw;
  const compact = raw.toUpperCase().replace(/\s+/g, "");
  const asPI = compact.replace(/^P?(\d+)[.\-_]?I?(\d+)$/, "P$1-I$2");
  if (BY_ID.has(asPI)) return asPI;
  return undefined;
}

export const isIndicatorId = (id: string): boolean => normalizeIndicatorId(id) !== undefined;
export const findIndicator = (id: string): RdtiiIndicator | undefined => {
  const norm = normalizeIndicatorId(id);
  return norm ? BY_ID.get(norm) : undefined;
};
export const pillarName = (pid: number): string => RDTII_PILLARS[pid] ?? String(pid);

const PILLAR_ID_BY_NAME = new Map(
  Object.entries(RDTII_PILLARS).map(([pid, name]) => [name.toLowerCase(), Number(pid)]),
);

// Common variant phrasings/shorthands seen in seed "Pillar" text → pillarId.
// Same closed-vocabulary approach as economy.ts's ECONOMY_ALIASES: only ever
// corrects known variants, never guesses. Keys matched case-insensitively.
const PILLAR_ALIASES: Record<string, number> = {
  "tariffs": 1, "trade defence": 1, "trade defense": 1, "tariffs and trade defence": 1,
  "public procurement": 2, "procurement": 2,
  "fdi": 3, "foreign direct investment": 3,
  "ip": 4, "ipr": 4, "intellectual property": 4, "intellectual property rights": 4,
  "telecom": 5, "telecoms": 5, "telecommunications": 5, "telecom regulations": 5,
  "telecommunications regulations and competition": 5,
  "cross-border data": 6, "cross border data": 6, "cross-border data policy": 6,
  "cross border data policies": 6, "data flows": 6,
  "data protection": 7, "privacy": 7, "domestic data protection": 7,
  "data protection and privacy": 7, "data protection & privacy": 7,
  "intermediary liability": 8, "internet intermediary liability": 8,
  "content": 9, "content access": 9,
  "ntms": 10, "non-technical ntms": 10, "non technical ntms": 10,
  "standards": 11, "standards and procedures": 11, "standards & procedures": 11,
  "e-commerce": 12, "ecommerce": 12, "online sales": 12, "online sales and transactions": 12,
};

/** Reverse lookup: pillar label (or number, or known alias) → pillarId, for rows that only supply a pillar name. */
export function findPillarIdByName(name: string | undefined | null): number | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (PILLAR_ID_BY_NAME.has(lower)) return PILLAR_ID_BY_NAME.get(lower);
  if (PILLAR_ALIASES[lower] != null) return PILLAR_ALIASES[lower];
  // Bare number or "P7" / "Pillar 7" form.
  const numMatch = lower.match(/^p(?:illar)?\.?\s*(\d{1,2})$|^(\d{1,2})$/);
  if (numMatch) {
    const n = Number(numMatch[1] ?? numMatch[2]);
    if (RDTII_PILLARS[n]) return n;
  }
  return undefined;
}