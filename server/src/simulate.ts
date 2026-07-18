// Compliance "digital twin" — runs what-if scenarios against the real policy
// dataset (server/sources/*.md) and returns a per-jurisdiction assessment.

import { loadPolicies } from "./sources.js";
import { classifierEnabled } from "./classify.js";
import { recordGeminiUsage } from "./cost.js";

export interface SimScenario {
  businessType?: string;
  dataCategories?: string[];      // e.g. ["Personal","Health / Sensitive","Financial","Biometric"]
  storageRegion?: string;         // e.g. "In-country", "AWS Singapore", "AWS US", "EU"
  targetJurisdictions: string[];  // country names, must match dataset
  crossBorderTransfer?: boolean;
  controls?: { consent?: boolean; dpa?: boolean; encryption?: boolean; localCopy?: boolean };
  explain?: boolean;              // ask Gemini for a narrative summary
}

export type Verdict = "permitted" | "conditional" | "restricted";

export interface JurisdictionResult {
  jurisdiction: string;
  flag: string;
  verdict: Verdict;
  score: number;        // 0-100 readiness (higher = lower friction/risk)
  friction: "Low" | "Medium" | "High";
  obligations: string[];
  risks: string[];
  instruments: Array<{ instrument: string; url: string; pillar?: string }>;
}

export interface SimulationResult {
  scenario: SimScenario;
  overall: { verdict: Verdict; score: number; summary: string };
  jurisdictions: JurisdictionResult[];
  narrative?: string;
  generatedAt: string;
}

const FLAG: Record<string, string> = {
  Singapore: "🇸🇬", Malaysia: "🇲🇾", Thailand: "🇹🇭", Philippines: "🇵🇭",
  Indonesia: "🇮🇩", Vietnam: "🇻🇳", Australia: "🇦🇺", ASEAN: "🌏",
};

// policy-focus → friction weight + the obligation it implies
const FOCUS: Record<string, { weight: number; obligation: string; localizing?: boolean; conditional?: boolean }> = {
  "Ban & local processing requirements": { weight: 5, obligation: "Process regulated data domestically — offshore processing may be prohibited", localizing: true },
  "Local storage requirements": { weight: 4, obligation: "Keep an in-country copy of regulated data (data residency)", localizing: true },
  "Infrastructure requirements": { weight: 3, obligation: "Meet local infrastructure / data-centre requirements", localizing: true },
  "Conditional flow regimes": { weight: 2, obligation: "Transfer only via an approved mechanism (consent, adequacy, or contractual safeguards)", conditional: true },
  "Not in agreement with binding commitments on data transfer": { weight: 2, obligation: "No binding treaty guarantee — rely on domestic transfer rules", conditional: true },
  "Requirements to allow government access to personal data": { weight: 2, obligation: "Provide lawful-access mechanisms for competent authorities" },
  "Data Protection Impact Assessment or Data Protection Officer requirements": { weight: 1, obligation: "Conduct a DPIA and appoint a Data Protection Officer" },
  "Minimum period of data retention requirements": { weight: 1, obligation: "Retain records for the statutory minimum period" },
  "Lack of comprehensive legal framework for data protection": { weight: 1, obligation: "Apply heightened internal safeguards — statutory protection is limited" },
  "Lack of dedicated legal framework for cybersecurity": { weight: 1, obligation: "Adopt voluntary security baselines — no dedicated cyber statute" },
};

const norm = (s: string) => s.trim().toLowerCase();
const isOffshore = (region?: string) =>
  !!region && !/in[-\s]?country|local|domestic|on[-\s]?prem/i.test(region);
const isSensitive = (cats?: string[]) =>
  (cats ?? []).some((c) => /health|sensitive|biometric|genetic/i.test(c));

