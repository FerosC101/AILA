// Official-UN-name normalization for the "Economy" column, and reverse pillar-name
// lookup to support pillar-only seed rows. Pure lookup tables — zero Gemini cost,
// zero hallucination risk, since this is a closed-vocabulary problem, not extraction.

// Canonical UN Economy names for the jurisdictions AILA currently tracks
// (server/sources/*.md). Extend as coverage grows.
const CANONICAL_ECONOMIES = [
  "Australia", "Brunei Darussalam", "Cambodia", "Indonesia",
  "Lao People's Democratic Republic", "Malaysia", "Myanmar", "Philippines",
  "Republic of Korea", "Singapore", "Thailand", "United States of America",
  "Viet Nam",
];

// Common variants → canonical. Keys are matched case-insensitively.
const ECONOMY_ALIASES: Record<string, string> = {
  // Australia
  "aus": "Australia",

  // Brunei Darussalam
  "brunei": "Brunei Darussalam",
  "bn": "Brunei Darussalam",

  // Cambodia
  "kampuchea": "Cambodia",
  "kh": "Cambodia",

  // Indonesia
  "republic of indonesia": "Indonesia",
  "idn": "Indonesia",

  // Lao People's Democratic Republic
  "laos": "Lao People's Democratic Republic",
  "lao pdr": "Lao People's Democratic Republic",

  // Malaysia
  "mys": "Malaysia",

  // Myanmar
  "burma": "Myanmar",
  "mm": "Myanmar",

  // Philippines
  "the philippines": "Philippines",
  "republic of the philippines": "Philippines",
  "ph": "Philippines",

  // Republic of Korea
  "south korea": "Republic of Korea",
  "korea": "Republic of Korea",
  "korea, republic of": "Republic of Korea",
  "korea (republic of)": "Republic of Korea",
  "rok": "Republic of Korea",

  // Singapore
  "republic of singapore": "Singapore",
  "sgp": "Singapore",

  // Thailand
  "kingdom of thailand": "Thailand",
  "siam": "Thailand",

  // United States of America
  "usa": "United States of America",
  "us": "United States of America",
  "u.s.": "United States of America",
  "u.s.a.": "United States of America",
  "united states": "United States of America",
  "america": "United States of America",

  // Viet Nam
  "vietnam": "Viet Nam",
  "viet nam": "Viet Nam",
  "vn": "Viet Nam",
  "socialist republic of vietnam": "Viet Nam",
};

const CANONICAL_BY_LOWER = new Map(CANONICAL_ECONOMIES.map((e) => [e.toLowerCase(), e]));

/**
 * Normalize a free-text economy string to its official UN name.
 * Returns the canonical name if recognized (exact or aliased), otherwise the
 * trimmed input unchanged — we never invent/guess an economy, only correct
 * known variants of ones we already track.
 */
export function normalizeEconomy(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  return CANONICAL_BY_LOWER.get(lower) ?? ECONOMY_ALIASES[lower] ?? trimmed;
}

export function isCanonicalEconomy(name: string): boolean {
  return CANONICAL_BY_LOWER.has(name.toLowerCase());
}