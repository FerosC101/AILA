// Pre-warm the backend before a demo so live queries are fast and don't hit
// rate limits: warms the link-health cache, RAG index, and (optionally) runs
// clause extraction across the corpus. Assumes the backend is running.
//
// Usage: npm run prewarm            (health + graph + rag index)
//        npm run prewarm -- --extract   (also runs batch clause extraction)

const BASE = process.env.VITE_AILA_API_BASE_URL?.trim() || "http://localhost:8787";
const withExtract = process.argv.includes("--extract");

const get = (p) => fetch(`${BASE}${p}`).then((r) => r.json());
const post = (p) => fetch(`${BASE}${p}`, { method: "POST" }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  try {
    await fetch(`${BASE}/health`);
  } catch {
    console.error(`✗ Backend not reachable at ${BASE}. Start it: cd server && npm run dev`);
    process.exit(1);
  }

  process.stdout.write("• Warming link-health + graph (active URLs)… ");
  const g = await get("/graph");
  console.log(`ok — ${g.nodes?.length ?? 0} nodes, ${g.stats?.regulations ?? 0} regulations`);

  process.stdout.write("• Warming RAG index… ");
  const rs = await get("/rag/status");
  console.log(rs.ready ? `ready (${rs.chunks} chunks, ${rs.clauses} clause units)` : "building in background…");

  if (withExtract) {
    console.log("• Starting batch clause extraction across active sources…");
    const start = await post("/extract/all");
    if (start.error) { console.log(`  (skipped: ${start.error})`); }
    else {
      let s;
      do {
        await sleep(4000);
        s = await get("/extract/status");
        process.stdout.write(`\r  extracting: ${s.processed}/${s.total} sources · ${s.clauses} clauses · ${s.errors} errors   `);
      } while (s.running);
      console.log(`\n  done — ${s.clauses} clauses from ${s.processed} sources.`);
    }
  }

  const h = await get("/health");
  console.log(`\n✓ Ready. DB: ${h.sources} sources · ${h.chunks} chunks · ${h.clauses} clauses.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