function assessJurisdiction(jur: string, s: SimScenario): JurisdictionResult {
  const rows = loadPolicies().filter((p) => norm(p.jurisdiction) === norm(jur));
  const focuses = [...new Set(rows.map((r) => r.policyFocus).filter((f): f is string => !!f))];

  const offshore = isOffshore(s.storageRegion);
  const sensitive = isSensitive(s.dataCategories);
  const c = s.controls ?? {};

  let friction = 0;
  let hasLocalizing = false;
  let hasConditional = false;
  const obligations: string[] = [];
  for (const f of focuses) {
    const meta = FOCUS[f];
    if (!meta) continue;
    // cross-border focuses only bite when there's an actual cross-border transfer
    if ((meta.localizing || meta.conditional) && !s.crossBorderTransfer && !offshore) continue;
    friction += meta.weight;
    if (meta.localizing) hasLocalizing = true;
    if (meta.conditional) hasConditional = true;
    obligations.push(meta.obligation);
  }

  // risk multipliers and control mitigations
  let risk = friction * (sensitive ? 1.4 : 1) * (s.crossBorderTransfer || offshore ? 1.2 : 1);
  const mitigation = (c.consent ? 0.85 : 1) * (c.dpa ? 0.85 : 1) * (c.encryption ? 0.9 : 1) * (c.localCopy ? 0.75 : 1);
  risk *= mitigation;

  // verdict
  let verdict: Verdict;
  if (hasLocalizing && (s.crossBorderTransfer || offshore) && !c.localCopy) verdict = "restricted";
  else if (hasLocalizing || hasConditional) verdict = "conditional";
  else verdict = "permitted";
  // controls can soften a restriction
  if (verdict === "restricted" && c.consent && c.dpa && c.localCopy) verdict = "conditional";

  const risks: string[] = [];
  if (sensitive) risks.push("Sensitive/health data attracts stricter scrutiny and higher penalties");
  if (offshore && hasLocalizing) risks.push(`Offshore storage (${s.storageRegion}) conflicts with local residency rules`);
  if (s.crossBorderTransfer && hasConditional && !c.consent) risks.push("Cross-border transfer without a documented lawful basis");
  if (!c.dpa && (s.crossBorderTransfer || offshore)) risks.push("No Data Processing Agreement with the offshore processor");
  if (!c.encryption && sensitive) risks.push("Sensitive data not marked encrypted at rest/in transit");

  const score = Math.max(8, Math.min(100, Math.round(100 - risk * 6)));
  const frictionBand: JurisdictionResult["friction"] = score >= 75 ? "Low" : score >= 50 ? "Medium" : "High";

  // a few real instruments backing this jurisdiction
  const seen = new Set<string>();
  const instruments = rows
    .filter((r) => { if (seen.has(r.url)) return false; seen.add(r.url); return true; })
    .slice(0, 5)
    .map((r) => ({ instrument: r.instrument, url: r.url, pillar: r.pillar }));

  return {
    jurisdiction: jur, flag: FLAG[jur] ?? "🏛️", verdict, score, friction: frictionBand,
    obligations: [...new Set(obligations)], risks, instruments,
  };
}

const VERDICT_RANK: Record<Verdict, number> = { permitted: 0, conditional: 1, restricted: 2 };

export async function runSimulation(scenario: SimScenario): Promise<SimulationResult> {
  const jurisdictions = (scenario.targetJurisdictions ?? []).map((j) => assessJurisdiction(j, scenario));

  const worst = jurisdictions.reduce<Verdict>(
    (acc, j) => (VERDICT_RANK[j.verdict] > VERDICT_RANK[acc] ? j.verdict : acc),
    "permitted",
  );
  const avg = jurisdictions.length
    ? Math.round(jurisdictions.reduce((a, j) => a + j.score, 0) / jurisdictions.length)
    : 0;

  const restricted = jurisdictions.filter((j) => j.verdict === "restricted").map((j) => j.jurisdiction);
  const conditional = jurisdictions.filter((j) => j.verdict === "conditional").map((j) => j.jurisdiction);
  const summary =
    worst === "restricted"
      ? `Restricted in ${restricted.join(", ")} — local residency/processing rules conflict with this setup.`
      : worst === "conditional"
        ? `Permitted with conditions across ${conditional.join(", ") || "target markets"} — safeguards required before transfer.`
        : "Broadly permitted across the selected jurisdictions under standard safeguards.";

  const result: SimulationResult = {
    scenario,
    overall: { verdict: worst, score: avg, summary },
    jurisdictions,
    generatedAt: new Date().toISOString(),
  };

  if (scenario.explain && classifierEnabled()) {
    result.narrative = await narrate(result).catch(() => undefined);
  }
  return result;
}

/** Optional Gemini narrative of the scenario outcome. */
async function narrate(r: SimulationResult): Promise<string | undefined> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return undefined;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const s = r.scenario;
  const facts = r.jurisdictions
    .map((j) => `${j.jurisdiction}: ${j.verdict} (score ${j.score}); obligations: ${j.obligations.join("; ") || "none"}`)
    .join("\n");
  const prompt = `You are a regulatory compliance analyst. In 3-4 sentences, summarise this cross-border data scenario for a business reader. Be concrete and neutral; do not invent rules beyond the facts.

Business: ${s.businessType || "unspecified"}
Data: ${(s.dataCategories || []).join(", ") || "unspecified"}
Storage: ${s.storageRegion || "unspecified"}
Cross-border transfer: ${s.crossBorderTransfer ? "yes" : "no"}
Controls in place: ${Object.entries(s.controls || {}).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"}

Per-jurisdiction outcome:
${facts}`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3 } }),
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
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

