// AI auto-classification of regulatory instruments via the Gemini API.
// Maps a scraped instrument onto the controlled vocabularies used by the dataset
// (the two pillars + the policy-focus taxonomy), so new sources can be tagged
// automatically instead of by hand.

// UN ESCAP RDTII-aligned regulatory categories for digital trade & data governance.
// {code, name} pairs — codes follow the RDTII pillar groupings (DP=data, CB=cross-border,
// CS=cybersecurity, ET=e-transactions, CP=consumer, IP=IP, CO=competition, MA=market access).
// Reconcile `name` strings with the official RDTII codebook if a newer version is published.
export const RDTII_CATEGORIES: Array<{ code: string; name: string }> = [
  { code: "DP-1", name: "Personal data protection & privacy" },
  { code: "DP-2", name: "Sensitive / special-category data" },
  { code: "CB-1", name: "Cross-border data flows" },
  { code: "CB-2", name: "Data localization / residency" },
  { code: "CS-1", name: "Cybersecurity & critical information infrastructure" },
  { code: "CS-2", name: "Lawful access / government surveillance" },
  { code: "ET-1", name: "Electronic transactions & e-signatures" },
  { code: "ET-2", name: "Digital trade facilitation & paperless trade" },
  { code: "CP-1", name: "Online consumer protection" },
  { code: "CP-2", name: "Content regulation & intermediary liability" },
  { code: "IP-1", name: "Intellectual property in digital trade" },
  { code: "CO-1", name: "Competition & platform regulation" },
  { code: "MA-1", name: "Market access & digital taxation/tariffs" },
  { code: "FN-1", name: "Digital payments & fintech" },
];
const RDTII_NAMES = RDTII_CATEGORIES.map((c) => c.name);

const TAXONOMY = {
  pillars: [
    "Cross-border data policies",
    "Domestic data protection & privacy",
  ],
  policyFocus: [
    "Lack of dedicated legal framework for cybersecurity",
    "Lack of comprehensive legal framework for data protection",
    "Requirements to allow government access to personal data",
    "Minimum period of data retention requirements",
    "Data Protection Impact Assessment or Data Protection Officer requirements",
    "Local storage requirements",
    "Ban & local processing requirements",
    "Infrastructure requirements",
    "Conditional flow regimes",
    "Not in agreement with binding commitments on data transfer",
  ],
};

export interface Classification {
  rdtii: Array<{ code: string; name: string }>;
  pillars: string[];
  policyFocus: string[];
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

  const prompt = `You classify digital-trade and data-governance legal instruments onto fixed UN ESCAP RDTII vocabularies.
Pick ALL applicable values; if uncertain choose the closest. Use ONLY values from the lists (verbatim).

RDTII_CATEGORIES (choose 1-4, by name): ${JSON.stringify(RDTII_NAMES)}
PILLARS (choose 1-2): ${JSON.stringify(TAXONOMY.pillars)}
POLICY_FOCUS (choose 1-4): ${JSON.stringify(TAXONOMY.policyFocus)}

Instrument: ${input.instrument}
Jurisdiction: ${input.jurisdiction || "Unknown"}
Excerpt: ${(input.excerpt || "").replace(/\s+/g, " ").slice(0, 1500)}

Respond ONLY with JSON of shape:
{"rdtii":[...category names...],"pillars":[...],"policyFocus":[...],"coverage":"<short label e.g. Cross-cutting, Financial sector, Health data, Telecommunications>","rationale":"<one short sentence>"}`;

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
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 400)}`);
  }
  const data: any = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Could not parse model output as JSON: ${text.slice(0, 200)}`);
  }

  // keep only values that are actually in the taxonomy
  const rdtii = (parsed.rdtii ?? [])
    .map((name: string) => RDTII_CATEGORIES.find((c) => c.name === name))
    .filter((c: unknown): c is { code: string; name: string } => !!c);
  const pillars = (parsed.pillars ?? []).filter((p: string) => TAXONOMY.pillars.includes(p));
  const policyFocus = (parsed.policyFocus ?? []).filter((p: string) => TAXONOMY.policyFocus.includes(p));

  return {
    rdtii,
    pillars,
    policyFocus,
    coverage: typeof parsed.coverage === "string" ? parsed.coverage : "Cross-cutting",
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    model,
  };
}
