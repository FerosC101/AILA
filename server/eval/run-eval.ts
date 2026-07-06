// Accuracy eval harness for the RAG pipeline.
// Runs a gold set of questions, checks whether the expected source appears in
// the returned citations, and reports retrieval hit-rate, citation precision,
// grounded-rate, and average confidence. Run: `npm run eval`.
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

const { ragQuery } = await import("../src/rag.js");

type Expect = { jurisdiction?: string; instrumentIncludes?: string; urlIncludes?: string };
type Case = { question: string; expect: Expect };

const cases: Case[] = JSON.parse(readFileSync(join(here, "gold-set.json"), "utf-8"));

const matches = (cit: any, e: Expect): boolean => {
  if (e.jurisdiction && cit.jurisdiction?.toLowerCase() === e.jurisdiction.toLowerCase()) return true;
  if (e.instrumentIncludes && (cit.instrument ?? "").toLowerCase().includes(e.instrumentIncludes.toLowerCase())) return true;
  if (e.urlIncludes && (cit.url ?? "").toLowerCase().includes(e.urlIncludes.toLowerCase())) return true;
  return false;
};

async function main() {
  console.log(`\nAILA RAG eval — ${cases.length} cases\n${"=".repeat(64)}`);
  let hits = 0, top1 = 0, grounded = 0, confSum = 0, errors = 0;

  for (const c of cases) {
    try {
      const r = await ragQuery(c.question);
      const cits = r.citations ?? [];
      const hit = cits.some((x: any) => matches(x, c.expect));
      const isTop1 = cits[0] ? matches(cits[0], c.expect) : false;
      if (hit) hits++;
      if (isTop1) top1++;
      if (r.grounded) grounded++;
      confSum += r.confidence ?? 0;
      const mark = hit ? "✓" : "✗";
      console.log(`${mark} [${Math.round((r.confidence ?? 0) * 100)}%] ${c.question}`);
      if (!hit) console.log(`    expected ${JSON.stringify(c.expect)} · got ${cits.slice(0, 3).map((x: any) => x.jurisdiction + ":" + (x.instrument || "").slice(0, 24)).join(" | ") || "none"}`);
    } catch (err) {
      errors++;
      console.log(`! ERROR ${c.question} — ${err instanceof Error ? err.message : err}`);
    }
  }

  const n = cases.length;
  console.log("=".repeat(64));
  console.log(`Retrieval hit-rate (expected source in citations): ${hits}/${n} = ${Math.round((hits / n) * 100)}%`);
  console.log(`Top-1 precision (best citation is correct):        ${top1}/${n} = ${Math.round((top1 / n) * 100)}%`);
  console.log(`Grounded-rate:                                     ${grounded}/${n} = ${Math.round((grounded / n) * 100)}%`);
  console.log(`Average confidence:                                ${Math.round((confSum / n) * 100)}%`);
  if (errors) console.log(`Errors: ${errors}`);
  console.log("");
  process.exit(0);
}

main();
