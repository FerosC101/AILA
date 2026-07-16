// Source authority classification — is a URL an OFFICIAL government / IGO publisher
// (a PRIMARY, authoritative legal source) or a SECONDARY source (legal database,
// academic, news, NGO, web archive)? Drives the primary/secondary rule: prefer
// primary sources; treat secondary sources as supporting evidence only.

export type AuthorityTier = "primary" | "secondary";
export type DomainType =
  | "government" | "international" | "legal-database" | "academic" | "news" | "ngo" | "archive" | "other";

export interface SourceAuthority {
  official: boolean;     // published by a government or inter-governmental organisation
  tier: AuthorityTier;   // primary = authoritative source of law; secondary = commentary/mirror
  domainType: DomainType;
  domain: string;
  reason: string;
}

// Government hostname patterns (national official publishers).
const GOV_PATTERNS: RegExp[] = [
  /(^|\.)gov(\.[a-z]{2})?$/,   // gov, gov.uk, gov.my, gov.sg, gov.ph, gov.au …
  /(^|\.)go\.[a-z]{2}$/,       // go.th, go.jp, go.id, go.kr
  /(^|\.)gob\.[a-z]{2}$/,      // gob.mx, gob.es (Spanish-speaking)
  /(^|\.)gouv\.[a-z]{2}$/,     // gouv.fr
  /(^|\.)gc\.ca$/,             // Canada
  /(^|\.)govt\.nz$/,           // New Zealand
  /(^|\.)mil(\.[a-z]{2})?$/,   // military
];

// Inter-governmental / official international organisations (official, supranational).
const INTL_HOSTS = new Set([
  "un.org", "unescap.org", "escap.un.org", "uncitral.un.org", "unctad.org",
  "wto.org", "wipo.int", "oecd.org", "worldbank.org", "imf.org",
  "asean.org", "apec.org", "wcoomd.org", "itu.int", "who.int",
]);
const INTL_PATTERNS: RegExp[] = [/(^|\.)int$/, /(^|\.)europa\.eu$/, /(^|\.)un\.org$/];

// Known legal databases / mirrors — authoritative-adjacent but SECONDARY.
const LEGAL_DB_HOSTS = new Set([
  "austlii.edu.au", "worldlii.org", "asianlii.org", "commonlii.org",
  "cyrilla.org", "lawnet.sg", "wipolex.wipo.int", "faolex.fao.org",
]);

const NEWS_HINTS = /(^|\.)(reuters|bloomberg|bbc|cnn|nytimes|straitstimes|bangkokpost|thejakartapost|scmp|channelnewsasia)\./;

function hostname(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

/** Classify the authority of a source URL. */
export function classifyAuthority(url: string): SourceAuthority {
  const host = hostname(url);
  const mk = (official: boolean, tier: AuthorityTier, domainType: DomainType, reason: string): SourceAuthority =>
    ({ official, tier, domainType, domain: host, reason });

  if (!host) return mk(false, "secondary", "other", "Unparseable URL");

  if (host === "web.archive.org" || host === "archive.org" || host.endsWith(".archive.org"))
    return mk(false, "secondary", "archive", "Internet Archive snapshot (mirror of original)");

  if (GOV_PATTERNS.some((re) => re.test(host)))
    return mk(true, "primary", "government", "Official government domain");

  if (INTL_HOSTS.has(host) || INTL_PATTERNS.some((re) => re.test(host)))
    return mk(true, "primary", "international", "Inter-governmental organisation");

  if (LEGAL_DB_HOSTS.has(host) || /(^|\.)lii\./.test(host))
    return mk(false, "secondary", "legal-database", "Legal database / mirror (not the official publisher)");

  if (/(^|\.)(edu|ac)(\.[a-z]{2})?$/.test(host))
    return mk(false, "secondary", "academic", "Academic institution");

  if (NEWS_HINTS.test(host))
    return mk(false, "secondary", "news", "News / media outlet");

  if (host.endsWith(".org"))
    return mk(false, "secondary", "ngo", "Non-governmental / .org publisher");

  return mk(false, "secondary", "other", "Non-official source");
}

/** Given several candidate sources for the same instrument, prefer the primary (official) one. */
export function preferPrimary<T extends { url: string }>(candidates: T[]): { primary?: T; secondary: T[] } {
  const scored = candidates.map((c) => ({ c, a: classifyAuthority(c.url) }));
  const primary = scored.find((s) => s.a.tier === "primary")?.c;
  const secondary = scored.filter((s) => s.c !== primary).map((s) => s.c);
  return { primary, secondary };
}
