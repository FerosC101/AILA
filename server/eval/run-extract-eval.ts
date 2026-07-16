// Extraction-accuracy eval (P2-8). Runs clause extraction over a labelled gold
// set and reports, per the gap-analysis requirements:
//   • Indicator mapping: micro/macro Precision, Recall, F1
//   • Field accuracy: document-level `level` field
//   • Agreement: Cohen's κ between model indicator assignments and the gold labels
// Run: `npm run eval:extract`
//
// Loads server/.env so GEMINI_API_KEY is available.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// load .env (same minimal loader as index.ts)
try {
  for (const line of readFileSync(join(here, "..", ".env"), "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch { /* no .env */ }

const { extractSource } = await import("../src/extract.js");
const { initDb } = await import("../src/db.js");

interface GoldDoc { sourceId: string; instrument: string; jurisdiction: string; indicators: string[]; level?: string }
const gold: { docs: GoldDoc[] } = JSON.parse(readFileSync(join(here, "extraction-gold.json"), "utf-8"));

const setOf = (a: string[]) => new Set(a);
const inter = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x)).length;

/** Cohen's κ for two binary labellers over N decisions (arrays of 0/1). */
function cohensKappa(a: number[], b: number[]): number {
  const n = a.length;
  if (!n) return NaN;
  let agree = 0, a1 = 0, b1 = 0;
  for (let i = 0; i < n; i++) { if (a[i] === b[i]) agree++; if (a[i]) a1++; if (b[i]) b1++; }
  const po = agree / n;
  const pa1 = a1 / n, pb1 = b1 / n;
  const pe = pa1 * pb1 + (1 - pa1) * (1 - pb1);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

async function main() {
  await initDb();
  console.log(`\nAILA extraction eval — ${gold.docs.length} documents\n${"=".repeat(72)}`);

  let tp = 0, fp = 0, fn = 0;         // micro counts (indicator mapping)
  let macroF1 = 0, scored = 0;         // macro F1
  let levelOk = 0, levelTotal = 0;     // field accuracy
  let extracted = 0;                   // docs that yielded >=1 clause
  const labelSpace = new Set<string>();
  const perDoc: { doc: GoldDoc; pred: Set<string>; level?: string }[] = [];
  let errors = 0;

  for (const d of gold.docs) {
    try {
      const r = await extractSource(d.sourceId, { refresh: true });
      if (r.clauses.length) extracted++;
      const pred = setOf(r.clauses.flatMap((c) => c.indicators ?? []));
      // predicted document level = most common non-empty clause level
      const levels = r.clauses.map((c) => c.level).filter(Boolean) as string[];
      const level = levels.sort((x, y) =>
        levels.filter((v) => v === y).length - levels.filter((v) => v === x).length)[0];
      perDoc.push({ doc: d, pred, level });

      const g = setOf(d.indicators);
      d.indicators.forEach((i) => labelSpace.add(i));
      pred.forEach((i) => labelSpace.add(i));

      const t = inter(pred, g), f_p = pred.size - t, f_n = g.size - t;
      tp += t; fp += f_p; fn += f_n;
      const p = pred.size ? t / pred.size : 0;
      const rc = g.size ? t / g.size : 0;
      const f1 = p + rc ? (2 * p * rc) / (p + rc) : 0;
      macroF1 += f1; scored++;

      if (d.level) { levelTotal++; if (level === d.level) levelOk++; }

      const mark = f1 === 1 ? "✓" : t > 0 ? "≈" : "✗";
      console.log(`${mark} ${d.jurisdiction} · ${d.instrument.slice(0, 40)}`);
      console.log(`    gold  : ${[...g].join(", ") || "—"}`);
      console.log(`    model : ${[...pred].join(", ") || "—"}   (P ${p.toFixed(2)} R ${rc.toFixed(2)} F1 ${f1.toFixed(2)})`);
      console.log(`    level : gold ${d.level ?? "—"} · model ${level ?? "—"}${d.level && level !== d.level ? "  ✗" : ""}`);
    } catch (err) {
      errors++;
      console.log(`! ERROR ${d.sourceId} — ${err instanceof Error ? err.message : err}`);
    }
  }

  // Cohen's κ over the observed label space (model vs gold), across all docs.
  const labels = [...labelSpace];
  const av: number[] = [], bv: number[] = [];
  for (const { doc, pred } of perDoc) {
    const g = setOf(doc.indicators);
    for (const lab of labels) { av.push(pred.has(lab) ? 1 : 0); bv.push(g.has(lab) ? 1 : 0); }
  }
  const kappa = cohensKappa(av, bv);

  const microP = tp + fp ? tp / (tp + fp) : 0;
  const microR = tp + fn ? tp / (tp + fn) : 0;
  const microF1 = microP + microR ? (2 * microP * microR) / (microP + microR) : 0;

  console.log("=".repeat(72));
  console.log(`Extraction coverage : ${extracted}/${gold.docs.length} docs yielded clauses` +
    (extracted < gold.docs.length ? "  (others: source URL returned no extractable text)" : ""));
  console.log("Indicator mapping");
  console.log(`  Micro  P ${microP.toFixed(2)}  R ${microR.toFixed(2)}  F1 ${microF1.toFixed(2)}   (TP ${tp} FP ${fp} FN ${fn})`);
  console.log(`  Macro  F1 ${(macroF1 / (scored || 1)).toFixed(2)}   (avg over ${scored} docs)`);
  console.log("Field accuracy");
  console.log(`  Document 'level' : ${levelOk}/${levelTotal} = ${levelTotal ? Math.round((levelOk / levelTotal) * 100) : 0}%`);
  console.log("Agreement");
  console.log(`  Cohen's κ (model vs gold, ${labels.length}-label space) : ${kappa.toFixed(2)}  ${kappaLabel(kappa)}`);
  if (errors) console.log(`Errors: ${errors}`);
  console.log("");
  process.exit(0);
}

function kappaLabel(k: number): string {
  if (isNaN(k)) return "";
  if (k < 0) return "(worse than chance)";
  if (k < 0.2) return "(slight)";
  if (k < 0.4) return "(fair)";
  if (k < 0.6) return "(moderate)";
  if (k < 0.8) return "(substantial)";
  return "(almost perfect)";
}

main();
