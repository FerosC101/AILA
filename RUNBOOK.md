# AILA — Run & Demo Runbook

AILA = **frontend** (React/Vite, `src/`) + **backend** (Node/Express/TS, `server/`) + **SQLite** (`server/data/aila.db`, auto-created) + **Gemini API** (hosted — no model to train).

## Prerequisites
- Node 18+
- A Gemini API key from https://aistudio.google.com/apikey in `server/.env`:
  ```
  GEMINI_API_KEY=AIza...
  GEMINI_MODEL=gemini-2.5-flash
  ```

## First-time setup
```bash
# backend deps
cd server && npm install && cd ..
# frontend deps
npm install
# point the frontend at the backend
echo 'VITE_AILA_API_BASE_URL=http://localhost:8787' > .env.local
```

## Run (one command)
```bash
npm run dev:all      # starts backend (:8787) + frontend (:5173) together
```
Or two terminals:
```bash
cd server && npm run dev     # backend
npm run dev                  # frontend (repo root)
```
Open http://localhost:5173. The DB and tables self-create on first backend boot.

> The very first `/graph` load takes ~30s while the backend checks which URLs are
> live (link-health cache). After that it's instant.

## Before a demo — pre-warm (recommended)
With the backend running:
```bash
npm run prewarm              # warms health + graph + RAG index
npm run prewarm -- --extract # ALSO extracts clauses across all sources (slow, Gemini-heavy)
```
Pre-warming means live queries are fast and won't hit Gemini rate limits.

## What to show
- **Graph** — active regulatory network (country → pillar → URL). Click a node → drawer.
  - drawer: **Classify with AI** (RDTII), **Extract clauses** (structured atoms + evidence), **Check amendments** (semantic diff).
- **Consultation** — ask a question → structured, cited RAG brief (verdict, key points, risks, recommendations, evidence viewer with match scores).
- **Simulation** — build a scenario → per-jurisdiction compliance verdict (digital twin).
- **Document Archive** — clause explorer (filter by jurisdiction/type) + "Extract clauses (all sources)".

## Accuracy eval
```bash
cd server && npm run eval    # retrieval hit-rate, top-1 precision, grounded-rate, avg confidence
```

## Optional: unblock JavaScript-rendered gov sites
```bash
cd server && npx playwright install chromium
# add USE_PLAYWRIGHT=1 to server/.env, restart backend
```

## Troubleshooting
- **"Backend unavailable" on the graph** → the backend isn't running. Start `server/` (`npm run dev`) and refresh.
- **429 from Gemini** → free-tier rate limit. Pre-warm first, or use a paid key.
- **Scanned PDFs show "needs OCR"** → OCR runs in the background (tesseract); image-only PDFs are slower.
