// Headless-browser fallback for JavaScript-rendered / WAF-challenged gov sites
// (ASEAN, OECD, Thai PDPC, etc.) where plain fetch returns a placeholder shell.
//
// Feature-detected and lazy: if `playwright` (and its chromium browser) aren't
// installed, every function no-ops gracefully — the rest of AILA keeps working.
// Enable with USE_PLAYWRIGHT=1; install with `npx playwright install chromium`.

let available: boolean | null = null;
let browserPromise: Promise<any> | null = null;

export function renderEnabled(): boolean {
  return process.env.USE_PLAYWRIGHT === "1";
}

async function getBrowser(): Promise<any | null> {
  if (!renderEnabled()) return null;
  if (available === false) return null;
  if (browserPromise) return browserPromise;
  browserPromise = (async () => {
    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      available = true;
      return browser;
    } catch (err) {
      available = false;
      console.warn(`[render] Playwright unavailable — install with \`npx playwright install chromium\`. (${err instanceof Error ? err.message : err})`);
      return null;
    }
  })();
  return browserPromise;
}

/**
 * Render a URL in headless chromium and return the visible body text.
 * Returns null if rendering is disabled/unavailable or fails.
 */
export async function renderText(url: string, timeoutMs = 25_000, maxChars = 8000): Promise<string | null> {
  const browser = await getBrowser();
  if (!browser) return null;
  let ctx: any;
  try {
    ctx = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
    const text: string = await page.evaluate(() => document.body?.innerText ?? "");
    return text.replace(/\s+/g, " ").trim().slice(0, maxChars) || null;
  } catch {
    return null;
  } finally {
    if (ctx) await ctx.close().catch(() => {});
  }
}

export function renderStatus() {
  return { enabled: renderEnabled(), browserReady: available === true };
}
