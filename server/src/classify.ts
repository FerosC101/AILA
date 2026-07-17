// AI auto-classification of regulatory instruments via the Gemini API.
// Maps an instrument onto the OFFICIAL UN ESCAP RDTII indicator taxonomy
// (P#-I# indicator IDs from CrawlerSeed_v2.xlsx — see indicators.ts).

import { RDTII_INDICATORS, isIndicatorId, findIndicator, type RdtiiIndicator } from "./indicators.js";
import { recordGeminiUsage } from "./cost.js";

// Legacy shim: kept so clause-level tagging (extract.ts / engine.ts) still compiles.
// Now derived from the REAL indicators — no more made-up DP-1 codes.
export const RDTII_CATEGORIES: Array<{ code: string; name: string }> =
  RDTII_INDICATORS.map((i) => ({ code: i.id, name: i.focus }));

// Compact catalog for the prompt, grouped by pillar.
const INDICATOR_CATALOG = RDTII_INDICATORS
  .map((i) => `${i.id} (P${i.pillarId} ${i.pillar}): ${i.focus}`)
  .join("\n");

export interface Classification {
  /** OFFICIAL RDTII indicator IDs (P#-I#) the instrument maps to. */
  indicators: RdtiiIndicator[];
  /** UI/back-compat alias: [{ code: indicatorId, name: focus }]. */
  rdtii: Array<{ code: string; name: string }>;
  pillars: string[];
  coverage: string;
  rationale: string;
  model: string;
}

export interface ClassifyInput {
  instrument: string;
  excerpt?: string;
  jurisdiction?: string;
}

export function classifierEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export async function classifyInstrument(input: ClassifyInput): Promise<Classification> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const prompt = `You map a digital-trade / data-governance legal instrument onto the OFFICIAL UN ESCAP RDTII indicator taxonomy.
Choose ONLY indicator IDs from the CATALOG below (verbatim, e.g. "P7-I2"). Pick 1-4 that the instrument actually addresses; if none clearly apply, return an empty list. Do NOT invent IDs.

RDTII INDICATOR CATALOG (id (Pillar): focus):
${INDICATOR_CATALOG}

Instrument: ${input.instrument}
Jurisdiction: ${input.jurisdiction || "Unknown"}
Excerpt: ${(input.excerpt || "").replace(/\s+/g, " ").slice(0, 1500)}

Respond ONLY with JSON of shape:
{"indicatorIds":["P#-I#", ...],"coverage":"<short label e.g. Cross-cutting, Financial sector, Health data, Telecommunications>","rationale":"<one short sentence citing which indicators and why>"}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  };

  // Gemini (AI Studio) keys authenticate via the ?key= query param.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
  const t = await res.text();
  if (res.status === 429) {
    console.error(`[Tag] Gemini rate limit reached (429) for model "${model}". ...`);
  } else {
    console.error(`[Tag] Gemini error ${res.status}:`, t.slice(0, 400));
  }
  // then either throw (classify/extract) or return undefined (simulate, which already degrades gracefully)
}
  const data: any = await res.json();
  recordGeminiUsage(model, data);
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Could not parse model output as JSON: ${text.slice(0, 200)}`);
  }

  // keep ONLY real indicator IDs that exist in the seed taxonomy (anti-hallucination)
  const ids: string[] = Array.isArray(parsed.indicatorIds) ? parsed.indicatorIds : [];
  const indicators: RdtiiIndicator[] = [...new Set(ids)]
    .filter((id) => typeof id === "string" && isIndicatorId(id))
    .map((id) => findIndicator(id)!)
    .slice(0, 6);

  const pillars = [...new Set(indicators.map((i) => i.pillar))];
  const rdtii = indicators.map((i) => ({ code: i.id, name: i.focus }));

  return {
    indicators,
    rdtii,
    pillars,
    coverage: typeof parsed.coverage === "string" ? parsed.coverage : "Cross-cutting",
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    model,
  };
}
