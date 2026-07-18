// Cross-border transfer comparison — derived live from the DB (validations + clauses),
// replacing the frontend's hardcoded ASEAN_TRANSFER_RULES. For each ASEAN economy we
// gather its cross-border-transfer provisions, infer a friction level from real signals
// (localization / approval / safeguard language), and emit citation-ready conditions.

import { loadValidations, loadClauses, type ValidationRow, type StoredClause } from "./db.js";

export type Friction = "Low" | "Medium" | "High";
export interface TransferCitation { instrument: string; section: string; note?: string }
export interface TransferRule {
  key: string;
  name: string;
  flag: string;
  friction: Friction;
  summary: string;
  conditions: string[];
  citations: TransferCitation[];
  provisionCount: number;   // how many cross-border provisions backed this (0 = thin corpus)
}

// The six ASEAN economies the comparison covers. `match` are lowercase economy/jurisdiction
// spellings that appear in the DB (economy on validations, jurisdiction on clauses).
const ECONOMIES: Array<{ key: string; name: string; flag: string; match: string[] }> = [
  { key: "sg", name: "Singapore",   flag: "🇸🇬", match: ["singapore"] },
  { key: "my", name: "Malaysia",    flag: "🇲🇾", match: ["malaysia"] },
  { key: "th", name: "Thailand",    flag: "🇹🇭", match: ["thailand"] },
  { key: "id", name: "Indonesia",   flag: "🇮🇩", match: ["indonesia"] },
  { key: "vn", name: "Vietnam",     flag: "🇻🇳", match: ["vietnam", "viet nam"] },
  { key: "ph", name: "Philippines", flag: "🇵🇭", match: ["philippines"] },
];

// A provision is "cross-border" if its text/scope talks about moving data out of the country.
const CROSSBORDER_RX =
  /cross[- ]?border|\btransfer(?:red|s|ring)?\b|overseas|offshore|outside (?:the |singapore|malaysia|thailand|indonesia|viet ?nam|the philippines)|third countr|foreign (?:country|jurisdiction|recipient)|localis|localiz|data localization|data residency|onward transfer/i;

// Signals that push friction up (localization / prior approval) or down (safeguard-based).
const LOCALIZATION_RX = /localis|localiz|data residency|store(?:d|s)? .*within|local copy|keep .*(?:in country|within the country)|onshore|maintain .*locally/i;
const APPROVAL_RX = /approval|authoris|authoriz|prior consent of|register(?:ed|ing|ration)? with|filing|permit|impact assessment|assessment .*(?:required|conduct)|competent authority|government approval/i;
const SAFEGUARD_RX = /comparable protection|adequa|standard contractual|contractual (?:clause|safeguard)|binding corporate|appropriate safeguard|consent|reasonable (?:steps|security)|equivalent protection/i;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const truncate = (s: string, n = 150) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function isCrossBorder(text?: string, coverage?: string, rationale?: string): boolean {
  const hay = `${text ?? ""} ${coverage ?? ""} ${rationale ?? ""}`;
  return CROSSBORDER_RX.test(hay);
}

function inferFriction(sig: { localization: number; approval: number; safeguard: number; restriction: number; provisions: number }): { friction: Friction; reason: string } {
  if (sig.provisions === 0) return { friction: "Medium", reason: "limited corpus coverage — treat as indicative" };
  if (sig.localization > 0 || sig.approval >= 2) {
    return { friction: "High", reason: sig.localization > 0 ? "localization / data-residency expectations present" : "prior approval or assessment obligations present" };
  }
  if (sig.approval >= 1 || sig.restriction >= 2 || sig.safeguard >= 2) {
    return { friction: "Medium", reason: "permitted subject to safeguards and documented conditions" };
  }
  return { friction: "Low", reason: "transfers broadly permitted with baseline protections" };
}

/** Build the per-economy cross-border transfer comparison from real DB rows. */
export async function transferRules(): Promise<TransferRule[]> {
  // Pull the whole validated + clause corpus once, then bucket by economy.
  const [validations, clauses] = await Promise.all([
    loadValidations({ limit: 5000 }),
    loadClauses({ limit: 5000 }),
  ]);

  const inList = (val: string | undefined, matches: string[]) =>
    !!val && matches.some((m) => val.toLowerCase().includes(m));

  return ECONOMIES.map((eco) => {
    const vRows: ValidationRow[] = validations.filter(
      (v) => inList(v.economy, eco.match) && isCrossBorder(v.verbatim, v.coverage, v.mappingRationale),
    );
    const cRows: StoredClause[] = clauses.filter(
      (c) => inList(c.jurisdiction, eco.match) && isCrossBorder(c.text, c.coverage, c.mappingRationale),
    );

    const provisions = vRows.length + cRows.length;

    // Signals
    const corpus = [
      ...vRows.map((v) => `${v.verbatim ?? ""} ${v.mappingRationale ?? ""} ${v.impactComments ?? ""}`),
      ...cRows.map((c) => `${c.text ?? ""} ${c.mappingRationale ?? ""} ${c.impactComments ?? ""}`),
    ].join(" \n ");
    const count = (rx: RegExp) => (corpus.match(new RegExp(rx.source, "gi")) ?? []).length;
    const sig = {
      localization: count(LOCALIZATION_RX),
      approval: count(APPROVAL_RX),
      safeguard: count(SAFEGUARD_RX),
      restriction: cRows.filter((c) => c.type === "restriction" || c.type === "penalty").length,
      provisions,
    };
    const { friction, reason } = inferFriction(sig);

    // Conditions — prefer restriction/obligation clause text, else validation rationale.
    const condSeen = new Set<string>();
    const conditions: string[] = [];
    const pushCond = (raw?: string) => {
      const t = clean(raw ?? "");
      if (t.length < 12) return;
      const key = t.slice(0, 40).toLowerCase();
      if (condSeen.has(key)) return;
      condSeen.add(key);
      conditions.push(truncate(t));
    };
    cRows
      .filter((c) => c.type === "restriction" || c.type === "obligation" || c.type === "exception")
      .forEach((c) => pushCond(c.text));
    vRows.forEach((v) => pushCond(v.mappingRationale || v.verbatim));
    cRows.forEach((c) => pushCond(c.text));

    // Citations — instrument + section, deduped.
    const citeSeen = new Set<string>();
    const citations: TransferCitation[] = [];
    const pushCite = (instrument?: string, section?: string, note?: string) => {
      const inst = clean(instrument ?? "");
      if (!inst) return;
      const sec = clean(section ?? "");
      const key = `${inst}|${sec}`.toLowerCase();
      if (citeSeen.has(key)) return;
      citeSeen.add(key);
      citations.push({ instrument: inst, section: sec || "—", note: note ? clean(note) : undefined });
    };
    vRows.forEach((v) => pushCite(v.lawName, v.articleSection || v.indicatorId, v.timeframe || v.discoveryTag));
    cRows.forEach((c) => pushCite(c.instrument, c.citation || c.locationReference, c.level));

    const lawCount = citations.length;
    const summary =
      provisions > 0
        ? `${provisions} cross-border transfer provision${provisions === 1 ? "" : "s"} found across ${lawCount} instrument${lawCount === 1 ? "" : "s"}; ${reason}.`
        : `No cross-border transfer provisions in the current corpus for ${eco.name}; ${reason}.`;

    return {
      key: eco.key,
      name: eco.name,
      flag: eco.flag,
      friction,
      summary,
      conditions: conditions.slice(0, 5),
      citations: citations.slice(0, 5),
      provisionCount: provisions,
    };
  });
}
