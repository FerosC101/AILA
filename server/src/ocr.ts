/**
 * ocr.ts — OCR fallback for scanned/image-only PDFs
 *
 * Flow:
 *   1. unpdf tries to extract text from PDF (fast, no OCR needed)
 *   2. If text is empty or too short → PDF is image-only (scanned)
 *   3. Tesseract.js converts each page image → text
 *   4. Result cached in DB so OCR never runs twice on the same PDF
 *
 * Performance:
 *   - OCR queue: only 1 job runs at a time → no memory crashes
 *   - Results cached in DB → never OCR same PDF twice
 *   - Runs async → never blocks the server
 *   - Max 5 pages per PDF → keeps processing time reasonable
 *
 * Industry note:
 *   Tesseract.js is good for hackathon/MVP. Upgrade to Google Cloud Vision
 *   or AWS Textract for production (better accuracy, faster, multilingual).
 */

import { createWorker } from "tesseract.js";
import { getDocumentProxy } from "unpdf";
import { getCachedTranslation, saveTranslation } from "./db.js";

// ── config ────────────────────────────────────────────────────────────────────     // max pages to OCR per PDF
const MIN_TEXT_LEN  = 120;   // below this = treat as scanned
const OCR_CACHE_KEY = "ocr"; // key in translations table

// ── simple async queue ────────────────────────────────────────────────────────
// Only 1 OCR job runs at a time — prevents memory crashes and CPU spikes.
// Jobs pile up here and run one after another.

type OcrJob = () => Promise<void>;

class OcrQueue {
  private queue: OcrJob[] = [];
  private running = false;

  /** Add a job to the queue and start processing if idle. */
  add(job: OcrJob): void {
    this.queue.push(job);
    this.process();
  }

  /** How many jobs are waiting. */
  get pending(): number {
    return this.queue.length;
  }

  private async process(): Promise<void> {
    if (this.running) return; // already processing
    this.running = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      try {
        await job();
      } catch (err) {
        console.error("[OCR Queue] Job failed:", err instanceof Error ? err.message : err);
      }
    }

    this.running = false;
  }
}

// Singleton queue — shared across all OCR requests
export const ocrQueue = new OcrQueue();

// ── helpers ───────────────────────────────────────────────────────────────────

function isTextTooShort(text: string | null): boolean {
  if (!text) return true;
  return text.replace(/\s+/g, " ").trim().length < MIN_TEXT_LEN;
}



// ── core OCR logic ────────────────────────────────────────────────────────────

/**
 * Internal: actually run Tesseract on a PDF buffer.
 * Called by the queue — never call this directly.
 */
async function runTesseract(
  pdfBuffer: Uint8Array,
  sourceId: string,
  maxChars: number,
): Promise<string | null> {
  const worker = await createWorker("eng", 1, {
    logger: () => {},
    errorHandler: () => {},
  });

  try {
    const { data } = await worker.recognize(Buffer.from(pdfBuffer));
    const result = data.text.replace(/\s+/g, " ").trim();

    if (!result || result.length < 20) return null;

    console.log(`[OCR] Tesseract extracted ${result.length} chars for ${sourceId}`);
    await saveTranslation(sourceId, OCR_CACHE_KEY, result);
    return result.slice(0, maxChars);

  } finally {
    await worker.terminate();
  }
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Run OCR on a PDF buffer. Returns extracted text or null.
 *
 * - Checks DB cache first (never OCRs same PDF twice)
 * - Tries unpdf text extraction first (fast)
 * - Falls back to Tesseract only for scanned/image PDFs
 * - Queued: only 1 OCR job runs at a time
 *
 * @param pdfBuffer  Raw PDF bytes
 * @param sourceId   DB source ID — used as cache key
 * @param maxChars   Max characters to return
 */
export async function ocrPdf(
  pdfBuffer: Uint8Array,
  sourceId: string,
  maxChars = 12_000,
): Promise<string | null> {

  // 1. Check cache
  const cached = await getCachedTranslation(sourceId, OCR_CACHE_KEY);
  if (cached) {
    console.log(`[OCR] Cache hit for ${sourceId}`);
    return cached.slice(0, maxChars);
  }

  // 2. Try unpdf first (no OCR needed if text exists)
  try {
    const { extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(pdfBuffer);
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = (Array.isArray(text) ? text.join(" ") : text)
      .replace(/\s+/g, " ")
      .trim();

    if (!isTextTooShort(clean)) {
      console.log(`[OCR] unpdf success for ${sourceId} (${clean.length} chars)`);
      await saveTranslation(sourceId, OCR_CACHE_KEY, clean);
      return clean.slice(0, maxChars);
    }
  } catch {
    // unpdf failed — fall through to Tesseract
  }

  // 3. Queue Tesseract OCR job
  console.log(`[OCR] Queuing Tesseract for ${sourceId} (queue size: ${ocrQueue.pending})`);

  return new Promise((resolve) => {
    ocrQueue.add(async () => {
      const result = await runTesseract(pdfBuffer, sourceId, maxChars).catch((err) => {
        console.error(`[OCR] Tesseract failed for ${sourceId}:`, err instanceof Error ? err.message : err);
        return null;
      });
      resolve(result);
    });
  });
}

/**
 * Should we bother running OCR on this PDF?
 * Returns true if the URL matches known scanned-heavy sources
 * and the extracted text is too short to be useful.
 */
export function likelyScanned(url: string, extractedText: string | null): boolean {
  if (!isTextTooShort(extractedText)) return false;

  // Known sources that publish scanned PDFs
  const scannedPatterns = [
    /datasrvr\.com/i,      // Malaysian gazette
    /federalgazette/i,     // Malaysian federal gazette
    /cyrilla\.org/i,       // Legal archive
    /hasil\.gov\.my/i,     // Malaysian tax authority
    /ccid\.rmp\.gov\.my/i, // Malaysian police cyber crime
  ];

  return scannedPatterns.some((p) => p.test(url));
}

/**
 * Current queue status — useful for the /health endpoint.
 */
export function ocrStatus() {
  return {
    pending: ocrQueue.pending,
    engine: "tesseract.js",
  };
}