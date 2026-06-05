# AILA — Artificial Intelligence for Legal Analysis

AILA is a backend-ready legal analysis workspace for teams that need to review source documents, track processing status, and turn regulatory text into actionable findings.

## What’s in this build

- upload workflow with service abstraction
- analysis results and review queue
- notification and metrics panels
- integration hook points for upload, analysis, results, status, and alerts

## Tech stack

- Vite
- React 18
- TypeScript
- Tailwind CSS

## Project structure

- `src/app/AppReady.tsx` — current app shell and screen composition
- `src/components/` — reusable layout and UI pieces
- `src/features/` — domain-focused UI modules
- `src/pages/` — screen-level compositions
- `src/services/` — API-ready data access layer
- `src/hooks/` — state orchestration
- `src/lib/` — copy and seed data
- `src/types/` — shared types

## Local development

- `npm install`
- `npm run dev`

Set `VITE_AILA_API_BASE_URL` when the backend is ready.

## Backend contract

- `POST /upload`
- `POST /analyze`
- `GET /results`
- `GET /status`
- `GET /alerts`

## Backend

A Node + Express + TypeScript backend lives in [`server/`](server/). It implements
the contract above **and** scrapes digital-trade regulations from a curated source
list at [`server/sources/digital-trade-regulations.md`](server/sources/digital-trade-regulations.md).

```bash
cd server && npm install && npm run dev   # http://localhost:8787
```

Then set `VITE_AILA_API_BASE_URL=http://localhost:8787` in a root `.env.local`.
Scraping routes: `GET /sources`, `GET /scrape/:id`, `POST /scrape`. See
[`server/README.md`](server/README.md) for details.

