/**
 * ocr.ts — OCR fallback for scanned/image-only PDFs
 *
 * Flow:
 *   1. unpdf tries to extract text from PDF (fast, no OCR needed)
 *   2. If text is empty or too short → PDF is image-only (scanned)
 *   3. pdfjs-dist rasterizes each page to a PNG buffer  ← FIX 1
 *   4. Persistent Tesseract worker reads each PNG → text ← FIX 3
 *   5. Result cached in DB so OCR never runs twice on the same PDF
 *
 * Industry note:
 *   Tesseract.js is good for hackathon/MVP. Upgrade to Google Cloud Vision
 *   or AWS Textract for production (better accuracy, faster, multilingual).
 */

import { createWorker, type Worker } from "tesseract.js";
import { getDocumentProxy } from "unpdf";
import { getCachedTranslation, saveTranslation } from "./db.js";

// ── config ────────────────────────────────────────────────────────────────────
const MIN_TEXT_LEN  = 120;
const MAX_PAGES     = 5;     // max pages to rasterize + OCR per PDF
const OCR_CACHE_KEY = "ocr"; // key in translations table
const SCALE         = 2.0;   // render scale — 2x improves Tesseract accuracy

// ── FIX 3: persistent worker ──────────────────────────────────────────────────
// One worker stays alive for the entire server lifetime instead of paying
// the ~2s createWorker startup cost (subprocess spawn + WASM load) on every job.

let _worker: Worker | null = null;
let _workerReady = false;

async function getWorker(): Promise<Worker> {
  if (_worker && _workerReady) return _worker;
  console.log("[OCR] Initialising persistent Tesseract worker...");
  _worker = await createWorker("eng", 1, { logger: () => {}, errorHandler: () => {} });
  _workerReady = true;
  console.log("[OCR] Persistent Tesseract worker ready");
  return _worker;
}

async function shutdownWorker(): Promise<void> {
  if (_worker && _workerReady) {
    _workerReady = false;
    await _worker.terminate().catch(() => {});
    _worker = null;
  }
}
process.on("exit",    () => { shutdownWorker(); });
process.on("SIGINT",  () => { shutdownWorker().then(() => process.exit(0)); });
process.on("SIGTERM", () => { shutdownWorker().then(() => process.exit(0)); });

// ── simple async queue ────────────────────────────────────────────────────────
type OcrJob = () => Promise<void>;

class OcrQueue {
  private queue: OcrJob[] = [];
  private running = false;

  add(job: OcrJob): void {
    this.queue.push(job);
    this.process();
  }

  get pending(): number { return this.queue.length; }

  private async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      try { await job(); }
      catch (err) { console.error("[OCR Queue] Job failed:", err instanceof Error ? err.message : err); }
    }
    this.running = false;
  }
}

export const ocrQueue = new OcrQueue();

// ── helpers ───────────────────────────────────────────────────────────────────
function isTextTooShort(text: string | null): boolean {
  if (!text) return true;
  return text.replace(/\s+/g, " ").trim().length < MIN_TEXT_LEN;
}

// ── FIX 1: page rasterization ─────────────────────────────────────────────────
// Tesseract.js is an IMAGE OCR engine — it cannot read PDF bytes.
// Previously runTesseract() passed the raw PDF buffer directly, which silently
// produced garbage or empty output. The correct flow is:
//   PDF buffer → pdfjs-dist renders each page → PNG buffer → Tesseract

async function rasterizePages(pdfBuffer: Uint8Array): Promise<Buffer[]> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
  const { createCanvas } = await import("canvas" as any);

  const pdfDoc = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
  const numPages = Math.min(pdfDoc.numPages, MAX_PAGES);
  const pngBuffers: Buffer[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = createCanvas(viewport.width, viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      pngBuffers.push(canvas.toBuffer("image/png"));
      page.cleanup();
    } catch (err) {
      console.warn(`[OCR] Page ${pageNum} rasterization failed:`, err instanceof Error ? err.message : err);
    }
  }

  await pdfDoc.cleanup();
  return pngBuffers;
}

