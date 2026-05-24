<role>
You are an elite product designer, frontend architect, systems visualization specialist, motion designer, and AI-native UX strategist tasked with designing the full prototype experience for:

# AILA — Artificial Intelligence for Legal Analysis

AILA is an AI-powered regulatory intelligence infrastructure for digital trade law analysis, regulatory memory, semantic version tracking, and compliance simulation.

The prototype must feel like:

* a next-generation intelligence operating system,
* a legal knowledge graph,
* a regulatory observatory,
* and an explainable AI command center.

This is NOT a generic SaaS dashboard.

The interface should feel:

* intelligent,
* alive,
* analytical,
* citation-first,
* graph-native,
* and deeply interconnected.

The platform is intended for:

* SMEs expanding internationally,
* policy analysts,
* compliance teams,
* UN/ESCAP researchers,
* and governments.

The UI must visually communicate:

* living regulatory intelligence,
* cross-country legal relationships,
* evolving regulations,
* AI reasoning transparency,
* and persistent institutional memory.

The prototype should resemble a fusion of:

* Obsidian graph view,
* Palantir,
* Linear,
* GitHub,
* and a modern AI-native intelligence system.

Do NOT generate a traditional admin dashboard.

The platform should feel like users are navigating a living map of regulations.

</role>

<tech-stack>

Build the prototype assuming:

* Next.js 15
* React
* Tailwind CSS
* Framer Motion
* shadcn/ui
* TypeScript
* D3.js / React Force Graph / Cytoscape for graph visualization
* Lucide React icons

Architecture assumptions:

* component-driven architecture
* reusable visualization primitives
* responsive layouts
* motion-heavy but performant
* graph rendering isolated from UI shell
* design token system centralized

</tech-stack>

<design-system>

# DESIGN STYLE — AI INTELLIGENCE MINIMALISM

## CORE VISUAL IDENTITY

The design language should combine:

* modern AI-native interfaces,
* intelligence analysis systems,
* graph visualization tools,
* and futuristic research operating systems.

The system must feel:

* alive,
* highly technical,
* premium,
* minimalist,
* cinematic,
* and deeply interconnected.

The aesthetic direction is:
“Regulatory intelligence as a living neural network.”

The interface should communicate:

* memory,
* connections,
* semantic relationships,
* legal evolution,
* and AI reasoning.

Avoid:

* generic fintech dashboards,
* traditional enterprise admin UIs,
* cluttered analytics layouts,
* excessive cards everywhere,
* overuse of tables,
* overly colorful enterprise charts.

This is a knowledge operating system.

---

# COLOR SYSTEM

## Base Palette

Background:
#071018

Secondary Surface:
#0D1722

Elevated Surface:
#111C29

Primary Text:
#F5F7FA

Secondary Text:
#94A3B8

Muted Text:
#64748B

Borders:
rgba(255,255,255,0.08)

---

## Accent Colors

Primary Accent:
#3B82F6

Accent Secondary:
#60A5FA

Regulatory Warning:
#F59E0B

Critical Risk:
#EF4444

Compliance Success:
#10B981

Neural Purple:
#8B5CF6

Cyan Signal:
#22D3EE

---

# SIGNATURE VISUAL EFFECTS

The interface MUST heavily use:

* subtle grid overlays,
* neural connection lines,
* glowing graph nodes,
* animated edge trails,
* glassmorphism only on overlays/modals,
* floating ambient gradients,
* depth via layered transparency,
* soft glow borders,
* dynamic graph movement,
* animated regulatory pulses.

The background should feel computational.

Use:

* radial gradients,
* blurred glows,
* graph field lighting,
* node pulse animations,
* animated edge traversal.

Think:
“AI regulatory galaxy.”

---

# TYPOGRAPHY

Primary Font:
Inter

Secondary Font:
IBM Plex Sans

Monospace:
JetBrains Mono

Typography should feel:

* analytical,
* technical,
* clean,
* readable,
* and research-oriented.

Use:

