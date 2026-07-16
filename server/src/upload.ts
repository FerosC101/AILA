// Uploaded-document pipeline — the same engine, but fed by a file the user
// uploads instead of a crawled URL:
//   ingest (PDF text / OCR image) → translate → extract clauses → map (RDTII)
// Returns the machine-readable Output Sample and persists the doc + clauses so
// they appear in the Document Archive.

import { randomUUID } from "node:crypto";
import { ocrPdf, ocrImage } from "./ocr.js";
import { ensureEnglish, detectLanguage } from "./translate.js";
import { extractFromText } from "./extract.js";
import { classifyInstrument, classifierEnabled } from "./classify.js";
import { findIndicator } from "./indicators.js";
import { upsertSources } from "./db.js";


export interface UploadResult {
  engine: string;
  generatedAt: string;
  document: {
    id: string; instrument: string; jurisdiction: string;
    sourceType: "pdf" | "scanned-image" | "text";
    language: string; chars: number; discoveryTags: string[];
  };
  pipeline: {
    ingest: { method: string; chars: number; ms: number };
    extraction: { clauseCount: number; ms: number };
    mapping: { rdtii: Array<{ code: string; name: string }>; pillars: string[]; policyFocus: string[]; ms: number };
    categorization: { coverage: string; rationale?: string };
  };
  clauses: Array<{
    id: string; type: string; text: string; actor?: string;
    citation?: string; snippet?: string;
    indicators: Array<{ code?: string; name: string }>;
    penalty?: string; effectiveDate?: string; confidence?: number;
  }>;
  note?: string;
}

export async function processUpload(
  buf: Buffer, filename: string, mimetype: string, jurisdiction = "Uploaded",
): Promise<UploadResult> {
  if (!classifierEnabled()) throw new Error("GEMINI_API_KEY not configured.");

  const id = `upload-${randomUUID().slice(0, 8)}`;
  const instrument = filename.replace(/\.[^.]+$/, "") || filename;
  const isPdf = mimetype.includes("pdf") || /\.pdf$/i.test(filename);
  const isImage = mimetype.startsWith("image/") || /\.(png|jpe?g|tiff?|bmp|webp)$/i.test(filename);
  const url = `upload://${filename}`;

  const base = (sourceType: UploadResult["document"]["sourceType"]): UploadResult => ({
    engine: "aila-engine/1.0", generatedAt: new Date().toISOString(),
    document: { id, instrument, jurisdiction, sourceType, language: "en", chars: 0, discoveryTags: [] },
    pipeline: { ingest: { method: "", chars: 0, ms: 0 }, extraction: { clauseCount: 0, ms: 0 }, mapping: { rdtii: [], pillars: [], policyFocus: [], ms: 0 }, categorization: { coverage: "" } },
    clauses: [],
  });

  // ── 1) INGEST — get text (OCR for images / scanned PDFs) ────────
  let t = Date.now();
  let text: string | null = null;
  let method = "text";
  const sourceType: UploadResult["document"]["sourceType"] = isImage ? "scanned-image" : isPdf ? "pdf" : "text";
  if (isPdf) { text = await ocrPdf(new Uint8Array(buf), id, 12_000, { jurisdiction }); method = "pdf (unpdf → OCR fallback)"; }
  else if (isImage) { text = await ocrImage(new Uint8Array(buf), id, 12_000, { jurisdiction }); method = "OCR (tesseract)"; }
  else { text = buf.toString("utf-8").slice(0, 20000); method = "plain text"; }
  const ingestMs = Date.now() - t;

  if (!text || text.length < 80) {
    const r = base(sourceType);
    r.pipeline.ingest = { method, chars: text?.length ?? 0, ms: ingestMs };
    r.note = "No extractable text — the file may be an image with too little readable content.";
    return r;
  }

  const language = detectLanguage(text) || "en";
  // register as a source row so clauses satisfy the FK and appear in the archive
  await upsertSources([{ id, jurisdiction, instrument, url, region: "Uploaded", format: isPdf ? "pdf" : "html", cadence: "monthly" }]);

  const enText = await ensureEnglish(text, id, jurisdiction);

  // ── 2) EXTRACTION ───────────────────────────────────────────────
  t = Date.now();
  const clauses = await extractFromText(id, instrument, jurisdiction, url, enText);
  const extractionMs = Date.now() - t;

  // ── 3) MAPPING / CATEGORIZATION ─────────────────────────────────
  t = Date.now();
  const cls = await classifyInstrument({
    instrument, jurisdiction,
    excerpt: clauses.map((c) => c.text).join(" ").slice(0, 1500) || enText.slice(0, 1500),
  });
  const mappingMs = Date.now() - t;

  const tags = Array.from(new Set<string>([
    "uploaded", jurisdiction, sourceType,
    ...(cls.rdtii ?? []).map((r) => r.code),
    ...(cls.pillars ?? []),
  ].filter(Boolean) as string[]));

  return {
    engine: "aila-engine/1.0",
    generatedAt: new Date().toISOString(),
    document: { id, instrument, jurisdiction, sourceType, language, chars: text.length, discoveryTags: tags },
    pipeline: {
      ingest: { method, chars: text.length, ms: ingestMs },
      extraction: { clauseCount: clauses.length, ms: extractionMs },
      mapping: { rdtii: cls.rdtii ?? [], pillars: cls.pillars ?? [], policyFocus: (cls.indicators ?? []).map((i) => i.focus), ms: mappingMs },
      categorization: { coverage: cls.coverage, rationale: cls.rationale },
    },
    clauses: clauses.map((c, i) => ({
      id: `${id}#${i + 1}`, type: c.type, text: c.text, actor: c.actor,
      citation: c.citation, snippet: c.sourceQuote,
      indicators: (c.indicators ?? []).map((id) => ({ code: id, name: findIndicator(id)?.focus ?? id })),
      penalty: c.penalty, effectiveDate: c.effectiveDate, confidence: c.confidence,
    })),
  };
}
