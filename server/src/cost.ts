// LLM cost tracking — accumulates Gemini token usage per model and estimates $,
// so AILA can answer "how much does one indicator check cost?".
//
// Prices are APPROXIMATE (USD per 1M tokens) and configurable via env
// (GEMINI_PRICE_IN / GEMINI_PRICE_OUT). Update when Google changes pricing.

interface ModelUsage { calls: number; promptTokens: number; outputTokens: number; totalTokens: number }
const usage: Record<string, ModelUsage> = {};

// per-1M-token prices (approx; override with env)
const PRICING: Record<string, { in: number; out: number }> = {
  "gemini-2.5-flash": { in: Number(process.env.GEMINI_PRICE_IN ?? 0.30), out: Number(process.env.GEMINI_PRICE_OUT ?? 2.50) },
  "gemini-2.0-flash": { in: 0.10, out: 0.40 },
  "gemini-embedding-001": { in: 0.15, out: 0 },
};
const priceFor = (model: string) => PRICING[model] ?? { in: 0.30, out: 2.5 };

/** Record usage from a Gemini generateContent / embedContent response. */
export function recordGeminiUsage(model: string, data: any): void {
  const u = data?.usageMetadata;
  if (!u) { // embeddings may not return usage — count the call at least
    const m = (usage[model] ??= { calls: 0, promptTokens: 0, outputTokens: 0, totalTokens: 0 });
    m.calls++;
    return;
  }
  const m = (usage[model] ??= { calls: 0, promptTokens: 0, outputTokens: 0, totalTokens: 0 });
  m.calls++;
  m.promptTokens += u.promptTokenCount ?? 0;
  m.outputTokens += u.candidatesTokenCount ?? 0;
  m.totalTokens += u.totalTokenCount ?? (u.promptTokenCount ?? 0) + (u.candidatesTokenCount ?? 0);
}

function usdFor(model: string, m: ModelUsage): number {
  const p = priceFor(model);
  return (m.promptTokens / 1e6) * p.in + (m.outputTokens / 1e6) * p.out;
}

/** Totals + per-model breakdown + estimated cost. */
export function costStatus() {
  const models: Record<string, ModelUsage & { estUsd: number }> = {};
  let calls = 0, tokens = 0, usd = 0;
  for (const [model, m] of Object.entries(usage)) {
    const est = usdFor(model, m);
    models[model] = { ...m, estUsd: Number(est.toFixed(6)) };
    calls += m.calls; tokens += m.totalTokens; usd += est;
  }
  return {
    totalCalls: calls,
    totalTokens: tokens,
    estimatedUsd: Number(usd.toFixed(6)),
    avgUsdPerCall: calls ? Number((usd / calls).toFixed(6)) : 0,
    models,
    note: "Prices are approximate (USD/1M tokens); configure with GEMINI_PRICE_IN / GEMINI_PRICE_OUT.",
  };
}