* large bold headlines,
* uppercase metadata labels,
* monospace timestamps,
* dense information hierarchy,
* compact technical spacing.

---

# LAYOUT PHILOSOPHY

The UI is NOT centered around cards.

The UI is centered around:

* the regulatory graph,
* intelligence flow,
* and semantic relationships.

Everything else supports the graph.

The graph is the heart of the platform.

The dashboard should resemble:

* an intelligence network,
* or a neural map of legal systems.

Use:

* asymmetric layouts,
* floating panels,
* collapsible intelligence drawers,
* command-center structures,
* graph-centric composition.

Avoid:

* overly boxed layouts,
* rigid enterprise grids,
* static dashboards.

</design-system>

<dashboard-architecture>

# MAIN DASHBOARD — GRAPH-FIRST EXPERIENCE

This is the most important part of the platform.

The MAIN dashboard MUST be built around a massive interactive Obsidian-style regulatory graph occupying most of the viewport.

This graph is the centerpiece of the platform.

The dashboard should feel like:

* navigating a living legal memory system,
* exploring interconnected regulations,
* tracing AI reasoning paths,
* and visualizing international legal relationships.

---

# NAVIGATION BAR

IMPORTANT:
The navigation bar MUST be:

* fixed at the TOP,
* perfectly CENTERED horizontally,
* floating,
* translucent,
* glassmorphic,
* compact,
* and premium.

The navbar should resemble:

* Linear,
* Vercel,
* Arc Browser,
* or modern AI-native interfaces.

It should NOT span full width.

Instead:

* place it centered at the top,
* floating above the dashboard,
* with rounded pill geometry,
* subtle border,
* blur backdrop,
* and soft glow.

Navbar contents:

* Dashboard
* Regulatory Graph
* Diff Engine
* Simulation Sandbox
* Memory Layer
* Countries
* SME Assistant
* API
* Settings

Interactions:

* active indicator glow,
* hover light trails,
* animated underline,
* magnetic hover behavior.

---

# REGULATORY GRAPH SYSTEM

The graph MUST resemble Obsidian’s graph visualization.

However:
make it far more cinematic and intelligent.

## Graph Structure

The graph represents:

* countries,
* regulations,
* clauses,
* amendments,
* compliance cases,
* and semantic relationships.

Each COUNTRY acts as a major cluster node.

Examples:

* Philippines
* Singapore
* Vietnam
* Thailand
* Indonesia
* Malaysia

Inside each country cluster:

* regulations appear as connected file nodes,
* clauses appear as smaller connected subnodes,
* amendments branch outward,
* precedent links connect across countries.

The graph should visually resemble:

* legal constellations,
* neural systems,
* interconnected memory structures.

---

# NODE DESIGN

Country Nodes:

* largest nodes,
* glowing halo,
* animated pulse,
* country flag indicator,
* stronger magnetic gravity,
* subtle rotating ring.

Regulation Nodes:

* medium-sized document nodes,
* represented as glowing file structures,
* connected to their country cluster.

Clause Nodes:

* smaller micro-nodes,
* high-density connections,
* appear on zoom.

Amendment Nodes:

* flashing diff indicators,
* orange/red pulse,
* connected through version chains.

Simulation Links:

* glowing animated pathways between affected regulations.

---

# GRAPH INTERACTIONS

Users can:

* pan,
* zoom,
* drag nodes,
* expand country clusters,
* collapse jurisdictions,
* trace compliance relationships,
* click regulations,
* inspect amendment history,
* visualize precedent relationships.

Interactions should feel:

* fluid,
* alive,
* and physically simulated.

Use:

* spring motion,
* inertia,
* edge animations,
* soft magnetic attraction,
* glow transitions.

Edges should animate with:

* moving particles,
* directional flow,
* semantic signal pulses.

---

# LIVE ACTIVITY SYSTEM

The graph must continuously feel alive.

Examples:

* new regulation ingested,
* semantic diff detected,
* amendment alert,
* AI analysis completed,
* citation verified.

Represent activity through:

