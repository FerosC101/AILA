// AI auto-classification of regulatory instruments via the Gemini API.
// Maps a scraped instrument onto the controlled vocabularies used by the dataset
// (the two pillars + the policy-focus taxonomy), so new sources can be tagged
// automatically instead of by hand.

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

  const prompt = `You classify digital-trade and data-governance legal instruments onto fixed vocabularies.
Pick ALL applicable values; if uncertain choose the closest. Use ONLY values from the lists.

PILLARS (choose 1-2): ${JSON.stringify(TAXONOMY.pillars)}
POLICY_FOCUS (choose 1-4): ${JSON.stringify(TAXONOMY.policyFocus)}

Instrument: ${input.instrument}
Jurisdiction: ${input.jurisdiction || "Unknown"}
Excerpt: ${(input.excerpt || "").replace(/\s+/g, " ").slice(0, 1500)}

Respond ONLY with JSON of shape:
{"pillars":[...],"policyFocus":[...],"coverage":"<short label e.g. Cross-cutting, Financial sector, Health data, Telecommunications>","rationale":"<one short sentence>"}`;

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
  const pillars = (parsed.pillars ?? []).filter((p: string) => TAXONOMY.pillars.includes(p));
  const policyFocus = (parsed.policyFocus ?? []).filter((p: string) => TAXONOMY.policyFocus.includes(p));

  return {
    pillars,
    policyFocus,
    coverage: typeof parsed.coverage === "string" ? parsed.coverage : "Cross-cutting",
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    model,
  };
}
