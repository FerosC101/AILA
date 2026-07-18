/**
 * db.ts — Async SQLite PERSISTENCE lAYER for AILA
 *
 * Uses @libsql/client (async) so heavy DB reads never block the Node.js
 * event loop. This matters because AILA runs RAG queries, background crawls,
 * and health checks concurrently — a synchronous DB would freeze all of them.
 *
 * Tables:
 *   sources      — every crawl target (synced from markdown files)
 *   scrapes      — append-only crawl history / audit trail
 *   chunks       — RAG text chunks + embeddings (base64 Float32Array)
 *   translations — cached translated text keyed by (source_id, lang)
 *
 * Design decisions:
 *   - All public functions are async → caller always awaits, never blocks
 *   - WAL mode → concurrent reads while writing
 *   - Embeddings as base64 Float32 → smaller than JSON, fast to decode
 *   - Batch inserts use transactions → 10-100x faster than row-by-row
 *   - Prepared-statement-style parameterised queries → no SQL injection
 */

import { createClient, type Client } from "@libsql/client";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RegulationSource, ScrapeResult } from "./types.js";

// ── path setup ────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, "..", "data");
const DB_URL    = `file:${join(DATA_DIR, "aila.db")}`;

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ── client (singleton) ────────────────────────────────────────────────────────
const db: Client = createClient({ url: DB_URL });

