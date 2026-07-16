// Web search for live retrieval — when the local corpus can't answer a question,
// the chatbot searches the open web, then scrapes + embeds the results.
// Uses Tavily when TAVILY_API_KEY is set (clean, ranked); otherwise falls back to
// keyless DuckDuckGo HTML scraping so it works with no configuration.

import * as cheerio from "cheerio";
import { fetchText } from "./scraper.js";
import { classifyAuthority } from "./authority.js";

/** Tavily search (used only when TAVILY_API_KEY is configured). */
async function tavily(query: string, max: number): Promise<string[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, query, max_results: max, search_depth: "basic" }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: Array<{ url: string }> };
    return (data.results ?? []).map((r) => r.url).filter(Boolean);
  } catch {
    return [];
  }
}

/** Keyless DuckDuckGo HTML search — parses the result page for outbound links. */
async function duckduckgo(query: string, max: number): Promise<string[]> {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, 12_000)
    .catch(() => null);
  if (!html) return [];
  const $ = cheerio.load(html);
  const urls: string[] = [];
  $("a.result__a").each((_, el) => {
    let href = $(el).attr("href") || "";
    // DDG wraps links as //duckduckgo.com/l/?uddg=<encoded-target>
    const m = href.match(/[?&]uddg=([^&]+)/);
    if (m) href = decodeURIComponent(m[1]);
    else if (href.startsWith("//")) href = "https:" + href;
    if (/^https?:\/\//.test(href)) urls.push(href);
  });
  return urls.slice(0, max);
}

/** Search the web, returning result URLs ranked official/primary sources first. */
export async function searchWeb(query: string, max = 6): Promise<string[]> {
  let urls = await tavily(query, max);
  if (!urls.length) urls = await duckduckgo(query, max);

  // de-dupe, drop obvious noise, then rank by source authority (primary first)
  const seen = new Set<string>();
  const clean = urls.filter((u) => {
    if (seen.has(u)) return false;
    seen.add(u);
    return !/(facebook|twitter|linkedin|youtube|reddit|pinterest)\.com/i.test(u);
  });
  return clean
    .map((url) => ({ url, tier: classifyAuthority(url).tier }))
    .sort((a, b) => (a.tier === "primary" ? 0 : 1) - (b.tier === "primary" ? 0 : 1))
    .map((x) => x.url);
}

export function searchProvider(): "tavily" | "duckduckgo" {
  return process.env.TAVILY_API_KEY ? "tavily" : "duckduckgo";
}