* traveling edge particles,
* pulse rings,
* node flickers,
* floating notifications,
* subtle topology changes.

The platform should feel like:
“an active global regulatory intelligence network.”

---

# SUPPORTING PANELS

Around the graph:
place floating intelligence widgets.

NOT large dashboard cards.

Instead:
compact analytical overlays.

Examples:

Top Left:

* active jurisdictions
* regulations ingested today
* amendment alerts
* crawler activity

Top Right:

* AI confidence metrics
* RAG retrieval health
* semantic diff detections
* system memory growth

Bottom Left:

* live ingestion feed
* government portal monitoring
* OCR processing queue

Bottom Right:

* compliance simulation results
* current regulatory conflicts
* recent precedent retrievals

These panels should:

* float above the graph,
* use translucent dark surfaces,
* feel lightweight,
* and never overpower the graph.

---

# RIGHT-SIDE INTELLIGENCE DRAWER

When clicking a node:
open a floating side intelligence panel.

This is critical.

The panel shows:

* regulation title,
* country,
* RDTII category,
* extracted clauses,
* amendment timeline,
* compliance restrictions,
* precedent matches,
* AI reasoning trace,
* citations,
* confidence score,
* source PDF preview.

Use:

* layered expandable sections,
* citation highlighting,
* semantic relationship maps,
* inline diff visualizations.

The drawer should feel:
like inspecting memory inside an AI brain.

---

# SEMANTIC DIFF VISUALIZATION

AILA acts like GitHub for regulations.

Create a dedicated semantic diff visualization experience.

Show:

* before/after legal clauses,
* inserted obligations,
* removed restrictions,
* severity indicators,
* amendment timelines.

Use:

* red/orange highlights,
* animated diff lines,
* legal impact scoring,
* AI-generated explanation blocks.

The experience should resemble:
Git diffs mixed with AI reasoning.

---

# COMPLIANCE SIMULATION SANDBOX

Create a futuristic simulation interface.

Users define:

* business type,
* data categories,
* storage region,
* AI features,
* cross-border flows.

Then:
AILA simulates regulatory outcomes.

The UI should resemble:

* a mission control simulator,
* cyber operations dashboard,
* or deployment pipeline visualizer.

Show:

* jurisdictional compliance map,
* legal conflicts,
* restrictions,
* risk scores,
* required operational modifications.

Use:

* animated pipelines,
* node execution flow,
* status indicators,
* regulation activation paths.

---

# SME ASSISTANT EXPERIENCE

Create a simplified AI assistant mode for SMEs.

The interface should:

* reduce legal complexity,
* explain laws simply,
* maintain citation transparency.

Features:

* conversational query interface,
* compliance readiness score,
* “what should I change?” recommendations,
* expandable citation viewer,
* country comparison summaries.

This section should feel:
more approachable,
while still connected to the intelligence graph.

---

# MOTION & INTERACTION

Motion is CRITICAL.

Everything should feel computational and alive.

Use:

* Framer Motion extensively,
* animated graph transitions,
* glow interpolation,
* floating ambient movement,
* slow pulsing backgrounds,
* edge traversal animations,
* inertia-based dragging.

Avoid:

* playful bouncy animations,
* exaggerated overshoot,
* cartoon interactions.

Motion should feel:
precise,
technical,
and intelligent.

---

# RESPONSIVENESS

Desktop:

* full graph experience,
* floating overlays,
* immersive intelligence interface.

Tablet:

* reduced graph complexity,
* collapsible overlays.

Mobile:

* graph becomes simplified,
* focus on assistant + intelligence panels,
* maintain futuristic aesthetic.

Do NOT destroy the graph-first identity on mobile.

---

# FINAL EXPERIENCE GOAL

The prototype should make users immediately think:

“This feels like the future of regulatory intelligence.”

The platform should visually communicate:

* living legal memory,
* AI reasoning,
* global regulatory interconnection,
* and continuously evolving intelligence.

Most importantly:
the Obsidian-style regulatory graph must be the emotional and visual centerpiece of the entire product.

</dashboard-architecture>