// ── schema ────────────────────────────────────────────────────────────────────
export async function initDb(): Promise<void> {
  // WAL mode: readers and writer don't block each other
  await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA foreign_keys = ON");
  await db.execute("PRAGMA cache_size = -16000"); // 16 MB page cache

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS sources (
      id           TEXT PRIMARY KEY,
      jurisdiction TEXT NOT NULL,
      instrument   TEXT NOT NULL,
      url          TEXT NOT NULL UNIQUE,
      region       TEXT NOT NULL DEFAULT 'General',
      format       TEXT NOT NULL DEFAULT 'html',
      cadence      TEXT NOT NULL DEFAULT 'monthly',
      notes        TEXT,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_sources_jurisdiction ON sources(jurisdiction);
    CREATE INDEX IF NOT EXISTS idx_sources_cadence      ON sources(cadence);

    CREATE TABLE IF NOT EXISTS scrapes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id      TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      url            TEXT NOT NULL,
      ok             INTEGER NOT NULL DEFAULT 0,
      status         INTEGER,
      fetched_at     TEXT NOT NULL,
      title          TEXT,
      excerpt        TEXT,
      document_links TEXT,
      error          TEXT,
      created_at     INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_scrapes_source_id ON scrapes(source_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_scrapes_ok        ON scrapes(ok, created_at);

    CREATE TABLE IF NOT EXISTS chunks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id    TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      jurisdiction TEXT NOT NULL,
      instrument   TEXT NOT NULL,
      url          TEXT NOT NULL,
      chunk_index  INTEGER NOT NULL,
      text         TEXT NOT NULL,
      embedding    TEXT NOT NULL,
      built_at     INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_source_id    ON chunks(source_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_source_built ON chunks(source_id, built_at);

    CREATE TABLE IF NOT EXISTS translations (
      source_id     TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      lang          TEXT NOT NULL,
      translated    TEXT NOT NULL,
      translated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (source_id, lang)
    );

    CREATE TABLE IF NOT EXISTS clauses (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id      TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      jurisdiction   TEXT NOT NULL,
      instrument     TEXT NOT NULL,
      url            TEXT NOT NULL,
      type           TEXT NOT NULL,        -- obligation|restriction|exception|penalty|right|definition
      text           TEXT NOT NULL,        -- the extracted rule, in plain terms
      actor          TEXT,                 -- who it binds (controller, processor, individual, government)
      rdtii          TEXT,                 -- JSON array of RDTII category names
      penalty        TEXT,
      effective_date TEXT,
      citation       TEXT,                 -- section / paragraph reference
      source_quote   TEXT,                 -- verbatim excerpt used as evidence
      confidence     REAL,
      created_at     INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_clauses_source ON clauses(source_id);
    CREATE INDEX IF NOT EXISTS idx_clauses_jur    ON clauses(jurisdiction);
    CREATE INDEX IF NOT EXISTS idx_clauses_type   ON clauses(type);
  `);

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS versions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id   TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      hash        TEXT NOT NULL,
      text        TEXT NOT NULL,
      captured_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_versions_source ON versions(source_id, captured_at);
  `);

  // Chatbot conversation memory: each answer is saved as an "article" a user can
  // revisit and the AI can reuse as prior knowledge within the conversation.
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS conversations (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS articles (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      question        TEXT NOT NULL,
      summary         TEXT NOT NULL,
      verdict         TEXT,
      confidence      REAL,
      payload         TEXT NOT NULL,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_articles_conv ON articles(conversation_id, created_at);
  `);

  // AILA v5 provision-validation output — one row per validated legal provision,
  // traceable to the originating Round-1 database row (the 13-column ESCAP template).
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS validations (
      id                TEXT PRIMARY KEY,
      db_row            TEXT,
      economy           TEXT NOT NULL,
      law_name          TEXT,
      law_number        TEXT,
      last_amended      TEXT,
      indicator_id      TEXT,
      article_section   TEXT,
      discovery_tag     TEXT,
      verbatim          TEXT,
      mapping_rationale TEXT,
      source_url        TEXT,
      confidence        REAL,
      notes             TEXT,
      seed_json         TEXT,
      coverage          TEXT,
      timeframe         TEXT,
      impact_comments   TEXT,
      level             TEXT,
      created_at        INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_validations_econ ON validations(economy);
    CREATE INDEX IF NOT EXISTS idx_validations_ind  ON validations(indicator_id);
    CREATE INDEX IF NOT EXISTS idx_validations_tag  ON validations(discovery_tag);
  `);

  // migration: clause embeddings (older DBs created the table without it)
  try { await db.execute("ALTER TABLE clauses ADD COLUMN embedding TEXT"); } catch { /* already exists */ }
  // migration: real RDTII indicator IDs (P#-I#) per clause
  try { await db.execute("ALTER TABLE clauses ADD COLUMN indicators TEXT"); } catch { /* already exists */ }
  // migration: compulsory output fields (UN ESCAP output guide)
  for (const col of ["level", "law_number", "last_amended", "location_reference", "mapping_rationale", "discovery_tag", "notes"]) {
    try { await db.execute(`ALTER TABLE clauses ADD COLUMN ${col} TEXT`); } catch { /* already exists */ }
  }
  // migration: Coverage / Timeframe / Impact-or-Comments — previously only existed at the
  // source/row level (markdown seed tables); now plumbed to the clause level so the export
  // registry can populate them instead of leaving them blank.
  for (const col of ["coverage", "timeframe", "impact_comments"]) {
    try { await db.execute(`ALTER TABLE clauses ADD COLUMN ${col} TEXT`); } catch { /* already exists */ }
    try { await db.execute(`ALTER TABLE validations ADD COLUMN ${col} TEXT`); } catch { /* already exists */ }
  }
  // migration: Level — validations previously had no legal-hierarchy field at all
  // (Act | Regulation | Amendment | ...); now filled via clauses cross-reference
  // in validate.ts (extract.ts already captures it per clause for the same law).
  try { await db.execute("ALTER TABLE validations ADD COLUMN level TEXT"); } catch { /* already exists */ }
}

// ── Versions (semantic version control) ────────────────────────────────────────

function hashText(t: string): string {
  return createHash("sha1").update(t).digest("hex");
}

export interface DocVersion { id: number; hash: string; text: string; capturedAt: number }

/** Snapshot a document's text — only inserts a new row when the content changed. */
export async function snapshotVersion(sourceId: string, text: string): Promise<{ changed: boolean; versions: number }> {
  if (!text || text.length < 80) return { changed: false, versions: 0 };
  const hash = hashText(text);
  const latest = await db.execute({ sql: "SELECT hash FROM versions WHERE source_id = ? ORDER BY captured_at DESC LIMIT 1", args: [sourceId] });
  const prevHash = (latest.rows[0] as any)?.hash;
  if (prevHash === hash) {
    const c = await db.execute({ sql: "SELECT COUNT(*) as n FROM versions WHERE source_id = ?", args: [sourceId] });
    return { changed: false, versions: Number((c.rows[0] as any).n) };
  }
  await db.execute({ sql: "INSERT INTO versions (source_id, hash, text) VALUES (?, ?, ?)", args: [sourceId, hash, text.slice(0, 20000)] });
  const c = await db.execute({ sql: "SELECT COUNT(*) as n FROM versions WHERE source_id = ?", args: [sourceId] });
  return { changed: true, versions: Number((c.rows[0] as any).n) };
}

/** Most recent two versions of a source (for diffing), newest first. */
export async function getLatestTwoVersions(sourceId: string): Promise<DocVersion[]> {
  const res = await db.execute({ sql: "SELECT * FROM versions WHERE source_id = ? ORDER BY captured_at DESC LIMIT 2", args: [sourceId] });
  return res.rows.map((r: any) => ({ id: Number(r.id), hash: r.hash, text: r.text, capturedAt: Number(r.captured_at) }));
}

/** Version history metadata (no text) for a source. */
export async function getVersionHistory(sourceId: string): Promise<Array<{ id: number; hash: string; capturedAt: number; length: number }>> {
  const res = await db.execute({ sql: "SELECT id, hash, captured_at, LENGTH(text) as len FROM versions WHERE source_id = ? ORDER BY captured_at DESC", args: [sourceId] });
  return res.rows.map((r: any) => ({ id: Number(r.id), hash: r.hash, capturedAt: Number(r.captured_at), length: Number(r.len) }));
}

// ── Conversations & articles (chatbot memory) ─────────────────────────────────

export interface ArticleRow { id: string; conversationId: string; question: string; summary: string; verdict?: string; confidence?: number; payload: any; createdAt: number }
export interface ConversationRow { id: string; title: string; createdAt: number; updatedAt: number; articleCount?: number }

/** Create a conversation (title = first question, trimmed). Returns its id. */
export async function createConversation(title: string): Promise<string> {
  const id = `conv-${randomUUID().slice(0, 8)}`;
  await db.execute({ sql: "INSERT INTO conversations (id, title) VALUES (?, ?)", args: [id, title.slice(0, 120)] });
  return id;
}

/** Persist an answer as an article in a conversation, and bump the conversation's updated_at. */
export async function saveArticle(conversationId: string, question: string, result: any): Promise<string> {
  const id = `art-${randomUUID().slice(0, 8)}`;
  await db.batch([
    { sql: `INSERT INTO articles (id, conversation_id, question, summary, verdict, confidence, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, conversationId, question, String(result.summary ?? "").slice(0, 2000),
        result.verdict ?? null, typeof result.confidence === "number" ? result.confidence : null, JSON.stringify(result)] },
    { sql: "UPDATE conversations SET updated_at = unixepoch() WHERE id = ?", args: [conversationId] },
  ], "write");
  return id;
}

/** List conversations, newest first, with article counts. */
export async function listConversations(limit = 50): Promise<ConversationRow[]> {
  const res = await db.execute({
    sql: `SELECT c.id, c.title, c.created_at, c.updated_at, COUNT(a.id) as n
          FROM conversations c LEFT JOIN articles a ON a.conversation_id = c.id
          GROUP BY c.id ORDER BY c.updated_at DESC LIMIT ?`,
    args: [limit],
  });
  return res.rows.map((r: any) => ({ id: r.id, title: r.title, createdAt: Number(r.created_at), updatedAt: Number(r.updated_at), articleCount: Number(r.n) }));
}

/** A conversation with its ordered articles (lightweight — summary/verdict, not full payload). */
export async function getConversation(id: string): Promise<{ conversation: ConversationRow; articles: ArticleRow[] } | null> {
  const c = await db.execute({ sql: "SELECT * FROM conversations WHERE id = ?", args: [id] });
  if (!c.rows.length) return null;
  const row: any = c.rows[0];
  const a = await db.execute({ sql: "SELECT id, conversation_id, question, summary, verdict, confidence, created_at FROM articles WHERE conversation_id = ? ORDER BY created_at ASC", args: [id] });
  return {
    conversation: { id: row.id, title: row.title, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) },
    articles: a.rows.map((r: any) => ({ id: r.id, conversationId: r.conversation_id, question: r.question, summary: r.summary, verdict: r.verdict ?? undefined, confidence: r.confidence ?? undefined, payload: undefined, createdAt: Number(r.created_at) })),
  };
}

/** Full article payload (the stored RagResult) for reopening an answer. */
export async function getArticle(id: string): Promise<ArticleRow | null> {
  const res = await db.execute({ sql: "SELECT * FROM articles WHERE id = ?", args: [id] });
  if (!res.rows.length) return null;
  const r: any = res.rows[0];
  return { id: r.id, conversationId: r.conversation_id, question: r.question, summary: r.summary, verdict: r.verdict ?? undefined, confidence: r.confidence ?? undefined, payload: JSON.parse(r.payload), createdAt: Number(r.created_at) };
}

/** Most-recent article summaries in a conversation — fed back to the model as prior findings. */
export async function priorFindings(conversationId: string, limit = 3): Promise<string> {
  const res = await db.execute({ sql: "SELECT question, summary FROM articles WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?", args: [conversationId, limit] });
  return res.rows.reverse().map((r: any, i: number) => `[P${i + 1}] Q: ${r.question}\n    A: ${r.summary}`).join("\n");
}

// ── Validations (AILA v5 provision validation) ────────────────────────────────

export type DiscoveryTag = "VERIFIED" | "UPDATED" | "NEW" | "INVALID";
export interface ValidationRow {
  id?: string;
  dbRow?: string;            // Location Reference — originating Round-1 DB row (e.g. "DB Row 43")
  economy: string;
  lawName?: string;
  lawNumber?: string;
  level?: string;            // legal hierarchy: Act | Regulation | Amendment | Sector Code | ... — backfilled via clauses cross-reference, validate.ts's own prompt doesn't ask for it
  lastAmended?: string;
  indicatorId?: string;      // P#-I#
  articleSection?: string;
  discoveryTag?: DiscoveryTag;
  verbatim?: string;         // exact statutory text (blank if not officially retrieved)
  mappingRationale?: string;
  sourceUrl?: string;
  confidence?: number;       // 0..1 (exported High/Medium/Low)
  notes?: string;
  seed?: any;                // the original seed row (for audit)
  coverage?: string;         // sectoral/subject-matter scope (e.g. "Cross-cutting", "Telecommunications services")
  timeframe?: string;        // temporal scope (e.g. "Since 2023", "Since 1988, last amended 2024")
  impactComments?: string;   // ESCAP "Impact or Comments on Acts or Practices" field
}

/** Replace all validation rows for a seed DB row (idempotent re-validation), or append if no dbRow. */
export async function saveValidations(rows: ValidationRow[], replaceDbRow?: string): Promise<void> {
  const stmts: { sql: string; args: any[] }[] = [];
  if (replaceDbRow) stmts.push({ sql: "DELETE FROM validations WHERE db_row = ?", args: [replaceDbRow] });
  for (const r of rows) {
    stmts.push({
      sql: `INSERT INTO validations
        (id, db_row, economy, law_name, law_number, last_amended, indicator_id, article_section,
         discovery_tag, verbatim, mapping_rationale, source_url, confidence, notes, seed_json,
         coverage, timeframe, impact_comments, level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,  ?, ?, ?, ?)`,
      args: [
        `val-${randomUUID().slice(0, 8)}`, r.dbRow ?? null, r.economy, r.lawName ?? null, r.lawNumber ?? null,
        r.lastAmended ?? null, r.indicatorId ?? null, r.articleSection ?? null, r.discoveryTag ?? null,
        r.verbatim ?? null, r.mappingRationale ?? null, r.sourceUrl ?? null,
        typeof r.confidence === "number" ? r.confidence : null, r.notes ?? null,
        r.seed ? JSON.stringify(r.seed) : null,
        r.coverage ?? null, r.timeframe ?? null, r.impactComments ?? null, r.level ?? null,
      ],
    });
  }
  if (stmts.length) await db.batch(stmts, "write");
}

function hydrateValidation(row: any): ValidationRow {
  return {
    id: row.id, dbRow: row.db_row ?? undefined, economy: row.economy,
    lawName: row.law_name ?? undefined, lawNumber: row.law_number ?? undefined,
    level: row.level ?? undefined,
    lastAmended: row.last_amended ?? undefined, indicatorId: row.indicator_id ?? undefined,
    articleSection: row.article_section ?? undefined, discoveryTag: row.discovery_tag ?? undefined,
    verbatim: row.verbatim ?? undefined, mappingRationale: row.mapping_rationale ?? undefined,
    sourceUrl: row.source_url ?? undefined, confidence: row.confidence ?? undefined,
    notes: row.notes ?? undefined, seed: row.seed_json ? JSON.parse(row.seed_json) : undefined,
    coverage: row.coverage ?? undefined, timeframe: row.timeframe ?? undefined,
    impactComments: row.impact_comments ?? undefined,
  };
}

/** Query validations with optional filters. */
export async function loadValidations(filter: { economy?: string; indicator?: string; tag?: string; limit?: number } = {}): Promise<ValidationRow[]> {
  const where: string[] = [];
  const args: any[] = [];
  if (filter.economy) { where.push("LOWER(economy) = ?"); args.push(filter.economy.toLowerCase()); }
  if (filter.indicator) { where.push("indicator_id = ?"); args.push(filter.indicator); }
  if (filter.tag) { where.push("discovery_tag = ?"); args.push(filter.tag.toUpperCase()); }
  const sql = `SELECT * FROM validations ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY economy, db_row, indicator_id LIMIT ?`;
  args.push(filter.limit ?? 10_000);
  const res = await db.execute({ sql, args });
  return res.rows.map(hydrateValidation);
}

/** Counts by discovery tag (end-of-batch summary). */
export async function validationStats() {
  const res = await db.execute("SELECT discovery_tag as tag, COUNT(*) as n FROM validations GROUP BY discovery_tag");
  const byTag: Record<string, number> = {};
  let total = 0;
  for (const r of res.rows as any[]) { byTag[r.tag ?? "UNTAGGED"] = Number(r.n); total += Number(r.n); }
  return { total, byTag };
}

// ── embedding helpers ─────────────────────────────────────────────────────────

/** Encode number[] → base64 Float32 string for storage */
function encodeEmbedding(v: number[]): string {
  const buf = Buffer.allocUnsafe(v.length * 4);
  v.forEach((x, i) => buf.writeFloatLE(x, i * 4));
  return buf.toString("base64");
}

/** Decode base64 Float32 string → number[] */
function decodeEmbedding(b64: string): number[] {
  const buf = Buffer.from(b64, "base64");
  const out: number[] = new Array(buf.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = buf.readFloatLE(i * 4);
  return out;
}

// ── Sources ───────────────────────────────────────────────────────────────────

/**
 * Upsert a batch of sources in one transaction.
 * Safe to call on every server start — won't duplicate rows.
 */
export async function upsertSources(sources: RegulationSource[]): Promise<void> {
  if (!sources.length) return;

  const stmts = sources.map((s) => ({
    sql: `
      INSERT INTO sources (id, jurisdiction, instrument, url, region, format, cadence, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        jurisdiction = excluded.jurisdiction,
        instrument   = excluded.instrument,
        url          = excluded.url,
        region       = excluded.region,
        format       = excluded.format,
        cadence      = excluded.cadence,
        notes        = excluded.notes,
        updated_at   = unixepoch()
    `,
    args: [s.id, s.jurisdiction, s.instrument, s.url, s.region, s.format, s.cadence, s.notes ?? null],
  }));

  await db.batch(stmts, "write");
}

export async function getAllSources(): Promise<RegulationSource[]> {
  const res = await db.execute("SELECT * FROM sources ORDER BY jurisdiction, instrument");
  return res.rows as unknown as RegulationSource[];
}

export async function getSourceById(id: string): Promise<RegulationSource | undefined> {
  const res = await db.execute({ sql: "SELECT * FROM sources WHERE id = ?", args: [id] });
  return res.rows[0] as unknown as RegulationSource | undefined;
}

// ── Scrapes ───────────────────────────────────────────────────────────────────

/** Persist a crawl result and return the new row id. */
export async function insertScrape(r: ScrapeResult): Promise<number> {
  const res = await db.execute({
    sql: `
      INSERT INTO scrapes
        (source_id, url, ok, status, fetched_at, title, excerpt, document_links, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      r.sourceId,
      r.url,
      r.ok ? 1 : 0,
      r.status ?? null,
      r.fetchedAt,
      r.title ?? null,
      r.excerpt ?? null,
      r.documentLinks ? JSON.stringify(r.documentLinks) : null,
      r.error ?? null,
    ],
  });
  return Number(res.lastInsertRowid);
}

export async function getLatestScrape(sourceId: string): Promise<ScrapeResult | undefined> {
  const res = await db.execute({
    sql: "SELECT * FROM scrapes WHERE source_id = ? ORDER BY created_at DESC LIMIT 1",
    args: [sourceId],
  });
  const row = res.rows[0];
  return row ? hydrateScrape(row) : undefined;
}

export async function getRecentScrapes(limit = 100): Promise<ScrapeResult[]> {
  const res = await db.execute({
    sql: "SELECT * FROM scrapes ORDER BY created_at DESC LIMIT ?",
    args: [limit],
  });
  return res.rows.map(hydrateScrape);
}

export async function getFailedScrapes(limit = 50): Promise<any[]> {
  const res = await db.execute({
    sql: `
      SELECT s.*, src.instrument, src.jurisdiction
      FROM scrapes s
      JOIN sources src ON src.id = s.source_id
      WHERE s.ok = 0
      ORDER BY s.created_at DESC
      LIMIT ?
    `,
    args: [limit],
  });
  return res.rows as any[];
}

function hydrateScrape(row: any): ScrapeResult {
  return {
    ...row,
    ok:            row.ok === 1,
    documentLinks: row.document_links ? JSON.parse(row.document_links) : undefined,
  };
}

// ── Chunks (RAG index) ────────────────────────────────────────────────────────

export interface StoredChunk {
  id: number;
  sourceId: string;
  jurisdiction: string;
  instrument: string;
  url: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
}

/**
 * Replace all chunks for a source atomically then insert new ones.
 * Runs as a single transaction — no partial state on failure.
 */
export async function saveChunks(
  sourceId: string,
  chunks: Array<{
    text: string;
    embedding: number[];
    jurisdiction: string;
    instrument: string;
    url: string;
  }>,
): Promise<void> {
  const stmts: { sql: string; args: any[] }[] = [
    // delete old chunks for this source first
    { sql: "DELETE FROM chunks WHERE source_id = ?", args: [sourceId] },
    // insert new chunks
    ...chunks.map((c, i) => ({
      sql: `
        INSERT INTO chunks (source_id, jurisdiction, instrument, url, chunk_index, text, embedding)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [sourceId, c.jurisdiction, c.instrument, c.url, i, c.text, encodeEmbedding(c.embedding)],
    })),
  ];

  await db.batch(stmts, "write");
}

/**
 * Load chunks for the RAG index.
 *
 * FIX 2: Added optional `limit` parameter. When provided, returns only the
 * most recently embedded rows (ORDER BY built_at DESC) so the in-memory index
 * stays bounded as the corpus grows. Without a limit, behaviour is unchanged
 * (used internally for full exports/audits only — not for startup restore).
 */
export async function loadAllChunks(limit?: number): Promise<StoredChunk[]> {
  if (limit) {
    const res = await db.execute({
      sql: "SELECT * FROM chunks ORDER BY built_at DESC, source_id, chunk_index LIMIT ?",
      args: [limit],
    });
    return res.rows.map(hydrateChunk);
  }
  const res = await db.execute("SELECT * FROM chunks ORDER BY source_id, chunk_index");
  return res.rows.map(hydrateChunk);
}

/** Load chunks for a single source — used for partial refresh. */
export async function loadChunksBySource(sourceId: string): Promise<StoredChunk[]> {
  const res = await db.execute({
    sql: "SELECT * FROM chunks WHERE source_id = ? ORDER BY chunk_index",
    args: [sourceId],
  });
  return res.rows.map(hydrateChunk);
}

export async function getChunkCount(): Promise<number> {
  const res = await db.execute("SELECT COUNT(*) as n FROM chunks");
  return Number((res.rows[0] as any).n);
}

/**
 * Returns the unix timestamp (seconds) when this source was last embedded,
 * or null if never embedded.
 */
export async function getSourceEmbeddedAt(sourceId: string): Promise<number | null> {
  const res = await db.execute({
    sql: "SELECT built_at FROM chunks WHERE source_id = ? ORDER BY built_at DESC LIMIT 1",
    args: [sourceId],
  });
  const row = res.rows[0] as any;
  return row ? Number(row.built_at) : null;
}

function hydrateChunk(row: any): StoredChunk {
  return {
    id:           Number(row.id),
    sourceId:     row.source_id,
    jurisdiction: row.jurisdiction,
    instrument:   row.instrument,
    url:          row.url,
    chunkIndex:   Number(row.chunk_index),
    text:         row.text,
    embedding:    decodeEmbedding(row.embedding),
  };
}

// ── Translations ──────────────────────────────────────────────────────────────

export async function saveTranslation(
  sourceId: string,
  lang: string,
  translated: string,
): Promise<void> {
  await db.execute({
    sql: `
      INSERT INTO translations (source_id, lang, translated)
      VALUES (?, ?, ?)
      ON CONFLICT(source_id, lang) DO UPDATE SET
        translated    = excluded.translated,
        translated_at = unixepoch()
    `,
    args: [sourceId, lang, translated],
  });
}

export async function getCachedTranslation(
  sourceId: string,
  lang: string,
): Promise<string | null> {
  const res = await db.execute({
    sql: "SELECT translated FROM translations WHERE source_id = ? AND lang = ?",
    args: [sourceId, lang],
  });
  const row = res.rows[0] as any;
  return row ? (row.translated as string) : null;
}

// ── Clauses (clause-level extraction) ──────────────────────────────────────────

export interface StoredClause {
  id?: number;
  sourceId: string;
  jurisdiction: string;
  instrument: string;
  url: string;
  type: string;
  text: string;
  actor?: string;
  indicators?: string[];      // OFFICIAL RDTII indicator IDs (P#-I#) — multi-indicator
  rdtii?: string[];           // the focus label for each indicator (display / back-compat)
  level?: string;            // legal hierarchy: Act | Regulation | Amendment | Sector Code | ...
  lawNumber?: string;        // act/decree number (e.g. "Act 709", "R.A. 10173")
  lastAmended?: string;      // when last changed (distinct from effectiveDate = when it started)
  locationReference?: string;// precise location (part/paragraph/page), distinct from citation
  mappingRationale?: string; // why these indicators were assigned (persisted)
  discoveryTag?: string;     // flag for a substantive clause with no RDTII match ("new discovery")
  notes?: string;            // per-clause analyst note
  coverage?: string;         // sectoral/subject-matter scope (e.g. "Cross-cutting", "Telecommunications services") — document-level, stamped per clause
  timeframe?: string;        // temporal scope (e.g. "Since 2023", "Since 1988, last amended 2024") — document-level, stamped per clause
  impactComments?: string;   // ESCAP "Impact or Comments on Acts or Practices" — per-clause
  penalty?: string;
  effectiveDate?: string;
  citation?: string;
  sourceQuote?: string;
  confidence?: number;
  reviewNeeded?: boolean;    // derived: confidence below REVIEW_THRESHOLD → flag for human review
  embedding?: number[];
}

/** Clauses at/under this confidence are auto-flagged for human review. */
export const REVIEW_THRESHOLD = Number(process.env.REVIEW_THRESHOLD ?? 0.8);

/** Replace all clauses for a source (idempotent re-extraction). */
export async function saveClauses(sourceId: string, clauses: StoredClause[]): Promise<void> {
  const stmts: { sql: string; args: any[] }[] = [
    { sql: "DELETE FROM clauses WHERE source_id = ?", args: [sourceId] },
    ...clauses.map((c) => ({
      sql: `INSERT INTO clauses
        (source_id, jurisdiction, instrument, url, type, text, actor, indicators, rdtii, penalty, effective_date, citation, source_quote, confidence, embedding,
         level, law_number, last_amended, location_reference, mapping_rationale, discovery_tag, notes,
         coverage, timeframe, impact_comments)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,  ?, ?, ?, ?, ?, ?, ?,  ?, ?, ?)`,
      args: [
        sourceId, c.jurisdiction, c.instrument, c.url, c.type, c.text,
        c.actor ?? null, JSON.stringify(c.indicators ?? []), JSON.stringify(c.rdtii ?? []), c.penalty ?? null,
        c.effectiveDate ?? null, c.citation ?? null, c.sourceQuote ?? null, c.confidence ?? null,
        c.embedding && c.embedding.length ? encodeEmbedding(c.embedding) : null,
        c.level ?? null, c.lawNumber ?? null, c.lastAmended ?? null, c.locationReference ?? null,
        c.mappingRationale ?? null, c.discoveryTag ?? null, c.notes ?? null,
        c.coverage ?? null, c.timeframe ?? null, c.impactComments ?? null,
      ],
    })),
  ];
  await db.batch(stmts, "write");
}

/** Clauses that have embeddings — used as high-precision retrieval units in RAG. */
export async function loadClauseEmbeddings(): Promise<StoredClause[]> {
  const res = await db.execute("SELECT * FROM clauses WHERE embedding IS NOT NULL");
  return res.rows.map((row: any) => ({ ...hydrateClause(row), embedding: decodeEmbedding(row.embedding) }));
}

function hydrateClause(row: any): StoredClause {
  return {
    id: Number(row.id), sourceId: row.source_id, jurisdiction: row.jurisdiction,
    instrument: row.instrument, url: row.url, type: row.type, text: row.text,
    actor: row.actor ?? undefined,
    indicators: row.indicators ? JSON.parse(row.indicators) : [],
    rdtii: row.rdtii ? JSON.parse(row.rdtii) : [],
    level: row.level ?? undefined, lawNumber: row.law_number ?? undefined,
    lastAmended: row.last_amended ?? undefined, locationReference: row.location_reference ?? undefined,
    mappingRationale: row.mapping_rationale ?? undefined, discoveryTag: row.discovery_tag ?? undefined,
    notes: row.notes ?? undefined,
    coverage: row.coverage ?? undefined, timeframe: row.timeframe ?? undefined,
    impactComments: row.impact_comments ?? undefined,
    penalty: row.penalty ?? undefined, effectiveDate: row.effective_date ?? undefined,
    citation: row.citation ?? undefined, sourceQuote: row.source_quote ?? undefined,
    confidence: row.confidence ?? undefined,
    reviewNeeded: row.confidence != null && Number(row.confidence) < REVIEW_THRESHOLD,
  };
}

/** Query clauses with optional filters (jurisdiction / type / actor substring). */
export async function loadClauses(filter: { jurisdiction?: string; type?: string; sourceId?: string; limit?: number } = {}): Promise<StoredClause[]> {
  const where: string[] = [];
  const args: any[] = [];
  if (filter.sourceId) { where.push("source_id = ?"); args.push(filter.sourceId); }
  if (filter.jurisdiction) { where.push("LOWER(jurisdiction) = ?"); args.push(filter.jurisdiction.toLowerCase()); }
  if (filter.type) { where.push("type = ?"); args.push(filter.type); }
  const sql = `SELECT * FROM clauses ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY jurisdiction, source_id, id LIMIT ?`;
  args.push(filter.limit ?? 500);
  const res = await db.execute({ sql, args });
  return res.rows.map(hydrateClause);
}

export async function getClauseCount(): Promise<number> {
  const res = await db.execute("SELECT COUNT(*) as n FROM clauses");
  return Number((res.rows[0] as any).n);
}

/**
 * Best-effort cross-reference: given an economy + law name from the validation
 * pipeline, look up whatever extract.ts already captured for the same law
 * (level, law number, last amended, coverage, timeframe) and return it. Zero
 * Gemini cost — this is data already sitting in the clauses table from a
 * different pipeline, not a new extraction. Exact instrument-name match first;
 * falls back to a substring match either direction since seed law names are
 * often shorter/longer than the officially extracted title (e.g. "Data
 * Protection Act" vs "Personal Data Protection Act 2010"). When multiple
 * clauses match, uses majority vote per field so one mis-tagged clause
 * doesn't skew the result. Returns undefined (never a guess) when nothing
 * matches, and only includes the fields that actually resolved.
 */
export async function crossRefClauseFields(
  jurisdiction: string | undefined,
  lawName: string | undefined,
): Promise<{ level?: string; lawNumber?: string; lastAmended?: string; coverage?: string; timeframe?: string } | undefined> {
  if (!jurisdiction || !lawName) return undefined;
  const res = await db.execute({
    sql: `SELECT level, law_number, last_amended, coverage, timeframe, instrument FROM clauses
          WHERE LOWER(jurisdiction) = ?
            AND (LOWER(instrument) = LOWER(?) OR LOWER(instrument) LIKE '%' || LOWER(?) || '%' OR LOWER(?) LIKE '%' || LOWER(instrument) || '%')
          LIMIT 50`,
    args: [jurisdiction.toLowerCase(), lawName, lawName, lawName],
  });
  const rows = res.rows as any[];
  if (!rows.length) return undefined;

  const mode = (field: string): string | undefined => {
    const counts = new Map<string, number>();
    for (const r of rows) { const v = r[field]; if (v) counts.set(v, (counts.get(v) ?? 0) + 1); }
    let best: string | undefined, bestN = 0;
    for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
    return best;
  };
  const result = {
    level: mode("level"), lawNumber: mode("law_number"), lastAmended: mode("last_amended"),
    coverage: mode("coverage"), timeframe: mode("timeframe"),
  };
  return (result.level || result.lawNumber || result.lastAmended || result.coverage || result.timeframe) ? result : undefined;
}

// ── Stats (health endpoint / dashboard) ───────────────────────────────────────

export async function dbStats() {
  const [sources, scrapes, chunks, clauses, ok, fail, lastScrape] = await Promise.all([
    db.execute("SELECT COUNT(*) as n FROM sources"),
    db.execute("SELECT COUNT(*) as n FROM scrapes"),
    db.execute("SELECT COUNT(*) as n FROM chunks"),
    db.execute("SELECT COUNT(*) as n FROM clauses"),
    db.execute("SELECT COUNT(*) as n FROM scrapes WHERE ok = 1"),
    db.execute("SELECT COUNT(*) as n FROM scrapes WHERE ok = 0"),
    db.execute("SELECT MAX(created_at) as t FROM scrapes"),
  ]);

  return {
    sources:      Number((sources.rows[0] as any).n),
    scrapes:      Number((scrapes.rows[0] as any).n),
    chunks:       Number((chunks.rows[0] as any).n),
    clauses:      Number((clauses.rows[0] as any).n),
    ok:           Number((ok.rows[0] as any).n),
    fail:         Number((fail.rows[0] as any).n),
    lastScrapeAt: (lastScrape.rows[0] as any).t ?? null,
  };
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on("exit",    () => db.close());
process.on("SIGINT",  () => { db.close(); process.exit(0); });
process.on("SIGTERM", () => { db.close(); process.exit(0); });

export { db };