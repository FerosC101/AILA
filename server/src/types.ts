// Shared backend types. The frontend's contract lives in src/types/aila.ts;
// these mirror the relevant shapes and add the scraping layer.

export type ScrapeFormat = "html" | "pdf";
export type ScrapeCadence = "daily" | "weekly" | "monthly";

/**
 * One policy-level observation parsed from a markdown source table.
 * A single act can appear on several rows (one per pillar / policy focus),
 * so `id` is unique per row.
 */
export interface RegulationPolicy {
  id: string;
  jurisdiction: string;
  instrument: string;
  url: string;
  region: string;
  format: ScrapeFormat;
  cadence: ScrapeCadence;
  coverage?: string;
  timeframe?: string;
  pillar?: string;
  policyFocus?: string;
  notes?: string;
}

/**
 * A de-duplicated crawl target (one per unique URL), built from the policy rows.
 */
export interface RegulationSource {
  id: string;
  jurisdiction: string;
  instrument: string;
  url: string;
  region: string;
  format: ScrapeFormat;
  cadence: ScrapeCadence;
  notes?: string;
}

/** Result of scraping a single source URL. */
export interface ScrapeResult {
  sourceId: string;
  url: string;
  jurisdiction: string;
  instrument: string;
  ok: boolean;
  status: number;
  fetchedAt: string;
  title?: string;
  excerpt?: string;
  documentLinks?: string[];
  error?: string;
}