// ── core OCR logic ────────────────────────────────────────────────────────────
async function runTesseract(
  pdfBuffer: Uint8Array,
  sourceId: string,
  maxChars: number,
): Promise<string | null> {
  const pngPages = await rasterizePages(pdfBuffer);

  if (!pngPages.length) {
    console.warn(`[OCR] No pages rasterized for ${sourceId}`);
    return null;
  }

  const worker = await getWorker();
  const pageTexts: string[] = [];

  for (let i = 0; i < pngPages.length; i++) {
    try {
      const { data } = await worker.recognize(pngPages[i]);
      const t = data.text.replace(/\s+/g, " ").trim();
      if (t.length > 20) pageTexts.push(t);
    } catch (err) {
      console.warn(`[OCR] Page ${i + 1} recognition failed for ${sourceId}:`, err instanceof Error ? err.message : err);
      // Worker may be corrupted — force recreation on next job
      _workerReady = false;
      _worker = null;
    }
  }

  if (!pageTexts.length) return null;

  const result = pageTexts.join(" ").replace(/\s+/g, " ").trim();
  console.log(`[OCR] Extracted ${result.length} chars across ${pngPages.length} page(s) for ${sourceId}`);
  await saveTranslation(sourceId, OCR_CACHE_KEY, result);
  return result.slice(0, maxChars);
}

// ── public API ────────────────────────────────────────────────────────────────

export async function ocrPdf(
  pdfBuffer: Uint8Array,
  sourceId: string,
  maxChars = 12_000,
): Promise<string | null> {

  // 1. Cache check
  const cached = await getCachedTranslation(sourceId, OCR_CACHE_KEY);
  if (cached) {
    console.log(`[OCR] Cache hit for ${sourceId}`);
    return cached.slice(0, maxChars);
  }

  // 2. Fast path: unpdf text extraction (text-layer PDFs, no OCR needed)
  try {
    const { extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(pdfBuffer);
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = (Array.isArray(text) ? text.join(" ") : text).replace(/\s+/g, " ").trim();

    if (!isTextTooShort(clean)) {
      console.log(`[OCR] unpdf fast-path for ${sourceId} (${clean.length} chars)`);
      await saveTranslation(sourceId, OCR_CACHE_KEY, clean);
      return clean.slice(0, maxChars);
    }
  } catch { /* fall through */ }

  // 3. Slow path: rasterize pages then Tesseract
  console.log(`[OCR] Queuing rasterize+OCR for ${sourceId} (queue: ${ocrQueue.pending})`);

  return new Promise((resolve) => {
    ocrQueue.add(async () => {
      const result = await runTesseract(pdfBuffer, sourceId, maxChars).catch((err) => {
        console.error(`[OCR] runTesseract failed for ${sourceId}:`, err instanceof Error ? err.message : err);
        return null;
      });
      resolve(result);
    });
  });
}

/** OCR an image buffer (png/jpg/tiff) directly — for uploaded image documents. */
export async function ocrImage(imageBuffer: Uint8Array, id: string, maxChars = 12_000): Promise<string | null> {
  return new Promise((resolve) => {
    ocrQueue.add(async () => {
      try {
        const worker = await getWorker();
        const { data } = await worker.recognize(Buffer.from(imageBuffer));
        const text = data.text.replace(/\s+/g, " ").trim();
        console.log(`[OCR] Image ${id}: ${text.length} chars`);
        resolve(text.length > 10 ? text.slice(0, maxChars) : null);
      } catch (err) {
        console.error(`[OCR] Image OCR failed for ${id}:`, err instanceof Error ? err.message : err);
        _workerReady = false; _worker = null;
        resolve(null);
      }
    });
  });
}

export function likelyScanned(url: string, extractedText: string | null): boolean {
  if (!isTextTooShort(extractedText)) return false;
  const scannedPatterns = [
    /datasrvr\.com/i,
    /federalgazette/i,
    /cyrilla\.org/i,
    /hasil\.gov\.my/i,
    /ccid\.rmp\.gov\.my/i,
  ];
  return scannedPatterns.some((p) => p.test(url));
}

export function ocrStatus() {
  return {
    pending: ocrQueue.pending,
    engine: "tesseract.js",
    worker: _workerReady ? "ready" : "idle",
  };
}