/**
 * Parse a free-text scenario ("I run a health-tech app storing Filipino patient
 * data on AWS Singapore…") into a structured SimScenario. Uses Gemini when
 * available, then validates everything against the dataset-derived option lists.
 */
export async function parseScenario(text: string): Promise<SimScenario> {
  const opts = simulationOptions();
  const lc = text.toLowerCase();

  // Heuristic extraction (also the no-key fallback): scan for known values.
  const heuristic = (): SimScenario => ({
    businessType: undefined,
    dataCategories: opts.dataCategories.filter((c) => c.split(/[\s/]+/).some((w) => w.length > 3 && lc.includes(w.toLowerCase()))),
    storageRegion: opts.storageRegions.find((r) => lc.includes(r.toLowerCase()))
      ?? (/\b(offshore|abroad|overseas|aws|azure|google cloud|us|europe|eu)\b/i.test(text) ? "Self-hosted (offshore)" : "In-country"),
    targetJurisdictions: opts.jurisdictions.filter((j) => lc.includes(j.toLowerCase())),
    crossBorderTransfer: /\b(cross[-\s]?border|transfer|offshore|abroad|overseas|export)\b/i.test(text),
    controls: {
      consent: /\bconsent\b/i.test(text), dpa: /\b(dpa|data processing agreement)\b/i.test(text),
      encryption: /\bencrypt/i.test(text), localCopy: /\b(local copy|in[-\s]?country copy|data residency|local storage)\b/i.test(text),
    },
  });

  let scenario = heuristic();

  const key = process.env.GEMINI_API_KEY;
  if (key) {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const prompt = `Extract a structured compliance scenario from the DESCRIPTION. Return ONLY JSON:
{"businessType": string|null, "dataCategories": string[], "storageRegion": string, "targetJurisdictions": string[], "crossBorderTransfer": boolean, "controls": {"consent":bool,"dpa":bool,"encryption":bool,"localCopy":bool}}
Rules:
- targetJurisdictions: ONLY values from ${JSON.stringify(opts.jurisdictions)} (countries the data concerns/operates in).
- dataCategories: ONLY values from ${JSON.stringify(opts.dataCategories)}.
- storageRegion: the closest single value from ${JSON.stringify(opts.storageRegions)}.
- crossBorderTransfer: true if data leaves the target country's borders.
- controls: true only if the description says the business already has it; else false.
DESCRIPTION: ${text}`;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
      });
      if (res.ok) {
        const data: any = await res.json();
        recordGeminiUsage(model, data);
        const p = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
        scenario = {
          businessType: typeof p.businessType === "string" ? p.businessType : undefined,
          dataCategories: Array.isArray(p.dataCategories) ? p.dataCategories.filter((c: any) => opts.dataCategories.includes(c)) : scenario.dataCategories,
          storageRegion: opts.storageRegions.includes(p.storageRegion) ? p.storageRegion : scenario.storageRegion,
          targetJurisdictions: Array.isArray(p.targetJurisdictions) ? p.targetJurisdictions.filter((j: any) => opts.jurisdictions.includes(j)) : scenario.targetJurisdictions,
          crossBorderTransfer: typeof p.crossBorderTransfer === "boolean" ? p.crossBorderTransfer : scenario.crossBorderTransfer,
          controls: {
            consent: !!p.controls?.consent, dpa: !!p.controls?.dpa,
            encryption: !!p.controls?.encryption, localCopy: !!p.controls?.localCopy,
          },
        };
      }
    } catch { /* keep heuristic */ }
  }

  // Guarantees for a runnable scenario.
  if (!scenario.targetJurisdictions?.length) scenario.targetJurisdictions = opts.jurisdictions.slice(0, 3);
  if (!scenario.dataCategories?.length) scenario.dataCategories = ["Personal"];
  return scenario;
}

/** Form options derived from the dataset. */
export function simulationOptions() {
  const jurisdictions = [...new Set(loadPolicies().map((p) => p.jurisdiction))]
    .filter((j) => FLAG[j]) // concrete countries only (skip WTO/OECD/etc.)
    .sort();
  return {
    jurisdictions,
    dataCategories: ["Personal", "Health / Sensitive", "Financial", "Biometric", "Employment", "Children's data"],
    storageRegions: ["In-country", "AWS Singapore", "AWS US", "Google Cloud EU", "Azure Australia", "Self-hosted (offshore)"],
    controls: ["consent", "dpa", "encryption", "localCopy"],
  };
}
