/**
 * translate.ts — Multilingual translation for AILA
 *
 * Supports: Thai (th), Indonesian (id), Vietnamese (vi), Chinese (zh)
 * Uses Gemini to translate non-English regulation text → English
 * Results cached in DB translations table → never translate same doc twice
 *
 * Flow:
 *   1. Detect language of extracted text
 *   2. If already English → skip (no API cost)
 *   3. If non-English → check DB cache first
 *   4. Cache miss → translate via Gemini → save to DB
 *   5. Return English text for RAG embedding
 *
 * Why this matters:
 *   Thai PDPA, Vietnamese Cybersecurity Law, Indonesian PDP Law
 *   are all published in their native language. Without translation,
 *   RAG embeddings are useless for English queries.
 */

import { getCachedTranslation, saveTranslation } from "./db.js";
import { recordGeminiUsage } from "./cost.js";

// ── config ────────────────────────────────────────────────────────────────────

/** Languages we actively translate. ISO 639-1 codes. */
const SUPPORTED_LANGUAGES: Record<string, string> = {
  th: "Thai",
  id: "Indonesian",
  vi: "Vietnamese",
  zh: "Chinese",
  ms: "Malay",
};

/** Jurisdiction → likely language mapping (fast path before detection) */
const JURISDICTION_LANG: Record<string, string> = {
  Thailand:    "th",
  Indonesia:   "id",
  Vietnam:     "vi",
  China:       "zh",
  Malaysia:    "ms", // Malaysia often publishes in both EN and MS
};

/** Min text length to bother translating */
const MIN_TRANSLATE_LEN = 80;

// ── language detection ────────────────────────────────────────────────────────

/**
 * Lightweight language detection using character set heuristics.
 * Avoids API calls for the common case (English text).
 *
 * Returns ISO 639-1 code or "en" if English/unknown.
 */
export function detectLanguage(text: string): string {
  if (!text || text.length < 20) return "en";

  const sample = text.slice(0, 500);

  // Thai: Unicode range U+0E00–U+0E7F
  if (/[\u0E00-\u0E7F]/.test(sample)) return "th";

  // Vietnamese: diacritics specific to Vietnamese
  if (/[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(sample)) return "vi";

  // Chinese (Simplified + Traditional): CJK Unified Ideographs
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(sample)) return "zh";

  // Indonesian/Malay heuristic: common words
  if (/\b(yang|dan|atau|dengan|untuk|dalam|tidak|pada|adalah|ini|itu|oleh|kepada)\b/i.test(sample)) return "id";

  return "en";
}

/**
 * Should we translate this text?
 * Returns the detected language code, or null if translation not needed.
 */
export function needsTranslation(text: string, jurisdiction?: string): string | null {
  if (!text || text.trim().length < MIN_TRANSLATE_LEN) return null;

  // Fast path: check jurisdiction first
  if (jurisdiction && JURISDICTION_LANG[jurisdiction]) {
    const lang = JURISDICTION_LANG[jurisdiction];
    // Still verify with character detection — many docs are bilingual
    const detected = detectLanguage(text);
    if (detected === lang || detected !== "en") return detected;
  }

  // Full detection
  const lang = detectLanguage(text);
  return lang === "en" ? null : lang;
}

// ── translation ───────────────────────────────────────────────────────────────

/**
 * Translate text to English using Gemini.
 * Preserves legal terminology and structure.
 */
async function translateWithGemini(
  text: string,
  sourceLang: string,
  apiKey: string,
): Promise<string | null> {
  const langName = SUPPORTED_LANGUAGES[sourceLang] ?? sourceLang;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const prompt = `You are a legal document translator specializing in ASEAN regulatory texts.

Translate the following ${langName} regulatory text to English.
Rules:
- Preserve all legal terminology, article numbers, section references
- Keep proper nouns (names of laws, agencies, organizations) in their original form with English translation in parentheses on first use
- Maintain the original document structure (articles, sections, subsections)
- Do NOT add commentary or explanations — translation only
- If a term has no direct English equivalent, transliterate and add a brief parenthetical

${langName} text:
${text}

English translation:`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 }, // low temp = consistent translation
        }),
      },
    );

    if (!res.ok) {
      console.error(`[Translate] Gemini error ${res.status}`);
      return null;
    }

    const data: any = await res.json();
    recordGeminiUsage(model, data);
    const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return translated ?? null;

  } catch (err) {
    console.error("[Translate] Failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Translate regulation text to English if needed.
 * Checks DB cache first — never translates the same document twice.
 *
 * @param text         Raw extracted text from scraper
 * @param sourceId     DB source ID — used as cache key
 * @param jurisdiction Jurisdiction name — used for language hint
 * @returns            English text (translated or original)
 */
export async function ensureEnglish(
  text: string,
  sourceId: string,
  jurisdiction?: string,
): Promise<string> {

  // 1. Check if translation needed
  const lang = needsTranslation(text, jurisdiction);
  if (!lang) return text; // already English

  console.log(`[Translate] Detected ${SUPPORTED_LANGUAGES[lang] ?? lang} for ${sourceId}`);

  // 2. Check DB cache
  const cached = await getCachedTranslation(sourceId, lang);
  if (cached) {
    console.log(`[Translate] Cache hit for ${sourceId} (${lang})`);
    return cached;
  }

  // 3. Get API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Translate] No GEMINI_API_KEY — returning original text");
    return text;
  }

  // 4. Translate
  console.log(`[Translate] Translating ${sourceId} from ${lang} via Gemini...`);
  const translated = await translateWithGemini(text, lang, apiKey);

  if (!translated) {
    console.warn(`[Translate] Translation failed for ${sourceId} — using original`);
    return text;
  }

  // 5. Cache result
  await saveTranslation(sourceId, lang, translated);
  console.log(`[Translate] Saved translation for ${sourceId} (${lang} → en)`);

  return translated;
}

/**
 * Translation status for the /health endpoint.
 */
export function translateStatus() {
  return {
    supported: Object.keys(SUPPORTED_LANGUAGES),
    languages: SUPPORTED_LANGUAGES,
  };
}