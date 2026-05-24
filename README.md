# AILA — Artificial Intelligence for Legal Analysis

Interactive dashboard prototype for monitoring and comparing Southeast Asia digital regulation instruments (data protection, cybersecurity, digital commerce, etc.).

This project is a **front-end demo** (Vite + React + TypeScript + Canvas) that visualizes a small regulatory knowledge graph and provides several mock analysis views (diff, memory, SME assistant).

## What this system does

### 1) 3D Regulatory Knowledge Graph (Canvas)
The main view is an interactive, force-assisted graph rendered on an HTML canvas and treated as a **3D sphere**:

- **Zoom** in/out with the mouse wheel.
- **Rotate** the network by dragging the empty background (pitch/yaw across the X/Y axes).
- **Select** any node to open an intelligence drawer with details.
- **Compare nodes**: enable *Compare nodes* to pin a left drawer and compare another node on the right.

#### Spherical “layered shells” layout
Nodes are arranged on concentric spherical shells ("Earth layers" reference):

- **Countries** are placed on an inner shell (mantle).
- **Regulations** are placed on a mid shell.
- **Clauses** are placed on an outer shell.
- **Amendments / cross-links** are pushed outward relative to their parent.

A light force simulation runs to keep spacing readable, but the system also gently re-projects nodes back to their target shells to prevent excessive drifting.

### 2) Dashboard + Intelligence Panels
While on **Dashboard** or **Graph**, the UI overlays show:

- System status and ingestion feed (mocked)
- AI confidence / RAG health indicators (mocked)
- Compliance status snapshots (mocked)

### 3) Diff Engine (mock)
A "generate in seconds" comparison view for ASEAN cross-border transfer rules.

- Select jurisdictions
- Run a query (simulated)
- Export a citation-ready Markdown brief

### 4) Memory Layer (mock)
A list-style UI representing a regulatory document memory store (ingested artifacts).

### 5) SME Assistant (mock)
A chat UI that returns a fixed compliance-oriented response for demonstration.

## Tech stack

- **Vite** + **React 18** + **TypeScript**
- Canvas rendering for the graph
- Tailwind CSS (plus shadcn/ui components present in `src/app/components/ui/`)
- `motion` for panel/drawer animations

## Project structure (high level)

- `src/app/App.tsx` — main app, graph renderer, interactions, and all demo views
- `src/app/components/ui/` — reusable UI components
- `src/app/styles/` — global styles and theme setup

## Running locally

### Install
Using pnpm (recommended):

- `pnpm install`

Or using npm:

- `npm install`

### Dev server
- `pnpm dev`
- or `npm run dev`

Then open the Vite URL shown in the terminal.

## Notes

- This repository is intended as a **prototype UI**. The “AI”, “diff”, and “ingestion” features are currently simulated with static data.
- The graph data is generated in-memory and is not backed by a database/API in this demo.

## Attribution

Original design source (Figma): https://www.figma.com/design/tlbAUnWu8VnBNdmBi63ptZ/Implement-User-Prompt
