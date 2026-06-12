import * as cheerio from "cheerio";
import type { RegulationSource, ScrapeResult } from "./types.js";
import { insertScrape, getLatestScrape } from "./db.js";
import { ocrPdf, likelyScanned } from "./ocr.js";


// Government sites front their content with WAFs that reject non-browser UAs,
// so we present a current Chrome fingerprint. Adjust if you need an identifiable
// crawler UA (and expect more 403s from sites like sso.agc.gov.sg).
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};
const FETCH_TIMEOUT_MS = 20_000;
const MAX_EXCERPT = 600;
const MAX_DOC_LINKS = 12;

function absolutize(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

const looksLikeDocument = (href: string) =>
  /\.(pdf|docx?|xlsx?)(\?|#|$)/i.test(href) ||
  /(circular|advisory|notice|regulation|act|agreement|guideline)/i.test(href);

/** Lightweight reachability check that follows redirects. Used by the scanner. */
export async function probeUrl(
  url: string,
  timeoutMs = 12_000,
): Promise<{ ok: boolean; status: number; finalUrl: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status, finalUrl: res.url || url };
  } catch (err) {
    return { ok: false, status: 0, finalUrl: url, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Extract text from a PDF URL via unpdf (pdf.js). Returns cleaned text or null. */
export async function fetchPdfText(url: string, timeoutMs = 25_000, maxChars = 12_000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: controller.signal });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = (Array.isArray(text) ? text.join(" ") : text).replace(/\s+/g, " ").trim();
    return clean ? clean.slice(0, maxChars) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch raw text (for sitemap/XML parsing) with a small size guard. */
export async function fetchText(url: string, timeoutMs = 12_000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch a single source and extract a lightweight summary:
 * page title, leading text excerpt, and candidate document links.
 * Network/parse failures are captured in the result rather than thrown.
 */
export async function scrapeSource(source: RegulationSource): Promise<ScrapeResult> {
  const base: ScrapeResult = {
    sourceId: source.id,
    url: source.url,
    jurisdiction: source.jurisdiction,
    instrument: source.instrument,
    ok: false,
    status: 0,
    fetchedAt: new Date().toISOString(),
  };
  const last = await getLatestScrape(source.id);
  if (last?.ok) {
    const ageMs = Date.now() - new Date(last.fetchedAt).getTime();
    if (ageMs < 6 * 60 * 60 * 1000) return last;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  

  try {
    const res = await fetch(source.url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });

    base.status = res.status;
    if (!res.ok) {
      base.error = `HTTP ${res.status}`;
      return base;
    }

    // PDFs: extract text with unpdf so they feed retrieval + evidence.
    const contentType = res.headers.get("content-type") ?? "";
    if (source.format === "pdf" || contentType.includes("application/pdf") || /\.pdf(\?|#|$)/i.test(source.url)) {
      base.ok = true;
      base.title = source.instrument;
      const text = await fetchPdfText(source.url).catch(() => null);
      if (text && text.length >= 120) {
        base.excerpt = text.slice(0, MAX_EXCERPT);
      } else {
        const buf = await fetch(source.url, { headers: BROWSER_HEADERS })
          .then(r => r.arrayBuffer())
          .then(b => new Uint8Array(b))
          .catch(() => null);
        if (buf && likelyScanned(source.url, text)) {
          // run OCR async — don't block the scraper
          ocrPdf(buf, source.id).then(ocrText => {
            if (ocrText) console.log(`[OCR] Done for ${source.url}`);
          }).catch(() => {});
          base.excerpt = "Scanned PDF — OCR running in background.";
        } else {
          base.excerpt = text ?? "No extractable text found.";
        }
      }
      return base;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    $("script, style, noscript, svg").remove();
    const title = $("title").first().text().trim() || $("h1").first().text().trim();

    const main = $("main").length ? $("main") : $("body");
    const excerpt = main
      .find("p")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 40)
      .slice(0, 4)
      .join(" ")
      .replace(/\s+/g, " ")
      .slice(0, MAX_EXCERPT);

    const seen = new Set<string>();
    const documentLinks: string[] = [];
    $("a[href]").each((_, el) => {
      if (documentLinks.length >= MAX_DOC_LINKS) return;
      const href = $(el).attr("href");
      if (!href) return;
      const abs = absolutize(href, source.url);
      if (!abs || seen.has(abs) || !looksLikeDocument(abs)) return;
      seen.add(abs);
      documentLinks.push(abs);
    });

    base.ok = true;
    base.title = title || undefined;
    base.excerpt = excerpt || undefined;
    base.documentLinks = documentLinks;
    return base;
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
    return base;
  } finally {
    clearTimeout(timer);
    // persist every crawl result to DB (success or failure)
    await insertScrape(base).catch(() => {});
  }
}
/** Scrape many sources with bounded concurrency to stay polite. */
export async function scrapeAll(
  sources: RegulationSource[],
  concurrency = 4,
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < sources.length) {
      const index = cursor++;
      results[index] = await scrapeSource(sources[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, sources.length) }, worker));
  return results;
}
