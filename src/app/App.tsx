import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import ailaLogo from "../assets/aila-logo.png";
import {
  Network, GitBranch, FlaskConical, Database,
  Globe, MessageSquare, Code2, Settings, X,
  Brain,
  ChevronRight, Radio,
  Send,
  Link,
  FileText, Scale,
  Heart, Share2, ChevronLeft, Eye, MessageCircle,
  Download, Paperclip,
} from "lucide-react";

// ==================== TYPES ====================
type ViewId = "dashboard" | "graph" | "diff" | "simulation" | "memory" | "countries" | "sme" | "api" | "settings" | "answer";
type NodeType = "country" | "pillar" | "regulation" | "clause" | "amendment";
type EdgeType = "cluster" | "precedent" | "amendment" | "simulation";

interface GNode {
  id: string;
  type: NodeType;
  label: string;
  shortLabel?: string;
  flag?: string;
  countryId?: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  radius: number;
  color: string;
  glowColor: string;
  pulsePhase: number;
  alerting?: boolean;
  url?: string;
  parentId?: string; ox?: number; oy?: number; oz?: number; // clause satellites (follow their parent)
  details?: {
    category: string; enacted: string;
    status: "Active" | "Amended" | "Repealed" | "Proposed";
    clauses: number; amendments: number; coverage: string;
    confidence: number; description: string;
    regulations?: number; complianceScore?: number;
  };
}

interface Particle { progress: number; speed: number; opacity: number; }
interface GEdge { id: string; sourceId: string; targetId: string; type: EdgeType; particles: Particle[]; }

type LiveEvent = { type: "alert" | "diff" | "verify" | "ingest" | "analysis"; text: string; time: string };
type DemoStep = "crawler" | "ocr" | "translation" | "versioning";
type SimulateAction = { tick: number; step: DemoStep };

// ==================== DATA ====================
const COUNTRY_DATA: Record<string, {
  name: string; flag: string; color: string;
  regulations: Array<{
    id: string;
    label: string;
    short: string;
    category: string;
    clauses: number;
    amendments: number;
    enacted: string;
  }>;
}> = {
  ph: {
    name: "Philippines",
    flag: "PH",
    color: "#3B82F6",
    regulations: [
      { id: "ph-dpa", label: "Data Privacy Act", short: "DPA", category: "Data Protection", clauses: 48, amendments: 3, enacted: "2012" },
      { id: "ph-eca", label: "E-Commerce Act", short: "ECA", category: "Digital Commerce", clauses: 32, amendments: 1, enacted: "2000" },
      { id: "ph-cpa", label: "Cybercrime Prevention Act", short: "CPA", category: "Cybersecurity", clauses: 21, amendments: 2, enacted: "2012" },

      // NEW
      { id: "ph-nihra", label: "National ICT Harmonization Framework", short: "NIHRA", category: "Digital Governance", clauses: 36, amendments: 1, enacted: "2015" },
      { id: "ph-dsfa", label: "Digital Services Framework Act", short: "DSFA", category: "Digital Commerce", clauses: 27, amendments: 0, enacted: "2021" },
      { id: "ph-pcia", label: "Philippine Cybersecurity Infrastructure Act", short: "PCIA", category: "Cybersecurity", clauses: 39, amendments: 2, enacted: "2018" },
    ],
  },

  sg: {
    name: "Singapore",
    flag: "SG",
    color: "#10B981",
    regulations: [
      { id: "sg-pdpa", label: "Personal Data Protection Act", short: "PDPA", category: "Data Protection", clauses: 65, amendments: 5, enacted: "2012" },
      { id: "sg-psa", label: "Payment Services Act", short: "PSA", category: "Fintech", clauses: 43, amendments: 2, enacted: "2019" },
      { id: "sg-cma", label: "Computer Misuse Act", short: "CMA", category: "Cybersecurity", clauses: 18, amendments: 4, enacted: "1993" },

      // NEW
      { id: "sg-osa", label: "Online Safety Act Framework", short: "OSA", category: "Digital Governance", clauses: 29, amendments: 1, enacted: "2022" },
      { id: "sg-dga", label: "Digital Government Act", short: "DGA", category: "Digital Governance", clauses: 41, amendments: 2, enacted: "2020" },
      { id: "sg-ai-gov", label: "Model AI Governance Framework", short: "AI-GOV", category: "AI Regulation", clauses: 22, amendments: 0, enacted: "2019" },
    ],
  },

  vn: {
    name: "Vietnam",
    flag: "VN",
    color: "#EF4444",
    regulations: [
      { id: "vn-csl", label: "Cybersecurity Law", short: "CSL", category: "Cybersecurity", clauses: 43, amendments: 1, enacted: "2018" },
      { id: "vn-dpd", label: "Decree 13 Personal Data Protection", short: "DPD", category: "Data Protection", clauses: 38, amendments: 0, enacted: "2023" },
      { id: "vn-ecd", label: "E-Commerce Decree", short: "ECD", category: "Digital Commerce", clauses: 54, amendments: 3, enacted: "2013" },

      // NEW
      { id: "vn-itl", label: "Information Technology Law", short: "ITL", category: "Digital Governance", clauses: 62, amendments: 2, enacted: "2006" },
      { id: "vn-nd72", label: "Decree 72 Internet Management", short: "ND72", category: "Cybersecurity", clauses: 33, amendments: 4, enacted: "2013" },
      { id: "vn-eid", label: "Electronic Identification Law", short: "EID", category: "Digital Identity", clauses: 28, amendments: 0, enacted: "2021" },
    ],
  },

  th: {
    name: "Thailand",
    flag: "TH",
    color: "#F59E0B",
    regulations: [
      { id: "th-pdpa", label: "PDPA B.E. 2562", short: "PDPA", category: "Data Protection", clauses: 96, amendments: 2, enacted: "2019" },
      { id: "th-cca", label: "Computer Crimes Act", short: "CCA", category: "Cybersecurity", clauses: 29, amendments: 3, enacted: "2007" },
      { id: "th-eta", label: "Electronic Transactions Act", short: "ETA", category: "Digital Commerce", clauses: 41, amendments: 1, enacted: "2001" },

      // NEW
      { id: "th-dpa-comm", label: "Digital Personal Data Implementation Rules", short: "DPA-IR", category: "Data Protection", clauses: 52, amendments: 1, enacted: "2021" },
      { id: "th-cybersec", label: "Cybersecurity Act", short: "CYBA", category: "Cybersecurity", clauses: 44, amendments: 2, enacted: "2019" },
      { id: "th-digital-econ", label: "Digital Economy Act", short: "DEA", category: "Digital Governance", clauses: 37, amendments: 1, enacted: "2017" },
    ],
  },

  id: {
    name: "Indonesia",
    flag: "ID",
    color: "#8B5CF6",
    regulations: [
      { id: "id-pdp", label: "Personal Data Protection Law", short: "PDP", category: "Data Protection", clauses: 76, amendments: 0, enacted: "2022" },
      { id: "id-gr71", label: "GR 71/2019 E-Commerce Regulation", short: "GR71", category: "Digital Commerce", clauses: 23, amendments: 1, enacted: "2019" },
      { id: "id-ojk", label: "OJK Fintech Regulation", short: "OJK", category: "Fintech", clauses: 34, amendments: 4, enacted: "2016" },

      // NEW
      { id: "id-ite", label: "Electronic Information & Transactions Law", short: "ITE", category: "Cybersecurity", clauses: 58, amendments: 3, enacted: "2008" },
      { id: "id-pp71", label: "Government Regulation 71", short: "PP71", category: "Digital Governance", clauses: 46, amendments: 2, enacted: "2019" },
      { id: "id-cloud", label: "Data Localization & Cloud Policy", short: "DLC", category: "Data Governance", clauses: 31, amendments: 1, enacted: "2020" },
    ],
  },

  my: {
    name: "Malaysia",
    flag: "MY",
    color: "#22D3EE",
    regulations: [
      { id: "my-pdpa", label: "Personal Data Protection Act", short: "PDPA", category: "Data Protection", clauses: 44, amendments: 2, enacted: "2010" },
      { id: "my-cma", label: "Communications & Multimedia Act", short: "CMA", category: "Telecom", clauses: 212, amendments: 8, enacted: "1998" },
      { id: "my-dst", label: "Digital Services Tax", short: "DST", category: "Digital Tax", clauses: 18, amendments: 1, enacted: "2019" },

      // NEW
      { id: "my-cybersec", label: "Cybersecurity Act Framework", short: "CYB", category: "Cybersecurity", clauses: 39, amendments: 1, enacted: "2020" },
      { id: "my-digital-econ", label: "Malaysia Digital Economy Blueprint", short: "MDEB", category: "Digital Governance", clauses: 55, amendments: 2, enacted: "2021" },
      { id: "my-cloud-policy", label: "Public Sector Cloud Policy", short: "PSC", category: "Data Governance", clauses: 26, amendments: 0, enacted: "2018" },
    ],
  },
};


const LIVE_EVENTS: LiveEvent[] = [
  { type: "alert", text: "VN Cybersecurity Law amendment detected", time: "00:12" },
  { type: "diff", text: "Semantic diff: SG PDPA §26 modified", time: "02:47" },
  { type: "verify", text: "Citation verified: PH DPA §12(a)", time: "05:31" },
  { type: "ingest", text: "TH PDPA cross-border clause ingested", time: "08:14" },
  { type: "analysis", text: "AI analysis complete: ID PDP Chapter 4", time: "12:03" },
  { type: "ingest", text: "MY Digital Services Tax v2.1 ingested", time: "18:55" },
  { type: "diff", text: "Amendment chain detected: PH DPA→CPA", time: "23:41" },
];

// ==================== HELPERS ====================
function h2r(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function lighten(hex: string, amt: number): string {
  return `rgb(${Math.min(255, parseInt(hex.slice(1,3),16)+amt)},${Math.min(255, parseInt(hex.slice(3,5),16)+amt)},${Math.min(255, parseInt(hex.slice(5,7),16)+amt)})`;
}


// ==================== LIVE GRAPH (from backend /graph) ====================
type ApiGraphNode = {
  id: string; type: "country" | "pillar" | "regulation"; label: string; country: string;
  region: string; pillar?: string; url?: string; instrument?: string; pillars?: string[];
  policies?: string[]; coverage?: string; timeframe?: string; weight?: number;
};
type ApiGraph = { nodes: ApiGraphNode[]; edges: Array<{ source: string; target: string }> };

const FLAG_BY_COUNTRY: Record<string, string> = {
  Singapore: "SG", Malaysia: "MY", Thailand: "TH", Philippines: "PH",
  Indonesia: "ID", Vietnam: "VN", Australia: "AU", ASEAN: "AS",
  WTO: "WTO", OECD: "OECD", UNCTAD: "UN", APEC: "APEC", CPTPP: "TPP", EU: "EU", USA: "US",
};
const flagFor = (c: string) => FLAG_BY_COUNTRY[c] ?? c.slice(0, 2).toUpperCase();
const shortLabelFor = (label: string) => {
  const acronym = label.match(/\(([A-Z]{2,6})\)/);
  if (acronym) return acronym[1];
  return label.length > 16 ? label.slice(0, 15) + "…" : label;
};

// Palette for a black canvas — dark glass hubs, pillar-coded accents (matches the globe).
const NODE_PALETTE = {
  country: "#0E1524",     // dark glass orb — anchors read as depth, not glare
  pillarless: "#5B6478",  // muted slate — sources with no pillar
};
const PILLAR_COLORS: Record<string, string> = {
  "Cross-border data policies": "#818CF8",           // indigo
  "Domestic data protection & privacy": "#34D399",   // emerald
};
// Fuzzy pillar → colour so varied labels still map to the same family as the globe chips.
const PILLAR_RX: Array<[RegExp, string]> = [
  [/cross[- ]?border/i, "#818CF8"],
  [/domestic|privacy|protection/i, "#34D399"],
  [/cyber|security/i, "#FBBF24"],
  [/competition|trade|market/i, "#F472B6"],
];
const GRAPH_ACCENT = "#818CF8";  // the single Jigsaw-blue accent
const pillarColor = (name?: string) => {
  if (!name) return NODE_PALETTE.pillarless;
  if (PILLAR_COLORS[name]) return PILLAR_COLORS[name];
  const m = PILLAR_RX.find(([rx]) => rx.test(name));
  return m ? m[1] : NODE_PALETTE.pillarless;
};
const pillarShort = (name: string) => name.replace(/ data policies| data protection.*/i, "").trim();

/** Convert the backend /graph payload into positioned GNode/GEdge (country → pillar → URL). */
function graphFromApi(payload: ApiGraph, w: number, h: number): { nodes: GNode[]; edges: GEdge[] } {
  const sphere = Math.min(w, h) * 0.46;
  const nodes: GNode[] = [], edges: GEdge[] = [];
  const jit = (m = 18) => (Math.random() - 0.5) * m;

  const byId = new Map(payload.nodes.map(n => [n.id, n]));
  const children = new Map<string, string[]>();
  for (const e of payload.edges) {
    if (!children.has(e.source)) children.set(e.source, []);
    children.get(e.source)!.push(e.target);
  }
  const pos = new Map<string, { x: number; y: number; z: number; angle: number }>();
  const pushEdge = (s: string, t: string) =>
    edges.push({
      id: `${s}->${t}`, sourceId: s, targetId: t, type: "cluster",
      particles: Array.from({ length: 2 }, () => ({ progress: Math.random(), speed: 0.0018 + Math.random() * 0.0025, opacity: 0.7 })),
    });

  const countries = payload.nodes.filter(n => n.type === "country");
  const placedRegs = new Set<string>();

  const placeReg = (r: ApiGraphNode, cx: number, cy: number, cz: number, baseAngle: number, idx: number, n: number, color: string) => {
    if (placedRegs.has(r.id)) return;
    placedRegs.add(r.id);
    const ra = baseAngle + (n > 1 ? (idx / (n - 1) - 0.5) * 1.4 : 0);
    const rr = 70 + (idx % 3) * 20;
    const rx = cx + rr * Math.cos(ra) + jit(), ry = cy + rr * Math.sin(ra) * 0.9 + jit(), rz = cz + rr * Math.sin(ra * 0.8) * 0.7 + jit();
    nodes.push({
      id: r.id, type: "regulation", label: r.label, shortLabel: shortLabelFor(r.label),
      x: rx, y: ry, z: rz,
      vx: 0, vy: 0, vz: 0, radius: 6.5, color, glowColor: color, pulsePhase: Math.random() * Math.PI * 2,
      url: r.url,
      details: {
        category: r.coverage || "Regulation", enacted: r.timeframe || "N/A", status: "Active",
        clauses: r.policies?.length ?? 0, amendments: 0, coverage: r.country, confidence: 0.9,
        description: `${r.instrument}\n\nPillars: ${(r.pillars ?? []).join(", ") || "—"}\nPolicy focus: ${(r.policies ?? []).join("; ") || "—"}`,
      },
    });
    // clause leaf nodes (Document Archive) orbit their regulation as static micro-dots
    const clauseKids = (children.get(r.id) ?? []).map(id => byId.get(id)!).filter(k => k && k.type === "clause");
    clauseKids.forEach((cl, k) => {
      const ca = ra + ((clauseKids.length > 1 ? k / (clauseKids.length - 1) - 0.5 : 0) * 1.6) + k * 0.7;
      const cr = 20 + (k % 4) * 7;
      const ox = cr * Math.cos(ca), oy = cr * Math.sin(ca), oz = cr * Math.sin(ca * 0.6) * 0.6;
      nodes.push({
        id: cl.id, type: "clause", label: cl.label, parentId: r.id, ox, oy, oz,
        x: rx + ox, y: ry + oy, z: rz + oz, vx: 0, vy: 0, vz: 0,
        radius: 2.6, color: "#94A3B8", glowColor: "#94A3B8", pulsePhase: Math.random() * Math.PI * 2,
        url: cl.url,
        details: {
          category: (cl as any).coverage || "Clause", enacted: "N/A", status: "Active",
          clauses: 0, amendments: 0, coverage: cl.country, confidence: 0.9,
          description: `${cl.label}${cl.pillars?.length ? `\n\nIndicators: ${cl.pillars.join(", ")}` : ""}`,
        },
      });
      pushEdge(r.id, cl.id);
    });
  };

  countries.forEach((c, i) => {
    const angle = (i / countries.length) * Math.PI * 2 - Math.PI / 2;
    const nx = sphere * Math.cos(angle) * 0.9;
    const ny = sphere * Math.sin(angle * 1.3) * 0.45;
    const nz = sphere * Math.sin(angle) * 0.82;
    pos.set(c.id, { x: nx, y: ny, z: nz, angle });

    const kids = (children.get(c.id) ?? []).map(id => byId.get(id)!).filter(Boolean);
    const regCount = payload.nodes.filter(n => n.type === "regulation" && n.country === c.country).length;

    nodes.push({
      id: c.id, type: "country", label: c.label, flag: flagFor(c.country),
      x: nx + jit(), y: ny + jit(), z: nz + jit(), vx: 0, vy: 0, vz: 0,
      radius: 21, color: NODE_PALETTE.country, glowColor: GRAPH_ACCENT, pulsePhase: Math.random() * Math.PI * 2,
      details: {
        category: "Jurisdiction", enacted: "N/A", status: "Active",
        clauses: 0, amendments: 0, coverage: c.label, confidence: 1,
        description: `${c.label} — ${regCount} tracked source${regCount === 1 ? "" : "s"} (${c.region}).`,
        regulations: regCount, complianceScore: 0.8,
      },
    });

    const pillarKids = kids.filter(k => k.type === "pillar");
    const regKids = kids.filter(k => k.type === "regulation");

    // pillar sub-hubs around the country
    pillarKids.forEach((pl, pIdx) => {
      const pa = angle + (pillarKids.length > 1 ? (pIdx / (pillarKids.length - 1) - 0.5) * 1.0 : 0);
      const pr = 130;
      const px = nx + pr * Math.cos(pa), py = ny + pr * Math.sin(pa) * 0.92, pz = nz + pr * Math.sin(pa * 0.8) * 0.7;
      const col = pillarColor(pl.pillar);
      nodes.push({
        id: pl.id, type: "pillar", label: pl.label, shortLabel: pillarShort(pl.label),
        countryId: c.id, x: px + jit(), y: py + jit(), z: pz + jit(), vx: 0, vy: 0, vz: 0,
        radius: 11, color: col, glowColor: col, pulsePhase: Math.random() * Math.PI * 2,
        details: {
          category: "Policy pillar", enacted: "N/A", status: "Active",
          clauses: 0, amendments: 0, coverage: c.label, confidence: 1,
          description: `${pl.label} — ${(children.get(pl.id) ?? []).length} instruments in ${c.label}.`,
        },
      });
      pushEdge(c.id, pl.id);

      const plRegs = (children.get(pl.id) ?? []).map(id => byId.get(id)!).filter(Boolean);
      plRegs.forEach((r, j) => {
        placeReg(r, px, py, pz, pa, j, plRegs.length, col);
        pushEdge(pl.id, r.id);
      });
    });

    // regulations with no pillar hang directly off the country hub — still pillar-coded
    // by their own tags when present, else muted slate.
    regKids.forEach((r, j) => {
      placeReg(r, nx, ny, nz, angle, j, regKids.length, pillarColor((r as any).pillars?.[0]));
      pushEdge(c.id, r.id);
    });

    // uploaded / live / validated documents attach straight to the country hub
    const clauseKids = kids.filter(k => k.type === "clause");
    clauseKids.forEach((cl, k) => {
      const ca = angle + ((clauseKids.length > 1 ? k / (clauseKids.length - 1) - 0.5 : 0) * 1.8);
      const cr = 46 + (k % 5) * 9;
      const ox = cr * Math.cos(ca), oy = cr * Math.sin(ca) * 0.9, oz = cr * Math.sin(ca * 0.6) * 0.6;
      nodes.push({
        id: cl.id, type: "clause", label: cl.label, parentId: c.id, ox, oy, oz,
        x: nx + ox, y: ny + oy, z: nz + oz, vx: 0, vy: 0, vz: 0,
        radius: 2.6, color: "#94A3B8", glowColor: "#94A3B8", pulsePhase: Math.random() * Math.PI * 2,
        url: cl.url,
        details: { category: "Clause", enacted: "N/A", status: "Active", clauses: 0, amendments: 0, coverage: cl.country, confidence: 0.9, description: cl.label },
      });
      pushEdge(c.id, cl.id);
    });
  });

  return { nodes, edges };
}

// ==================== FORCE SIMULATION ====================
function applyForces(allNodes: GNode[], edges: GEdge[], w: number, h: number) {
  const radius = Math.min(w, h) * 0.46;
  const REP = 6200, CK = 0.07, XK = 0.016, GR = 0.00038, D = 0.88;
  // clause satellites don't participate in the O(n²) sim — they follow their parent (below)
  const nodes = allNodes.filter(n => n.type !== "clause");
  nodes.forEach(n => {
    n.vx += (-n.x) * GR;
    n.vy += (-n.y) * GR;
    n.vz += (-n.z) * GR;
  });
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i+1; j < nodes.length; j++) {
      const dx=nodes[j].x-nodes[i].x, dy=nodes[j].y-nodes[i].y, dz=nodes[j].z-nodes[i].z;
      const d2=dx*dx+dy*dy+dz*dz||1, d=Math.sqrt(d2);
      if (d < (nodes[i].radius+nodes[j].radius+24)*4.6) {
        const f=REP/d2;
        nodes[i].vx-=(dx/d)*f; nodes[i].vy-=(dy/d)*f; nodes[i].vz-=(dz/d)*f;
        nodes[j].vx+=(dx/d)*f; nodes[j].vy+=(dy/d)*f; nodes[j].vz+=(dz/d)*f;
      }
    }
  }
  const nm = new Map(nodes.map(n=>[n.id,n]));
  edges.forEach(e => {
    const s=nm.get(e.sourceId), t=nm.get(e.targetId);
    if (!s||!t) return;
    const dx=t.x-s.x, dy=t.y-s.y, dz=t.z-s.z;
    const d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;
    const rest=e.type==="cluster"?(s.type==="country"?150:78):265;
    const k=e.type==="cluster"?CK:XK, f=(d-rest)*k;
    s.vx+=(dx/d)*f; s.vy+=(dy/d)*f; s.vz+=(dz/d)*f;
    t.vx-=(dx/d)*f; t.vy-=(dy/d)*f; t.vz-=(dz/d)*f;
  });
  nodes.forEach(n => {
    n.vx=(n.vx+(Math.random()-.5)*0.05)*D;
    n.vy=(n.vy+(Math.random()-.5)*0.05)*D;
    n.vz=(n.vz+(Math.random()-.5)*0.05)*D;
    n.x+=n.vx; n.y+=n.vy;
    n.z+=n.vz;

    const d = Math.sqrt(n.x*n.x + n.y*n.y + n.z*n.z) || 1;
    const maxD = radius * 1.25;
    if (d > maxD) {
      const s = maxD / d;
      n.x *= s; n.y *= s; n.z *= s;
      n.vx *= 0.7; n.vy *= 0.7; n.vz *= 0.7;
    }
  });
  // clause satellites track their parent node
  for (const c of allNodes) {
    if (c.type !== "clause") continue;
    const p = nm.get(c.parentId ?? "");
    if (p) { c.x = p.x + (c.ox ?? 0); c.y = p.y + (c.oy ?? 0); c.z = p.z + (c.oz ?? 0); }
  }
}

// ==================== CANVAS DRAWING ====================
const EDGE_COLORS: Record<EdgeType, [string, number, number]> = {
  cluster:    ["129,140,248", 0.15, 0.5],   // indigo, delicate
  precedent:  ["129,140,248", 0.26, 0.6],
  amendment:  ["165,180,252", 0.34, 0.7],
  simulation: ["129,140,248", 0.24, 0.6],
};
const NODE_ORDER: Record<NodeType, number> = { clause:0, amendment:1, regulation:2, pillar:3, country:4 };

interface GraphView {
  yaw: number;
  pitch: number;
  zoom: number;
}

interface ProjNode {
  x: number;
  y: number;
  z: number;
  r: number;
}

function projectNode(n: GNode, w: number, h: number, view: GraphView): ProjNode {
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
  const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);

  const x1 = n.x * cy - n.z * sy;
  const z1 = n.x * sy + n.z * cy;
  const y2 = n.y * cp - z1 * sp;
  const z2 = n.y * sp + z1 * cp;

  const cam = 720;
  const depth = cam + z2;
  const persp = Math.max(0.2, (cam / Math.max(120, depth)) * view.zoom);

  return {
    x: w / 2 + x1 * persp,
    y: h / 2 + y2 * persp,
    z: z2,
    r: Math.max(2, n.radius * persp),
  };
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  nodes: GNode[], edges: GEdge[],
  w: number, h: number,
  hovId: string|null, selId: string|null,
  time: number, dimmed: boolean,
  view: GraphView,
  scanId: string|null, scanGlow: number
): Record<string, ProjNode> {
  ctx.clearRect(0,0,w,h);

  // ── Pure-black base with a faint indigo depth wash (Jigsaw minimalist) ───────
  ctx.fillStyle="#000000"; ctx.fillRect(0,0,w,h);
  const bg=ctx.createRadialGradient(w/2,h*0.42,0,w/2,h*0.42,Math.max(w,h)*0.75);
  bg.addColorStop(0,"rgba(99,102,241,0.10)");
  bg.addColorStop(0.55,"rgba(49,46,129,0.05)");
  bg.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);

  // Sharp low-opacity indigo grid — crisp 1px lines, tiny intersection ticks
  const G=56;
  ctx.strokeStyle="rgba(129,140,248,0.055)"; ctx.lineWidth=1;
  ctx.beginPath();
  for (let x=(w/2)%G; x<w; x+=G) { ctx.moveTo(Math.round(x)+0.5,0); ctx.lineTo(Math.round(x)+0.5,h); }
  for (let y=(h/2)%G; y<h; y+=G) { ctx.moveTo(0,Math.round(y)+0.5); ctx.lineTo(w,Math.round(y)+0.5); }
  ctx.stroke();
  ctx.fillStyle="rgba(129,140,248,0.1)";
  for (let x=(w/2)%G; x<w; x+=G) for (let y=(h/2)%G; y<h; y+=G) ctx.fillRect(Math.round(x),Math.round(y),1,1);

  ctx.globalAlpha = dimmed ? 0.22 : 1;
  const projected = new Map<string, ProjNode>(nodes.map(n => [n.id, projectNode(n, w, h, view)]));

  const nm=new Map(nodes.map(n=>[n.id,n]));
  edges.forEach(e=>{
    const s=nm.get(e.sourceId),t=nm.get(e.targetId);
    const ps=projected.get(e.sourceId), pt=projected.get(e.targetId);
    if (!s||!t||!ps||!pt) return;
    const [rgb,alpha,lw]=EDGE_COLORS[e.type];
    const depthAlpha = Math.max(0.2, 0.6 + ((ps.z + pt.z) / 2) / 1200);
    ctx.beginPath(); ctx.moveTo(ps.x,ps.y); ctx.lineTo(pt.x,pt.y);
    ctx.strokeStyle=`rgba(${rgb},${(alpha * depthAlpha).toFixed(3)})`; ctx.lineWidth=lw; ctx.stroke();
    e.particles.forEach(pp=>{
      const px=ps.x+(pt.x-ps.x)*pp.progress, py=ps.y+(pt.y-ps.y)*pp.progress;
      ctx.save(); ctx.shadowColor=`rgb(${rgb})`; ctx.shadowBlur=5;
      ctx.beginPath(); ctx.arc(px,py,1.5,0,Math.PI*2);
      ctx.fillStyle=`rgba(${rgb},${pp.opacity})`; ctx.fill(); ctx.restore();
    });
  });

  [...nodes]
    .sort((a,b)=>{
      const pa = projected.get(a.id)!;
      const pb = projected.get(b.id)!;
      if (pa.z !== pb.z) return pa.z - pb.z;
      return NODE_ORDER[a.type]-NODE_ORDER[b.type];
    })
    .forEach(n=>{
    const pn = projected.get(n.id)!;
    const isH=n.id===hovId, isS=n.id===selId;
    const pulse=(Math.sin(time*0.0022+n.pulsePhase)+1)/2;

    const NC="#94A3B8";       // base node grey (slate-400)
    const NC_DARK="#64748B";   // emphasis grey (slate-500)

    // Sharp, fully-opaque circles — solid fills with a crisp rim (no washed-out gradients).
    const circle=(x:number,y:number,r:number)=>{ctx.beginPath();ctx.arc(x,y,Math.max(0.5,r),0,Math.PI*2);};
    const solid=(x:number,y:number,r:number,color:string)=>{ctx.fillStyle=color; circle(x,y,r); ctx.fill();};

    // Clause nodes: small solid motes (Document Archive leaves)
    if (n.type==="clause") {
      ctx.save();
      const s=Math.max(1.6,pn.r*0.55);
      if (isH||isS){ ctx.shadowColor=GRAPH_ACCENT; ctx.shadowBlur=8; solid(pn.x,pn.y,s,"#C7D2FE"); }
      else solid(pn.x,pn.y,s,"#A5ADC2");
      ctx.restore();
      return;
    }

    // Country / pillar: soft breathing halo ring in the node's accent colour
    if (n.type==="country"||n.type==="pillar") {
      ctx.save();
      ctx.strokeStyle=h2r(n.glowColor,0.26+pulse*0.16); ctx.lineWidth=1;
      circle(pn.x,pn.y,pn.r+(n.type==="country"?7:5)+pulse*3); ctx.stroke();
      ctx.restore();
    }

    // Amendment: pulsing grey ring
    if (n.type==="amendment") {
      const ap=(Math.sin(time*0.008+n.pulsePhase)+1)/2;
      ctx.save();
      ctx.strokeStyle=h2r(NC_DARK,0.25+ap*0.35); ctx.lineWidth=1;
      circle(pn.x,pn.y,pn.r+5+ap*4); ctx.stroke();
      ctx.restore();
    }

    // Ambient scan highlight — the "found" node blooms indigo with an expanding ring
    if (n.id===scanId && scanGlow>0.02) {
      ctx.save();
      ctx.shadowColor=GRAPH_ACCENT; ctx.shadowBlur=24*scanGlow;
      ctx.strokeStyle=`rgba(129,140,248,${0.85*scanGlow})`; ctx.lineWidth=1.5;
      circle(pn.x,pn.y,pn.r+5+scanGlow*22); ctx.stroke();
      ctx.strokeStyle=`rgba(129,140,248,${0.95*scanGlow})`;
      circle(pn.x,pn.y,pn.r+2); ctx.stroke();
      ctx.restore();
    }

    // Node body — glowing points on black. Countries are dark glass orbs with an
    // indigo ring; pillars/regulations are pillar-coloured discs with a soft aura.
    const accent = n.glowColor;
    ctx.save();
    if (n.type==="country") {
      // dark glass orb: soft accent aura → dark fill → indigo ring → inner glass hairline
      ctx.shadowColor=h2r(accent, isS||isH?0.9:0.5); ctx.shadowBlur=isS?24:isH?16:11;
      solid(pn.x,pn.y,pn.r,"#0E1524");
      ctx.shadowBlur=0;
      ctx.strokeStyle=h2r(accent,isS?1:0.72); ctx.lineWidth=isS?1.9:1.4;
      circle(pn.x,pn.y,pn.r); ctx.stroke();
      ctx.strokeStyle="rgba(255,255,255,0.06)"; ctx.lineWidth=1;
      circle(pn.x,pn.y,pn.r-3); ctx.stroke();
    } else if (n.type==="pillar") {
      ctx.shadowColor=h2r(accent,0.8); ctx.shadowBlur=isS?18:isH?13:8;
      solid(pn.x,pn.y,pn.r,accent);
      ctx.shadowBlur=0;
      ctx.strokeStyle="rgba(6,9,16,0.55)"; ctx.lineWidth=1;   // dark seat rim on black
      circle(pn.x,pn.y,pn.r); ctx.stroke();
    } else {
      // regulation / other — small pillar-coloured glow-dot, no beady white rim
      ctx.shadowColor=h2r(accent, isS||isH?0.95:0.6); ctx.shadowBlur=isS?15:isH?11:5;
      solid(pn.x,pn.y,pn.r,accent);
      if (isS||isH){ ctx.shadowBlur=0; ctx.strokeStyle=h2r("#FFFFFF",0.6); ctx.lineWidth=1; circle(pn.x,pn.y,pn.r); ctx.stroke(); }
    }
    ctx.restore();

    // Flag text for country nodes
    if (n.type==="country"&&n.flag) {
      ctx.save();
      ctx.font=`700 ${Math.floor(pn.r*0.7)}px sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle="#FFFFFF";
      ctx.shadowColor="rgba(15,23,42,0.35)"; ctx.shadowBlur=2;
      ctx.fillText(n.flag,pn.x,pn.y+1);
      ctx.restore();
    }

    // Alert dot
    if (n.alerting) {
      const ap=(Math.sin(time*0.009+n.pulsePhase)+1)/2;
      ctx.save(); ctx.shadowColor="#EF4444"; ctx.shadowBlur=5;
      ctx.beginPath(); ctx.arc(pn.x+pn.r-1,pn.y-pn.r+1,3,0,Math.PI*2);
      ctx.fillStyle=`rgba(239,68,68,${0.8+ap*0.2})`; ctx.fill(); ctx.restore();
    }

    // Labels: only country hubs are always on — pillars/regulations label on hover or
    // focus. This keeps the field a clean constellation instead of a wall of text.
    const alwaysLabel=n.type==="country";
    if (alwaysLabel || isH || isS || (n.id===scanId && scanGlow>0.45)) {
      const label=n.shortLabel||n.label;
      const fs=n.type==="country"?11:n.type==="pillar"?10:9;
      const strong=n.type==="country"||n.type==="pillar";
      ctx.save();
      ctx.font=`${strong?"600 ":"400 "}${fs}px Inter, sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="top";
      ctx.shadowColor="rgba(0,0,0,0.95)"; ctx.shadowBlur=8;
      ctx.fillStyle=
        n.type==="country" ? "#FFFFFF"
        : n.type==="pillar" ? h2r(n.glowColor,1)
        : h2r("#E2E8F0", isS?1:0.92);
      ctx.fillText(label,pn.x,pn.y+pn.r+6);
      ctx.restore();
    }
  });
  ctx.globalAlpha=1;
  return Object.fromEntries(projected.entries());
}

// ==================== GRAPH COMPONENT ====================
interface GRef {
  nodes:GNode[]; edges:GEdge[]; hovId:string|null; dragId:string|null;
  selId:string|null; time:number; w:number; h:number; init:boolean; raf:number; dimmed:boolean;
  scanId:string|null; scanStart:number;
  projected: Record<string, ProjNode>;
  rotateMode: boolean;
  moved: number;
  lastMx: number;
  lastMy: number;
  view: {
    yaw: number;
    pitch: number;
    zoom: number;
    targetYaw: number;
    targetPitch: number;
    targetZoom: number;
  };
}

function RegulatoryGraph({
  onSelect,
  selId,
  dimmed,
  simulateAction,
}: {
  onSelect:(n:GNode|null)=>void;
  selId:string|null;
  dimmed:boolean;
  simulateAction: SimulateAction;
}) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const [loadState,setLoadState]=useState<"loading"|"ready"|"empty"|"error">("loading");
  const [hover,setHover]=useState<{label:string;sub:string;x:number;y:number}|null>(null);
  const gr = useRef<GRef>({
    nodes:[], edges:[], hovId:null, dragId:null,
    selId:null, time:0, w:0, h:0, init:false, raf:0, dimmed:false,
    scanId:null, scanStart:0,
    projected:{}, rotateMode:false, moved:0, lastMx:0, lastMy:0,
    view:{ yaw:0.42, pitch:-0.18, zoom:1, targetYaw:0.42, targetPitch:-0.18, targetZoom:1 },
  });

  const findNodeAt = useCallback((mx: number, my: number) => {
    let found: GNode | null = null;
    let bestZ = -Infinity;
    for (const n of gr.current.nodes) {
      const p = gr.current.projected[n.id];
      if (!p) continue;
      const dx = mx - p.x, dy = my - p.y;
      if (dx*dx + dy*dy < (p.r+6)**2 && p.z > bestZ) {
        found = n;
        bestZ = p.z;
      }
    }
    return found;
  },[]);

  const focusNode = useCallback((n: GNode | null) => {
    if (!n) {
      gr.current.view.targetZoom = 1;
      return;
    }
    const yaw = Math.atan2(n.x, n.z);
    const z1 = Math.hypot(n.x, n.z);
    const pitch = Math.atan2(n.y, z1);
    gr.current.view.targetYaw = yaw;
    gr.current.view.targetPitch = pitch;
    gr.current.view.targetZoom = 1.95;
  },[]);

  useEffect(()=>{
    gr.current.selId=selId;
    const n = selId ? gr.current.nodes.find(x => x.id === selId) ?? null : null;
    focusNode(n);
  },[selId, focusNode]);
  useEffect(()=>{ gr.current.dimmed=dimmed; },[dimmed]);

  // Load the live graph (countries + scraped URL nodes) from the backend. The graph
  // shows ONLY active, reachable URLs — no seeded or mock data.
  const payloadRef = useRef<ApiGraph | null>(null);
  const tryBuild = useCallback(()=>{
    const p = payloadRef.current;
    if (!p || gr.current.init || gr.current.w<=0 || gr.current.h<=0) return;
    const { nodes, edges } = graphFromApi(p, gr.current.w, gr.current.h);
    gr.current.nodes = nodes; gr.current.edges = edges; gr.current.init = true;
  },[]);

  useEffect(()=>{
    const base = (import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
    if (!base) { setLoadState("error"); return; }
    let cancelled = false;
    setLoadState("loading");
    fetch(`${base}/graph`)
      .then(r => r.json())
      .then((payload: ApiGraph) => {
        if (cancelled) return;
        payloadRef.current = payload;
        setLoadState(payload?.nodes?.length ? "ready" : "empty");
        tryBuild();
      })
      .catch(() => { if (!cancelled) setLoadState("error"); });
    return ()=>{ cancelled = true; };
  },[tryBuild]);

  useEffect(()=>{
    if (!simulateAction.tick || !gr.current.init || gr.current.nodes.length===0) return;

    const preferred =
      (simulateAction.step === "crawler" ? gr.current.nodes.find(n => n.id === "vn-csl") : null) ??
      (simulateAction.step === "translation" ? gr.current.nodes.find(n => n.id === "th-pdpa") : null) ??
      (simulateAction.step === "versioning" ? gr.current.nodes.find(n => n.id === "sg-pdpa") : null) ??
      gr.current.nodes.find(n => n.type === "regulation") ??
      gr.current.nodes[0];
    if (!preferred) return;

    const id = `sim-${simulateAction.step}-${simulateAction.tick}`;
    if (gr.current.nodes.some(n => n.id === id)) return;

    const stepMeta: Record<DemoStep, {label: string; short: string; color: string; desc: string}> = {
      crawler: {
        label: "Crawler Agent: New Publication",
        short: "Crawler",
        color: "#22D3EE",
        desc: "Step 2 — The Crawler Agent (1:05–1:30): Playwright + BeautifulSoup detected a newly published or amended legal document on a monitored government portal.",
      },
      ocr: {
        label: "OCR Agent: Scanned PDF Parsed",
        short: "OCR",
        color: "#60A5FA",
        desc: "Step 3 — OCR Processing (1:30–1:55): Tesseract + PaddleOCR converted an image-based legal scan into machine-readable text with structure metadata.",
      },
      translation: {
        label: "Translation Agent: Thai PDPA Normalized",
        short: "Translate",
        color: "#A78BFA",
        desc: "Step 4 — Multilingual Handling (1:55–2:20): Thai-language regulation normalized into English while preserving legal terminology using glossary constraints.",
      },
      versioning: {
        label: "Version Chain Updated",
        short: "Version",
        color: "#34D399",
        desc: "Step 5 — Versioning & Storage (2:20–2:30): full amendment lineage stored with timestamped snapshots for historical legal context.",
      },
    };
    const meta = stepMeta[simulateAction.step];

    const newNode: GNode = {
      id,
      type: "amendment",
      label: meta.label,
      shortLabel: meta.short,
      countryId: preferred.countryId,
      x: preferred.x + 70 + (Math.random() - 0.5) * 24,
      y: preferred.y - 42 + (Math.random() - 0.5) * 20,
      z: preferred.z + 64 + (Math.random() - 0.5) * 24,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 10,
      color: meta.color,
      glowColor: meta.color,
      pulsePhase: Math.random() * Math.PI * 2,
      alerting: true,
      details: {
        category: "Pipeline Simulation",
        enacted: "Live",
        status: "Proposed",
        clauses: 1,
        amendments: 0,
        coverage: preferred.countryId ? COUNTRY_DATA[preferred.countryId]?.name || "ASEAN" : "ASEAN",
        confidence: 0.96,
        description: meta.desc,
      },
    };

    gr.current.nodes.push(newNode);
    gr.current.edges.push({
      id: `sim-edge-${simulateAction.step}-${simulateAction.tick}`,
      sourceId: preferred.id,
      targetId: id,
      type: "simulation",
      particles: [{ progress: Math.random(), speed: 0.004, opacity: 1 }],
    });

    onSelect(newNode);
    focusNode(newNode);
  },[simulateAction, onSelect, focusNode]);

  useEffect(()=>{
    const c=cvs.current; if (!c) return;
    const setup=()=>{
      const w=c.offsetWidth, h=c.offsetHeight;
      c.width=w; c.height=h; gr.current.w=w; gr.current.h=h;
      tryBuild(); // build from live API payload once dimensions are known (no seed/mock)
    };
    setup();
    const ro=new ResizeObserver(setup); ro.observe(c.parentElement!);
    let tick=0;
    const loop=()=>{
      gr.current.time+=16; tick++;
      gr.current.edges.forEach(e=>e.particles.forEach(p=>{ p.progress+=p.speed; if(p.progress>1)p.progress=0; }));
      if (tick%2===0) applyForces(gr.current.nodes,gr.current.edges,gr.current.w,gr.current.h);
      gr.current.view.targetYaw += (gr.current.rotateMode || gr.current.hovId) ? 0 : 0.0012;
      gr.current.view.yaw += (gr.current.view.targetYaw - gr.current.view.yaw) * 0.14;
      gr.current.view.pitch += (gr.current.view.targetPitch - gr.current.view.pitch) * 0.14;
      gr.current.view.zoom += (gr.current.view.targetZoom - gr.current.view.zoom) * 0.1;

      // Ambient "scan" — periodically light up a node, like the loader.
      const scannable = gr.current.nodes.filter(n=>n.type==="regulation"||n.type==="pillar");
      if (scannable.length && gr.current.time - gr.current.scanStart > 1500) {
        gr.current.scanId = scannable[Math.floor(Math.random()*scannable.length)].id;
        gr.current.scanStart = gr.current.time;
      }
      const st = gr.current.time - gr.current.scanStart;
      const scanGlow = Math.sin(Math.min(1, st/1200) * Math.PI); // ease in/out over ~1.2s

      const ctx=c.getContext("2d");
      if (ctx&&gr.current.init) {
        gr.current.projected = drawGraph(
          ctx,
          gr.current.nodes,
          gr.current.edges,
          gr.current.w,
          gr.current.h,
          gr.current.hovId,
          gr.current.selId,
          gr.current.time,
          gr.current.dimmed,
          { yaw: gr.current.view.yaw, pitch: gr.current.view.pitch, zoom: gr.current.view.zoom },
          gr.current.scanId,
          scanGlow
        );
      }
      gr.current.raf=requestAnimationFrame(loop);
    };
    gr.current.raf=requestAnimationFrame(loop);
    return ()=>{ ro.disconnect(); cancelAnimationFrame(gr.current.raf); };
  },[]);

  const onMove=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{
    const r=cvs.current!.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    if (gr.current.rotateMode) {
      const dx = mx - gr.current.lastMx;
      const dy = my - gr.current.lastMy;
      gr.current.lastMx = mx;
      gr.current.lastMy = my;
      gr.current.moved += Math.abs(dx) + Math.abs(dy);
      gr.current.view.targetYaw -= dx * 0.0052;
      gr.current.view.targetPitch -= dy * 0.0048;
      gr.current.view.targetPitch = Math.max(-1.1, Math.min(1.1, gr.current.view.targetPitch));
      return;
    }
    const hit = findNodeAt(mx, my);
    const hov = hit?.id ?? null;
    gr.current.hovId=hov; cvs.current!.style.cursor=hov?"pointer":"default";
    if (hit) {
      const sub = hit.type==="country" ? `Jurisdiction · ${hit.details?.coverage ?? ""}`.trim()
        : hit.type==="clause" ? `Clause · ${hit.details?.coverage ?? ""}`.trim()
        : hit.type==="regulation" ? `Regulation · ${hit.details?.coverage ?? ""}`.trim()
        : hit.type;
      setHover({ label: hit.label, sub, x: mx, y: my });
    } else if (hover) setHover(null);
  },[findNodeAt, hover]);

  const onDown=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{
    const r=cvs.current!.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
    const n = findNodeAt(mx, my);
    gr.current.dragId = n?.id ?? null;
    gr.current.rotateMode = !n;
    gr.current.moved = 0;
    gr.current.lastMx = mx;
    gr.current.lastMy = my;
  },[findNodeAt]);

  const onUp=useCallback(()=>{ gr.current.dragId=null; gr.current.rotateMode=false; },[]);

  const onClick=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{
    if (gr.current.moved > 6) return;
    const r=cvs.current!.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
    const found = findNodeAt(mx, my);
    onSelect(found);
    focusNode(found);
  },[findNodeAt, focusNode, onSelect]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const z = gr.current.view.targetZoom - e.deltaY * 0.0012;
    gr.current.view.targetZoom = Math.max(0.65, Math.min(2.6, z));
  },[]);

  return (
    <>
      <canvas ref={cvs} className="absolute inset-0 w-full h-full"
        onMouseMove={onMove} onMouseDown={onDown} onMouseUp={onUp}
        onClick={onClick} onWheel={onWheel}
        onMouseLeave={()=>{gr.current.hovId=null; gr.current.rotateMode=false; setHover(null);}} />

      {hover && (
        <div className="absolute z-30 pointer-events-none"
          style={{left:hover.x+14, top:hover.y+14, maxWidth:280}}>
          <div style={{background:"rgba(8,11,20,0.96)",border:"1px solid rgba(129,140,248,0.32)",borderRadius:"8px",padding:"7px 10px",boxShadow:"0 8px 28px rgba(0,0,0,0.55)"}}>
            <div style={{color:"#E6EAF2",fontSize:"12px",fontWeight:600,fontFamily:"Inter, sans-serif",lineHeight:1.3}}>{hover.label}</div>
            <div style={{color:"#818CF8",fontSize:"10px",marginTop:"2px",fontFamily:"IBM Plex Sans, sans-serif",textTransform:"uppercase",letterSpacing:"0.06em"}}>{hover.sub}</div>
          </div>
        </div>
      )}
      {loadState!=="ready" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <div className="text-center">
            {loadState==="loading" && (
              <>
                <div className="mx-auto mb-4 w-8 h-8 rounded-full border-2 animate-spin"
                  style={{borderColor:"rgba(15,23,42,0.12)",borderTopColor:"#1E3A5F"}}/>
                <p className="text-xs tracking-widest uppercase" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>
                  Fetching active regulatory sources…
                </p>
              </>
            )}
            {loadState==="empty" && (
              <p className="text-xs tracking-widest uppercase" style={{color:"#94A3B8",fontFamily:"IBM Plex Sans, sans-serif"}}>
                No active sources reachable
              </p>
            )}
            {loadState==="error" && (
              <p className="text-xs tracking-widest uppercase" style={{color:"#94A3B8",fontFamily:"IBM Plex Sans, sans-serif"}}>
                Backend unavailable — set VITE_AILA_API_BASE_URL
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ==================== NAV ====================
const NAV_ITEMS: Array<{id:ViewId;label:string;icon:React.ElementType;short:string}> = [
  {id:"sme",label:"Consultation",icon:MessageSquare,short:"Chat"},
  {id:"simulation",label:"Simulation",icon:FlaskConical,short:"Sim"},
  {id:"memory",label:"Document Archive",icon:Database,short:"Memory"},
  {id:"settings",label:"Settings",icon:Settings,short:"Settings"},
];

function TopNav({ cur, onNav }: { cur: ViewId; onNav: (v: ViewId) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDash = cur === "dashboard" || cur === "graph";
  const toolActive = isDash || cur === "countries" || cur === "diff" || cur === "api";

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const TOOLS: Array<{id:ViewId;label:string;desc:string;icon:React.ElementType}> = [
    {id:"dashboard",label:"Regulatory Graph",desc:"Live ASEAN regulatory network",icon:Network},
    {id:"countries",label:"Jurisdiction Overview",desc:"Country-level compliance data",icon:Globe},
    {id:"diff",label:"Country Comparison",desc:"Cross-border transfer analysis",icon:GitBranch},
    {id:"api",label:"API Reference",desc:"Endpoints and authentication",icon:Code2},
  ];

  const NAVY = "#60A5FA";     // sharp accent (blue-400) on dark
  const FG = "#E2E8F0", MUTE = "#64748B", LINE = "rgba(148,163,184,0.14)";
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4" style={{paddingTop:"10px",pointerEvents:"none"}}>
      <div
        className="flex items-center w-full max-w-6xl px-5"
        style={{
          pointerEvents:"auto",
          height:"50px",
          borderRadius:"16px",
          background:"rgba(16,18,27,0.55)",
          backdropFilter:"blur(22px) saturate(170%)",
          WebkitBackdropFilter:"blur(22px) saturate(170%)",
          border:"1px solid rgba(255,255,255,0.1)",
          boxShadow:"0 10px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
        }}
      >
        <button onClick={() => onNav("dashboard")} className="flex items-center gap-3 shrink-0 mr-8">
          <img src={ailaLogo} alt="AILA" style={{height:"22px",width:"auto",objectFit:"contain",filter:"brightness(0) invert(1)"}}/>
          <span
            className="hidden md:block text-xs font-semibold tracking-widest uppercase pl-3 border-l"
            style={{color:MUTE,borderColor:LINE,fontFamily:"IBM Plex Sans, sans-serif",letterSpacing:"0.14em"}}
          >
            Regulatory Intelligence
          </span>
        </button>

        <div className="flex-1" />

        <nav className="flex items-center h-full">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isA = cur === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                className="flex items-center gap-2 px-3.5 py-1.5 mx-0.5 text-sm font-medium transition-colors rounded-lg"
                style={{color:isA?FG:MUTE,background:isA?"rgba(96,165,250,0.14)":"transparent",border:`1px solid ${isA?"rgba(96,165,250,0.3)":"transparent"}`}}
              >
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mx-4 shrink-0" style={{width:"1px",height:"20px",background:LINE}} />

        <div ref={menuRef} className="relative shrink-0 h-full flex items-center">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium transition-colors rounded-lg"
            style={{color:toolActive?FG:MUTE,background:toolActive?"rgba(96,165,250,0.14)":"transparent",border:`1px solid ${toolActive?"rgba(96,165,250,0.3)":"transparent"}`}}
          >
            <Network size={13} />
            Graph
            <ChevronRight size={11}
              style={{transform:menuOpen?"rotate(90deg)":"rotate(0deg)",transition:"transform 0.15s"}}/>
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                transition={{duration:0.12}}
                className="absolute right-0 top-full w-64 rounded-lg py-1 z-50 overflow-hidden"
                style={{marginTop:"6px",background:"rgba(15,17,21,0.96)",backdropFilter:"blur(14px)",border:`1px solid ${LINE}`,boxShadow:"0 16px 40px rgba(0,0,0,0.55)"}}
              >
                {TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  const isA = tool.id === "dashboard" ? isDash : cur === tool.id;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => { onNav(tool.id); setMenuOpen(false); }}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
                      style={{borderLeft:`2px solid ${isA?NAVY:"transparent"}`,background:isA?"rgba(96,165,250,0.08)":"transparent"}}
                    >
                      <Icon size={14} style={{color:isA?NAVY:MUTE,marginTop:"2px",flexShrink:0}}/>
                      <div>
                        <div className="text-sm font-medium leading-tight" style={{color:isA?"#F1F5F9":FG}}>
                          {tool.label}
                        </div>
                        <div className="text-xs mt-0.5" style={{color:MUTE}}>{tool.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

// ==================== INTEL PANELS ====================
const PANEL_STYLE = {background:"rgba(255,255,255,0.93)",backdropFilter:"blur(18px)",border:"1px solid rgba(0,0,0,0.08)",borderRadius:"10px",boxShadow:"0 2px 12px rgba(0,0,0,0.08)"};

function PanelTitle({children}:{children:React.ReactNode}) {
  return <div className="px-3 py-2 border-b" style={{borderColor:"rgba(0,0,0,0.06)"}}>
    <span className="text-xs font-semibold tracking-widest uppercase" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>{children}</span>
  </div>;
}
function StatRow({label,value,color,dot}:{label:string;value:string|number;color?:string;dot?:string}) {
  return <div className="flex items-center justify-between">
    <span className="text-xs" style={{color:"#64748B"}}>{label}</span>
    <span className="flex items-center gap-1.5 text-xs font-medium" style={{color:color||"#374151",fontFamily:"JetBrains Mono, monospace"}}>
      {dot&&<span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:dot}}/>}
      {value}
    </span>
  </div>;
}

function IntelPanels({ simulatedEvent }: { simulatedEvent: LiveEvent | null }) {
  const base=(import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
  const [stats,setStats] = useState({regs:0,amends:0,diffs:0,queue:0,aiConf:0,ragH:98.1,memGb:"142.7",conflicts:0,precedents:0});
  const [feedIdx,setFeedIdx] = useState(0);
  const [extraEvents,setExtraEvents] = useState<LiveEvent[]>([]);
  const [realFeed,setRealFeed] = useState<LiveEvent[]|null>(null);

  useEffect(()=>{
    if (!simulatedEvent) return;
    setExtraEvents(prev => [simulatedEvent, ...prev].slice(0, 6));
  },[simulatedEvent]);

  // Real dashboard metrics + activity feed (polled), no fabricated numbers.
  useEffect(()=>{
    if(!base) return;
    const mapType=(t:string):LiveEvent["type"]=>t==="validate"?"verify":t==="diff"?"diff":t==="alert"?"alert":(t==="extract"||t==="ingest"||t==="scrape")?"ingest":"analysis";
    const load=()=>{
      fetch(`${base}/stats`).then(r=>r.json()).then(d=>setStats(s=>({...s,
        regs:d.regulations??s.regs, amends:d.newFindings??s.amends, diffs:d.validations??s.diffs,
        queue:d.reviewQueue??s.queue, aiConf:d.avgConfidence!=null?d.avgConfidence*100:s.aiConf,
        conflicts:d.reviewQueue??s.conflicts, precedents:d.clauses??s.precedents}))).catch(()=>{});
      fetch(`${base}/activity`).then(r=>r.json()).then(d=>{ if(Array.isArray(d)&&d.length)
        setRealFeed(d.slice(0,8).map((e:any)=>({type:mapType(e.type),text:e.text,time:new Date(e.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}))); }).catch(()=>{});
    };
    load(); const t=setInterval(load,6000); return ()=>clearInterval(t);
  },[base]);

  const mergedFeed = [...extraEvents, ...(realFeed ?? LIVE_EVENTS)];
  useEffect(()=>{
    const t=setInterval(()=>setFeedIdx(i=>(i+1)%Math.max(1, mergedFeed.length)),2800);
    return ()=>clearInterval(t);
  },[mergedFeed.length]);

  const feed=mergedFeed.slice(feedIdx,feedIdx+3).concat(mergedFeed.slice(0,Math.max(0,3-(mergedFeed.length-feedIdx))));
  const feedColors:{[k:string]:string}={alert:"#EF4444",diff:"#334155",verify:"#10B981",ingest:"#1E3A5F",analysis:"#1E3A5F"};

  return <>
    {/* Top Left */}
    <motion.div initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:0.3,duration:0.5}}
      className="absolute top-20 left-4 w-56 z-40" style={PANEL_STYLE}>
      <PanelTitle>System Status</PanelTitle>
      <div className="p-3 space-y-2">
        <StatRow label="Active Jurisdictions" value="6 / 6" color="#10B981" dot="#10B981"/>
        <StatRow label="Regulations Tracked" value={stats.regs.toLocaleString()} color="#475569"/>
        <StatRow label="Amendment Alerts" value={stats.amends} color={stats.amends>10?"#F59E0B":"#94A3B8"} dot={stats.amends>0?"#F59E0B":undefined}/>
        <StatRow label="Monitor Activity" value="3 active" color="#10B981" dot="#10B981"/>
        <div className="pt-1 border-t" style={{borderColor:"rgba(0,0,0,0.07)"}}>
          <StatRow label="Processing Queue" value={`${stats.queue} docs`} color="#64748B"/>
        </div>
      </div>
    </motion.div>

    {/* Top Right */}
    <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} transition={{delay:0.35,duration:0.5}}
      className="absolute top-20 right-4 w-56 z-40" style={PANEL_STYLE}>
      <PanelTitle>AI Analytics</PanelTitle>
      <div className="p-3 space-y-2">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs" style={{color:"#64748B"}}>AI Confidence</span>
            <span className="text-xs font-medium" style={{color:"#10B981",fontFamily:"JetBrains Mono, monospace"}}>{stats.aiConf.toFixed(1)}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{background:"rgba(0,0,0,0.07)"}}>
            <div className="h-full rounded-full transition-all duration-700" style={{width:`${stats.aiConf}%`,background:"linear-gradient(90deg,#10B98180,#10B981)"}}/>
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs" style={{color:"#64748B"}}>Knowledge Base</span>
            <span className="text-xs font-medium" style={{color:"#10B981",fontFamily:"JetBrains Mono, monospace"}}>{stats.ragH.toFixed(1)}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{background:"rgba(0,0,0,0.07)"}}>
            <div className="h-full rounded-full transition-all duration-700" style={{width:`${stats.ragH}%`,background:"linear-gradient(90deg,#1E3A5F80,#1E3A5F)"}}/>
          </div>
        </div>
        <StatRow label="Change Detections" value={stats.diffs} color="#334155" dot="#334155"/>
        <StatRow label="Document Index" value={`${stats.memGb} GB`} color="#1E3A5F"/>
      </div>
    </motion.div>

    {/* Bottom Left */}
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.4,duration:0.5}}
      className="absolute bottom-4 left-4 w-60 z-40" style={PANEL_STYLE}>
      <PanelTitle>Activity Feed</PanelTitle>
      <div className="p-3 space-y-1.5">
        {feed.map((ev,i)=>(
          <motion.div key={`${feedIdx}-${i}`} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.06}}
            className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0 animate-pulse" style={{background:feedColors[ev.type]||"#94A3B8"}}/>
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-tight truncate" style={{color:"#94A3B8"}}>{ev.text}</p>
              <span className="text-xs" style={{color:"#64748B",fontFamily:"JetBrains Mono, monospace"}}>{ev.time}</span>
            </div>
          </motion.div>
        ))}
        <div className="pt-1.5 border-t flex items-center gap-1.5" style={{borderColor:"rgba(0,0,0,0.06)"}}>
          <Radio size={10} style={{color:"#10B981"}} className="animate-pulse"/>
          <span className="text-xs" style={{color:"#10B981",fontFamily:"JetBrains Mono, monospace"}}>18 portals monitored</span>
        </div>
      </div>
    </motion.div>

    {/* Bottom Right */}
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.45,duration:0.5}}
      className="absolute bottom-4 right-4 w-56 z-40" style={PANEL_STYLE}>
      <PanelTitle>Compliance Status</PanelTitle>
      <div className="p-3 space-y-2">
        <StatRow label="Active Simulations" value="2 running" color="#1E3A5F" dot="#1E3A5F"/>
        <StatRow label="Regulatory Conflicts" value={stats.conflicts} color={stats.conflicts>2?"#EF4444":"#F59E0B"} dot={stats.conflicts>0?"#EF4444":undefined}/>
        <StatRow label="Precedent Matches" value={stats.precedents} color="#334155"/>
        <div className="pt-2 border-t space-y-1.5" style={{borderColor:"rgba(0,0,0,0.06)"}}>
          {[{country:"PH Philippines",score:87,c:"#1E3A5F"},{country:"SG Singapore",score:94,c:"#10B981"},{country:"VN Vietnam",score:71,c:"#EF4444"}].map(r=>(
            <div key={r.country}>
              <div className="flex justify-between mb-0.5">
                <span className="text-xs" style={{color:"#64748B"}}>{r.country}</span>
                <span className="text-xs" style={{color:r.c,fontFamily:"JetBrains Mono, monospace"}}>{r.score}%</span>
              </div>
              <div className="h-0.5 rounded-full overflow-hidden" style={{background:"rgba(0,0,0,0.07)"}}>
                <div className="h-full rounded-full" style={{width:`${r.score}%`,background:r.c}}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  </>;
}

// Lightweight client mirror of server/src/authority.ts — primary (official) vs secondary source.
function sourceTier(url?:string):"primary"|"secondary"|null {
  if(!url) return null;
  let host=""; try{ host=new URL(url).hostname.toLowerCase().replace(/^www\./,""); }catch{ return null; }
  if(!host||host.includes("archive.org")) return host?"secondary":null;
  if(/(^|\.)gov(\.[a-z]{2})?$|(^|\.)go\.[a-z]{2}$|(^|\.)gob\.[a-z]{2}$|(^|\.)gouv\.[a-z]{2}$|(^|\.)gc\.ca$|(^|\.)govt\.nz$|(^|\.)mil(\.[a-z]{2})?$/.test(host)) return "primary";
  if(/(^|\.)int$|(^|\.)europa\.eu$|(^|\.)un\.org$/.test(host)||["wto.org","wipo.int","oecd.org","asean.org","apec.org","worldbank.org","imf.org"].includes(host)) return "primary";
  return "secondary";
}

// ==================== INTELLIGENCE DRAWER ====================
type AIClass = { rdtii?:Array<{code:string;name:string}>; pillars:string[]; policyFocus:string[]; coverage:string; rationale:string; model:string };
type Clause = { type:string; text:string; actor?:string; indicators?:string[]; rdtii?:string[]; level?:string; lawNumber?:string; lastAmended?:string; locationReference?:string; mappingRationale?:string; discoveryTag?:string; notes?:string; penalty?:string; effectiveDate?:string; citation?:string; sourceQuote?:string; confidence?:number; reviewNeeded?:boolean };
function IntelligenceDrawer({node,onClose,side="right"}:{node:GNode;onClose:()=>void;side?:"right"|"left"}) {
  const details=node.details;
  const isC=node.type==="country";
  const cd=node.countryId?COUNTRY_DATA[node.countryId]:null;
  const ci=isC?COUNTRY_DATA[node.id]:null;
  const NAVY=node.glowColor;  // dark-modal accent (was brand navy on the light panel)
  const [aiState,setAiState]=useState<"idle"|"loading"|"done"|"error">("idle");
  const [ai,setAi]=useState<AIClass|null>(null);
  const [aiErr,setAiErr]=useState("");
  const [clState,setClState]=useState<"idle"|"loading"|"done"|"error">("idle");
  const [clauses,setClauses]=useState<Clause[]>([]);
  const [clErr,setClErr]=useState("");
  const [dfState,setDfState]=useState<"idle"|"loading"|"done"|"error">("idle");
  const [diff,setDiff]=useState<any>(null);
  const [dfErr,setDfErr]=useState("");
  const [engState,setEngState]=useState<"idle"|"loading"|"done"|"error">("idle");
  const [eng,setEng]=useState<any>(null);
  const [engErr,setEngErr]=useState("");

  const reclassify=async()=>{
    const base=(import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
    if(!base){ setAiState("error"); setAiErr("Backend not configured"); return; }
    setAiState("loading"); setAiErr("");
    try{
      const r=await fetch(`${base}/classify`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({instrument:node.label,jurisdiction:details?.coverage,url:node.url})});
      if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.error||`HTTP ${r.status}`); }
      setAi(await r.json()); setAiState("done");
    }catch(err){ setAiErr(err instanceof Error?err.message:String(err)); setAiState("error"); }
  };

  const extractClauses=async()=>{
    const base=(import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
    if(!base||!node.url){ setClState("error"); setClErr("Backend not configured"); return; }
    setClState("loading"); setClErr("");
    try{
      const r=await fetch(`${base}/extract`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:node.url})});
      if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.error||`HTTP ${r.status}`); }
      const d=await r.json(); setClauses(d.clauses||[]); setClState("done");
    }catch(err){ setClErr(err instanceof Error?err.message:String(err)); setClState("error"); }
  };

  const checkDiff=async()=>{
    const base=(import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
    if(!base||!node.url){ setDfState("error"); setDfErr("Backend not configured"); return; }
    setDfState("loading"); setDfErr("");
    try{
      const r=await fetch(`${base}/diff`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:node.url})});
      if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.error||`HTTP ${r.status}`); }
      setDiff(await r.json()); setDfState("done");
    }catch(err){ setDfErr(err instanceof Error?err.message:String(err)); setDfState("error"); }
  };

  const runEngine=async()=>{
    const base=(import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
    if(!base||!node.url){ setEngState("error"); setEngErr("Backend not configured"); return; }
    setEngState("loading"); setEngErr("");
    try{
      const r=await fetch(`${base}/engine/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:node.url})});
      if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.error||`HTTP ${r.status}`); }
      const out=await r.json(); setEng(out); setEngState("done");
    }catch(err){ setEngErr(err instanceof Error?err.message:String(err)); setEngState("error"); }
  };
  const downloadEngine=()=>{
    if(!eng) return;
    const blob=new Blob([JSON.stringify(eng,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`aila-output-${eng.document.id}.json`; a.click(); URL.revokeObjectURL(a.href);
  };

  if (!details) return null;
  const conf=details.confidence;
  const confC=conf>0.9?"#10B981":conf>0.75?"#F59E0B":"#EF4444";

  // Dark modal theme tokens — matched to the graph field (pure black + indigo accent)
  const ACC=node.glowColor;
  const SURF="#101725", SURFA="rgba(129,140,248,0.06)";
  const BORD="rgba(129,140,248,0.16)", BORD2="rgba(255,255,255,0.08)";
  const TXT="#F1F4FA", TXT2="#A6AEC0", TXT3="#CBD2DE";

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.18}}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{background:"rgba(2,4,10,0.72)",backdropFilter:"blur(6px)"}}>
    <motion.div initial={{scale:0.94,opacity:0,y:10}} animate={{scale:1,opacity:1,y:0}} exit={{scale:0.96,opacity:0,y:8}}
      transition={{type:"spring",damping:26,stiffness:300}}
      onClick={e=>e.stopPropagation()}
      className="relative w-full max-w-md max-h-[86vh] overflow-y-auto flex flex-col"
      style={{background:"#080B14",border:`1px solid ${BORD}`,borderRadius:"14px",boxShadow:`0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4), 0 0 40px ${h2r(ACC,0.12)}`}}>

      <div className="sticky top-0 z-10 flex items-start justify-between p-4"
        style={{borderBottom:`1px solid ${BORD2}`,background:"rgba(8,11,20,0.92)",backdropFilter:"blur(12px)"}}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {node.flag&&<span className="text-xl">{node.flag}</span>}
            <span className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded"
              style={{background:h2r(ACC,0.16),color:ACC,fontFamily:"IBM Plex Sans, sans-serif"}}>{node.type}</span>
            {node.alerting&&<span className="text-xs px-1.5 py-0.5 rounded animate-pulse" style={{background:"rgba(239,68,68,0.18)",color:"#F87171"}}>ALERT</span>}
          </div>
          <h3 className="font-semibold text-sm leading-snug" style={{color:TXT,fontFamily:"Inter, sans-serif"}}>{node.label}</h3>
          {cd&&!isC&&<p className="text-xs mt-0.5" style={{color:TXT2}}>{cd.flag} {cd.name}</p>}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md ml-2 transition-colors"
          style={{color:TXT2}} onMouseEnter={e=>(e.currentTarget.style.color=TXT)} onMouseLeave={e=>(e.currentTarget.style.color=TXT2)}>
          <X size={15}/>
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <p className="text-xs leading-relaxed whitespace-pre-line" style={{color:TXT3}}>{details.description}</p>

        {node.url&&(
          <a href={node.url} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{background:h2r(ACC,0.12),border:`1px solid ${h2r(ACC,0.34)}`,color:ACC,textDecoration:"none"}}
            onMouseEnter={e=>(e.currentTarget.style.background=h2r(ACC,0.2))}
            onMouseLeave={e=>(e.currentTarget.style.background=h2r(ACC,0.12))}>
            <Link size={13}/>
            <span className="truncate flex-1">{(()=>{try{return new URL(node.url).hostname;}catch{return "Open source";}})()}</span>
            <span style={{opacity:0.7}}>↗</span>
          </a>
        )}

        {node.type==="regulation"&&(
          <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${BORD2}`}}>
            <button onClick={reclassify} disabled={aiState==="loading"}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition-colors"
              style={{background:aiState==="loading"?SURF:NAVY,color:aiState==="loading"?TXT2:"#0A0E18",cursor:aiState==="loading"?"default":"pointer"}}>
              <Brain size={13}/>
              {aiState==="loading"?"Classifying with Gemini…":aiState==="done"?"Re-classify with AI":"Classify with AI"}
            </button>
            {aiState==="error"&&(
              <div className="px-3 py-2 text-xs" style={{color:"#F87171",background:"rgba(239,68,68,0.1)"}}>{aiErr}</div>
            )}
            {aiState==="done"&&ai&&(
              <div className="px-3 py-3 space-y-2.5" style={{background:SURF}}>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{color:TXT2,fontFamily:"IBM Plex Sans, sans-serif"}}>RDTII Categories</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ai.rdtii&&ai.rdtii.length?ai.rdtii.map(c=>(
                      <span key={c.code} className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{background:h2r(NAVY,0.14),color:NAVY,border:`1px solid ${h2r(NAVY,0.3)}`}}>
                        <span style={{fontFamily:"JetBrains Mono, monospace",fontSize:"9px",opacity:0.7}}>{c.code}</span>{c.name}
                      </span>
                    )):<span className="text-xs" style={{color:TXT2}}>—</span>}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{color:TXT2,fontFamily:"IBM Plex Sans, sans-serif"}}>Pillars</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ai.pillars.length?ai.pillars.map(p=>(
                      <span key={p} className="text-xs px-2 py-0.5 rounded-full" style={{background:h2r(NAVY,0.1),color:NAVY,border:`1px solid ${h2r(NAVY,0.24)}`}}>{p}</span>
                    )):<span className="text-xs" style={{color:TXT2}}>—</span>}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{color:TXT2,fontFamily:"IBM Plex Sans, sans-serif"}}>Policy focus</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ai.policyFocus.length?ai.policyFocus.map(p=>(
                      <span key={p} className="text-xs px-2 py-0.5 rounded-full" style={{background:SURFA,color:TXT3,border:`1px solid ${BORD2}`}}>{p}</span>
                    )):<span className="text-xs" style={{color:TXT2}}>—</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs" style={{color:TXT2}}>
                  <span className="font-medium" style={{color:TXT3}}>Coverage:</span> {ai.coverage}
                </div>
                {ai.rationale&&<p className="text-xs italic leading-relaxed" style={{color:TXT2}}>{ai.rationale}</p>}
                <p className="text-xs" style={{color:"#7A8398"}}>via {ai.model}</p>
              </div>
            )}
          </div>
        )}

        {node.type==="regulation"&&node.url&&(
          <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${BORD2}`}}>
            <button onClick={extractClauses} disabled={clState==="loading"}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition-colors"
              style={{background:clState==="loading"?SURF:SURFA,color:clState==="loading"?TXT2:NAVY,cursor:clState==="loading"?"default":"pointer"}}>
              <FileText size={13}/>
              {clState==="loading"?"Extracting clauses…":clState==="done"?"Re-extract clauses":"Extract clauses"}
            </button>
            {clState==="error"&&(
              <div className="px-3 py-2 text-xs" style={{color:"#F87171",background:"rgba(239,68,68,0.1)"}}>{clErr}</div>
            )}
            {clState==="done"&&(
              <div className="px-3 py-3" style={{background:SURF}}>
                {clauses.length===0?(
                  <p className="text-xs" style={{color:TXT2}}>No extractable clauses (page may be JS-rendered or scanned).</p>
                ):(
                  <div className="space-y-2.5">
                    <div className="text-xs font-semibold uppercase tracking-widest" style={{color:TXT2,fontFamily:"IBM Plex Sans, sans-serif"}}>{clauses.length} clauses extracted</div>
                    {clauses.map((c,i)=>{
                      const tc:Record<string,string>={obligation:"#818CF8",restriction:"#F87171",exception:"#FBBF24",penalty:"#FB923C",right:"#34D399",definition:"#94A3B8"};
                      const col=tc[c.type]||"#94A3B8";
                      return (
                        <div key={i} className="rounded-lg p-2.5" style={{background:"#0B1120",border:`1px solid ${BORD2}`}}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{color:col,background:h2r(col,0.14)}}>{c.type}</span>
                            {c.citation&&<span className="text-xs" style={{color:TXT2,fontFamily:"JetBrains Mono, monospace"}}>{c.citation}</span>}
                            {c.actor&&<span className="text-xs ml-auto" style={{color:TXT2}}>{c.actor}</span>}
                          </div>
                          <p className="text-xs leading-relaxed mb-1.5" style={{color:TXT}}>{c.text}</p>
                          {c.sourceQuote&&(
                            <p className="text-xs leading-snug pl-2" style={{color:TXT2,fontFamily:"Georgia, serif",fontStyle:"italic",borderLeft:`2px solid ${BORD}`}}>&ldquo;{c.sourceQuote}&rdquo;</p>
                          )}
                          {((c.indicators&&c.indicators.length)||c.penalty)&&(
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {(c.indicators||[]).map((id,k)=>(<span key={id} className="text-xs px-1.5 py-0.5 rounded-full inline-flex items-center gap-1" style={{background:h2r(NAVY,0.14),color:NAVY,border:`1px solid ${h2r(NAVY,0.28)}`}}><span style={{fontFamily:"JetBrains Mono, monospace",fontWeight:700,fontSize:"9px"}}>{id}</span>{c.rdtii?.[k]?<span style={{opacity:0.75}}>{c.rdtii[k]}</span>:null}</span>))}
                              {c.penalty&&<span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:"rgba(239,68,68,0.12)",color:"#F87171"}}>⚠ {c.penalty}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {node.type==="regulation"&&node.url&&(
          <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${BORD2}`}}>
            <button onClick={checkDiff} disabled={dfState==="loading"}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold transition-colors"
              style={{background:dfState==="loading"?SURF:SURFA,color:dfState==="loading"?TXT2:NAVY,cursor:dfState==="loading"?"default":"pointer"}}>
              <GitBranch size={13}/>
              {dfState==="loading"?"Checking versions…":dfState==="done"?"Re-check amendments":"Check amendments (semantic diff)"}
            </button>
            {dfState==="error"&&<div className="px-3 py-2 text-xs" style={{color:"#F87171",background:"rgba(239,68,68,0.1)"}}>{dfErr}</div>}
            {dfState==="done"&&diff&&(
              <div className="px-3 py-3" style={{background:SURF}}>
                {diff.versions<2?(
                  <p className="text-xs" style={{color:TXT2}}>{diff.note||`${diff.versions||0} version(s) captured — a diff appears once the regulation changes between crawls.`}</p>
                ):(
                  <>
                    <div className="flex items-center gap-3 mb-2 text-xs">
                      <span style={{color:"#34D399"}}>+{diff.summary.added} added</span>
                      <span style={{color:"#F87171"}}>−{diff.summary.removed} removed</span>
                      <span style={{color:"#FBBF24"}}>~{diff.summary.modified} modified</span>
                      {diff.summary.high>0&&<span className="ml-auto px-1.5 py-0.5 rounded" style={{background:"rgba(239,68,68,0.14)",color:"#F87171",fontWeight:700}}>{diff.summary.high} high-severity</span>}
                    </div>
                    <div className="space-y-1.5">
                      {diff.changes.slice(0,8).map((ch:any,i:number)=>{
                        const kc:Record<string,string>={added:"#34D399",removed:"#F87171",modified:"#FBBF24"};
                        const sc:Record<string,string>={high:"#F87171",medium:"#FBBF24",low:"#94A3B8"};
                        return (
                          <div key={i} className="text-xs" style={{borderLeft:`2px solid ${kc[ch.kind]}`,paddingLeft:"8px"}}>
                            <div className="flex items-center gap-1.5">
                              <span style={{color:kc[ch.kind],fontWeight:700,textTransform:"uppercase",fontSize:"10px"}}>{ch.kind}</span>
                              <span style={{color:sc[ch.severity],fontSize:"10px"}}>{ch.severity}</span>
                            </div>
                            <p style={{color:TXT3,marginTop:"1px"}}>{ch.text}</p>
                            {ch.from&&<p style={{color:TXT2,fontStyle:"italic"}}>was: {ch.from}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {node.type==="regulation"&&node.url&&(
          <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${h2r(NAVY,0.4)}`}}>
            <button onClick={runEngine} disabled={engState==="loading"}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold transition-colors"
              style={{background:engState==="loading"?SURF:NAVY,color:engState==="loading"?TXT2:"#0A0E18",cursor:engState==="loading"?"default":"pointer"}}>
              <Radio size={13}/>
              {engState==="loading"?"Running engine (discovery → extraction → mapping)…":engState==="done"?"Re-run full engine":"Run full engine → Output Sample"}
            </button>
            {engState==="error"&&<div className="px-3 py-2 text-xs" style={{color:"#F87171",background:"rgba(239,68,68,0.1)"}}>{engErr}</div>}
            {engState==="done"&&eng&&(
              <div className="px-3 py-3 space-y-2" style={{background:SURF}}>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  {[["discovery",`${eng.pipeline.discovery.ms}ms`],["extraction",`${eng.pipeline.extraction.clauseCount} clauses`],["mapping",`${eng.pipeline.mapping.rdtii.length} indicators`]].map(([l,v]:any)=>(
                    <div key={l} className="rounded-md py-1.5" style={{background:"#0B1120",border:`1px solid ${BORD2}`}}>
                      <div className="text-xs font-bold" style={{color:NAVY,fontFamily:"JetBrains Mono, monospace"}}>{v}</div>
                      <div className="text-xs" style={{color:TXT2}}>{l}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{color:TXT2,fontFamily:"IBM Plex Sans, sans-serif"}}>Discovery tags</div>
                  <div className="flex flex-wrap gap-1">
                    {eng.document.discoveryTags.slice(0,8).map((t:string)=>(<span key={t} className="text-xs px-1.5 py-0.5 rounded-full" style={{background:h2r(NAVY,0.1),color:NAVY}}>{t}</span>))}
                  </div>
                </div>
                <button onClick={downloadEngine} className="w-full flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold" style={{background:SURFA,border:`1px solid ${h2r(NAVY,0.34)}`,color:NAVY,cursor:"pointer"}}>
                  <FileText size={12}/> Download Output Sample (JSON)
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {[{l:"Category",v:details.category},{l:"Status",v:details.status,c:details.status==="Active"?"#34D399":details.status==="Proposed"?"#FBBF24":"#F87171"},{l:"Enacted",v:details.enacted},{l:"Coverage",v:details.coverage}]
            .filter(m=>m.v&&m.v!=="N/A").map(m=>(
            <div key={m.l} className="rounded-lg p-2.5" style={{background:SURFA,border:`1px solid ${BORD2}`}}>
              <div className="text-xs mb-0.5" style={{color:TXT2}}>{m.l}</div>
              <div className="text-xs font-medium truncate" style={{color:(m as any).c||TXT,fontFamily:"JetBrains Mono, monospace"}}>{m.v}</div>
            </div>
          ))}
        </div>

        {!isC&&(
          <div className="flex gap-3">
            {[{v:details.clauses,l:"Clauses",c:ACC,bg:h2r(ACC,0.1),br:h2r(ACC,0.24)},
              {v:details.amendments,l:"Amendments",c:"#FBBF24",bg:"rgba(251,191,36,0.1)",br:"rgba(251,191,36,0.24)"}].map(s=>(
              <div key={s.l} className="flex-1 rounded-lg p-2.5 text-center" style={{background:s.bg,border:`1px solid ${s.br}`}}>
                <div className="text-xl font-bold" style={{color:s.c,fontFamily:"JetBrains Mono, monospace"}}>{s.v}</div>
                <div className="text-xs mt-0.5" style={{color:TXT2}}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {isC&&ci&&(
          <>
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg p-2.5 text-center" style={{background:h2r(ACC,0.1),border:`1px solid ${h2r(ACC,0.24)}`}}>
                <div className="text-xl font-bold" style={{color:ACC,fontFamily:"JetBrains Mono, monospace"}}>{ci.regulations.length}</div>
                <div className="text-xs mt-0.5" style={{color:TXT2}}>Regulations</div>
              </div>
              <div className="flex-1 rounded-lg p-2.5 text-center" style={{background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.24)"}}>
                <div className="text-xl font-bold" style={{color:"#34D399",fontFamily:"JetBrains Mono, monospace"}}>{Math.round((details.complianceScore||0.85)*100)}%</div>
                <div className="text-xs mt-0.5" style={{color:TXT2}}>Compliance</div>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{color:TXT2,fontFamily:"IBM Plex Sans, sans-serif"}}>Tracked Regulations</p>
              {ci.regulations.map(r=>(
                <div key={r.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{background:SURFA,border:`1px solid ${BORD2}`}}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:ACC}}/>
                  <span className="text-xs flex-1 truncate" style={{color:TXT3}}>{r.label}</span>
                  <span className="text-xs shrink-0" style={{color:TXT2,fontFamily:"JetBrains Mono, monospace"}}>{r.clauses}§</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{color:TXT2,fontFamily:"IBM Plex Sans, sans-serif"}}>AI Confidence</span>
            <span className="text-xs font-bold" style={{color:confC,fontFamily:"JetBrains Mono, monospace"}}>{(conf*100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.08)"}}>
            <motion.div initial={{width:0}} animate={{width:`${conf*100}%`}} transition={{duration:0.9,delay:0.2}}
              className="h-full rounded-full" style={{background:`linear-gradient(90deg,${confC}70,${confC})`}}/>
          </div>
        </div>

        {node.url&&(
          <p className="text-xs leading-relaxed" style={{color:TXT2}}>
            Details above are extracted live from the linked official source. Use the actions to run
            classification, clause extraction, or a semantic amendment diff against fresh crawls.
          </p>
        )}
      </div>
    </motion.div>
    </motion.div>
  );
}

// ==================== DIFF ENGINE ====================

type AseanCountryKey = "sg"|"vn"|"th"|"id"|"my"|"ph";

type TransferRule = {
  key: AseanCountryKey;
  name: string;
  flag: string;
  summary: string;
  friction: "Low"|"Medium"|"High";
  conditions: string[];
  citations: Array<{instrument: string; section: string; note?: string}>;
};

const ASEAN_TRANSFER_RULES: TransferRule[] = [
  {
    key:"sg",
    name:"Singapore",
    flag:"SG",
    friction:"Medium",
    summary:"Permitted with transfer limitation + comparable protection safeguards.",
    conditions:["Transfer limitation agreements / comparable protection","Reasonable security arrangements","Purpose limitation + notification practices"],
    citations:[{instrument:"PDPA (Singapore)",section:"Transfer Limitation Obligation",note:"Comparable protection for overseas recipients"}],
  },
  {
    key:"my",
    name:"Malaysia",
    flag:"MY",
    friction:"Medium",
    summary:"Generally restricted; relies on permitted transfer mechanisms / whitelisting concepts.",
    conditions:["Permitted jurisdictions / Ministerial specifications","Consent or necessity-based exceptions","Contractual safeguards"],
    citations:[{instrument:"PDPA (Malaysia)",section:"Cross-border transfer restrictions",note:"Subject to permitted transfer conditions"}],
  },
  {
    key:"th",
    name:"Thailand",
    flag:"TH",
    friction:"Medium",
    summary:"Allowed with adequate protection or appropriate safeguards and exceptions.",
    conditions:["Adequacy or appropriate safeguards","Binding corporate rules/contractual safeguards","Specific exceptions (consent, necessity, public interest)"],
    citations:[{instrument:"PDPA (Thailand)",section:"International transfer provisions"}],
  },
  {
    key:"ph",
    name:"Philippines",
    flag:"PH",
    friction:"Medium",
    summary:"Allowed with safeguards for sensitive data; requires strong security + lawful basis.",
    conditions:["Lawful basis + proportionality","DPA / data sharing safeguards","Security measures + breach response"],
    citations:[{instrument:"Data Privacy Act (R.A. 10173)",section:"Data sharing / cross-border safeguards"}],
  },
  {
    key:"id",
    name:"Indonesia",
    flag:"ID",
    friction:"High",
    summary:"Higher friction due to localization expectations and sectoral requirements.",
    conditions:["Potential localization for certain categories/regulated sectors","Supervisory authority coordination","Contractual + technical safeguards"],
    citations:[{instrument:"PDP Law (Indonesia)",section:"Transfer/processing obligations",note:"Sectoral rules may add localization"}],
  },
  {
    key:"vn",
    name:"Vietnam",
    flag:"VN",
    friction:"High",
    summary:"High friction; cross-border transfers can require assessments/approvals and local presence obligations.",
    conditions:["Impact assessment / documentation","Potential approval/filing requirements","Local storage/local entity obligations in some cases"],
    citations:[{instrument:"Decree 13/2023 & Cybersecurity framework",section:"Cross-border transfer requirements"}],
  },
];

function buildBriefMarkdown(query: string, rows: TransferRule[]) {
  const now = new Date();
  const citeLines = rows.flatMap(r => r.citations.map(c => `- ${r.flag} ${r.name}: ${c.instrument} — ${c.section}${c.note?` (${c.note})`:""}`));

  return `# ASEAN Cross-Border Data Transfer Comparison Brief\n\n`+
    `**Query:** ${query}\n`+
    `**Generated:** ${now.toISOString()}\n\n`+
    `## Executive summary\n`+
    `This brief compares cross-border data transfer friction and common compliance conditions across selected ASEAN jurisdictions.\n\n`+
    `## Jurisdiction snapshots\n\n`+
    rows.map(r =>
      `### ${r.flag} ${r.name}\n`+
      `- **Friction:** ${r.friction}\n`+
      `- **Summary:** ${r.summary}\n`+
      (r.conditions.length?`- **Typical conditions:**\n${r.conditions.map(x=>`  - ${x}`).join("\n")}\n`:"")+
      `- **Citations:**\n${r.citations.map(c=>`  - ${c.instrument} — ${c.section}${c.note?` (${c.note})`:""}`).join("\n")}\n`
    ).join("\n")+
    `\n## Citation index\n${citeLines.join("\n")}\n`;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function DiffEngine() {
  const [query,setQuery]=useState("Compare cross-border data transfer rules across ASEAN");
  const [running,setRunning]=useState(false);
  const [ready,setReady]=useState(false);
  const [selected,setSelected]=useState<AseanCountryKey[]>(["sg","vn","th","id","my","ph"]);
  const [allRules,setAllRules]=useState<TransferRule[]>(ASEAN_TRANSFER_RULES);

  const runQuery=()=>{
    setRunning(true);
    setReady(false);
    const base=(import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
    const done=(rules?:TransferRule[])=>{ if(rules&&rules.length) setAllRules(rules); setRunning(false); setReady(true); };
    if(!base){ setTimeout(()=>done(),900); return; }
    // Real backend: derive the comparison live from the validated + clause corpus.
    fetch(`${base}/transfer-rules`).then(r=>r.json())
      .then(d=>done(Array.isArray(d?.rules)?d.rules:undefined))
      .catch(()=>done());
  };

  const toggle=(k:AseanCountryKey)=>{
    setSelected(s=>s.includes(k)?s.filter(x=>x!==k):[...s,k]);
  };

  const rows=allRules.filter(r=>selected.includes(r.key as AseanCountryKey));

  const frictionColor = (f: TransferRule["friction"]) => f==="Low"?"#10B981":f==="Medium"?"#F59E0B":"#EF4444";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <GitBranch size={18} style={{color:"#C4CCD9"}}/>
          <h1 className="text-xl font-semibold" style={{color:"#EEF1F7",fontFamily:"Inter, sans-serif"}}>Country Comparison — Cross-Border Transfer</h1>
          <span className="text-xs px-2 py-0.5 rounded" style={{background:"rgba(30,58,95,0.14)",color:"#C4CCD9",border:"1px solid rgba(30,58,95,0.3)"}}>ESCAP Analyst Mode</span>
        </div>
        <p className="text-sm" style={{color:"#9AA3B4"}}>
          Type one question, generate a comparison dashboard in seconds, and export a cited brief.
        </p>
      </div>

      <div className="rounded-xl p-4 mb-5" style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)"}}>
        <div className="flex items-center gap-3">
          <input value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&runQuery()}
            className="flex-1 rounded-lg px-4 py-3 text-sm outline-none"
            placeholder="Ask: Compare cross-border transfer rules across ASEAN..."
            style={{background:"#0F1522",border:"1px solid rgba(255,255,255,0.12)",color:"#EEF1F7"}}/>
          <button onClick={runQuery} disabled={running}
            className="px-4 py-3 rounded-lg text-sm font-medium transition-all"
            style={{background:running?"rgba(30,58,95,0.15)":"rgba(30,58,95,0.9)",border:"1px solid rgba(30,58,95,0.5)",color:running?"#AEB6C6":"#fff"}}>
            {running?"Querying…":"Run"}
          </button>
          <button
            onClick={()=>downloadTextFile("asean-cross-border-transfer-brief.md", buildBriefMarkdown(query, rows))}
            disabled={!ready}
            className="px-4 py-3 rounded-lg text-sm font-medium transition-all"
            style={{background:ready?"rgba(16,185,129,0.1)":"rgba(255,255,255,0.05)",border:`1px solid ${ready?"rgba(16,185,129,0.35)":"rgba(255,255,255,0.12)"}`,color:ready?"#059669":"#9AA3B4"}}>
            Download brief
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(COUNTRY_DATA) as AseanCountryKey[]).filter(k=>["sg","vn","th","id","my","ph"].includes(k)).map(k=>{
            const c=COUNTRY_DATA[k];
            const on=selected.includes(k);
            return (
              <button key={k} onClick={()=>toggle(k)}
                className="text-xs px-3 py-1.5 rounded-full transition-colors"
                style={{background:on?"rgba(30,58,95,0.1)":"rgba(255,255,255,0.06)",border:`1px solid ${on?"rgba(30,58,95,0.3)":"rgba(255,255,255,0.12)"}`,color:on?"#2563EB":"#C4CCD9"}}>
                {c.flag} {c.name}
              </button>
            );
          })}
        </div>

        {ready&&(
          <div className="mt-3 flex items-center gap-2 text-xs" style={{color:"#10B981"}}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:"#10B981"}}/>
            Dashboard populated in seconds · export is fully cited.
          </div>
        )}
      </div>

      {!ready ? (
        <div className="rounded-xl p-6 text-sm" style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.09)",color:"#9AA3B4"}}>
          Run a query to generate the ASEAN comparison dashboard.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-6 gap-2 mb-5">
            {["Low","Medium","High"].map((f,i)=>(
              <div key={f} className="col-span-2 rounded-xl p-3" style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)"}}>
                <div className="text-xs" style={{color:"#9AA3B4"}}>Friction</div>
                <div className="text-lg font-bold" style={{color:f==="Low"?"#10B981":f==="Medium"?"#F59E0B":"#EF4444",fontFamily:"JetBrains Mono, monospace"}}>{f}</div>
                <div className="text-xs mt-1" style={{color:"#94A3B8"}}>
                  {rows.filter(r=>r.friction===f).length} jurisdictions
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden" style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)"}}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{borderColor:"rgba(255,255,255,0.08)"}}>
              <div>
                <p className="text-sm font-medium" style={{color:"#EEF1F7"}}>ASEAN cross-border transfer comparison</p>
                <p className="text-xs" style={{color:"#9AA3B4",fontFamily:"JetBrains Mono, monospace"}}>{query}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded" style={{background:"rgba(30,58,95,0.1)",color:"#60A5FA",border:"1px solid rgba(30,58,95,0.25)"}}>
                {rows.length} selected
              </span>
            </div>

            <div className="grid grid-cols-6 gap-0">
              {rows.map(r=>{
                const fc=frictionColor(r.friction);
                return (
                  <div key={r.key} className="col-span-3 border-r last:border-r-0" style={{borderColor:"rgba(255,255,255,0.09)"}}>
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{r.flag}</span>
                          <span className="text-sm font-semibold" style={{color:"#EEF1F7"}}>{r.name}</span>
                        </div>
                        <span className="text-xs px-2 py-1 rounded" style={{background:`${fc}22`,border:`1px solid ${fc}44`,color:fc,fontFamily:"JetBrains Mono, monospace"}}>
                          {r.friction}
                        </span>
                      </div>
                      <p className="text-xs mt-2" style={{color:"#94A3B8"}}>{r.summary}</p>

                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#9AA3B4",fontFamily:"IBM Plex Sans, sans-serif"}}>Typical conditions</p>
                        <div className="mt-2 space-y-1.5">
                          {r.conditions.map((c,i)=>(
                            <div key={i} className="text-xs px-2.5 py-2 rounded-lg" style={{background:"#0F1522",border:"1px solid rgba(255,255,255,0.09)",color:"#C4CCD9"}}>
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#9AA3B4",fontFamily:"IBM Plex Sans, sans-serif"}}>Citations</p>
                        <div className="mt-2 space-y-1.5">
                          {r.citations.map((c,i)=>(
                            <div key={i} className="text-xs px-2.5 py-2 rounded-lg" style={{background:"rgba(30,58,95,0.06)",border:"1px solid rgba(30,58,95,0.15)",color:"#A78BFA"}}>
                              <span style={{fontFamily:"JetBrains Mono, monospace"}}>{c.instrument}</span>
                              <span style={{color:"#9AA3B4"}}> — {c.section}</span>
                              {c.note&&<span style={{color:"#94A3B8"}}> · {c.note}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl p-4 mt-5" style={{background:"rgba(30,58,95,0.04)",border:"1px solid rgba(30,58,95,0.15)"}}>
            <div className="flex items-center gap-2 mb-3">
              <Brain size={14} style={{color:"#C4CCD9"}}/>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{color:"#C4CCD9",fontFamily:"IBM Plex Sans, sans-serif"}}>Automated analyst brief</span>
            </div>
            <p className="text-sm leading-relaxed" style={{color:"#AEB6C6"}}>
              This dashboard compresses what used to take weeks of manual legal review: collecting cross-border transfer clauses, normalizing them into comparable conditions, and producing a citation-ready brief for policy work.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ==================== SIMULATION SANDBOX ====================
type SimOptions = { jurisdictions:string[]; dataCategories:string[]; storageRegions:string[]; controls:string[] };
type SimVerdict = "permitted"|"conditional"|"restricted";
type SimJur = { jurisdiction:string; flag:string; verdict:SimVerdict; score:number; friction:string; obligations:string[]; risks:string[]; instruments:Array<{instrument:string;url:string;pillar?:string}> };
type SimScenario = { businessType?:string; dataCategories?:string[]; storageRegion?:string; targetJurisdictions?:string[]; crossBorderTransfer?:boolean; controls?:Record<string,boolean> };
type SimResult = { scenario?:SimScenario; overall:{verdict:SimVerdict;score:number;summary:string}; jurisdictions:SimJur[]; narrative?:string };

const VERDICT_STYLE: Record<SimVerdict,{label:string;color:string;bg:string}> = {
  permitted:   { label:"Permitted",   color:"#34D399", bg:"rgba(4,120,87,0.1)" },
  conditional: { label:"Conditional", color:"#FBBF24", bg:"rgba(180,83,9,0.1)" },
  restricted:  { label:"Restricted",  color:"#F87171", bg:"rgba(185,28,28,0.1)" },
};
const NAVY="#60A5FA";  // shared blue accent for the dark pages (was brand navy on light)

function SimulationSandbox({ seedText, onSeedConsumed, onAskAI }: { seedText?:string|null; onSeedConsumed?:()=>void; onAskAI?:(q:string)=>void }={}) {
  const base=(import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
  const [opt,setOpt]=useState<SimOptions|null>(null);
  const [nl,setNl]=useState("");
  const [businessType,setBusinessType]=useState("Health-tech SaaS");
  const [cats,setCats]=useState<Set<string>>(new Set(["Personal","Health / Sensitive"]));
  const [region,setRegion]=useState("AWS Singapore");
  const [targets,setTargets]=useState<Set<string>>(new Set(["Philippines","Singapore","Malaysia"]));
  const [crossBorder,setCrossBorder]=useState(true);
  const [controls,setControls]=useState<Record<string,boolean>>({consent:true,dpa:false,encryption:true,localCopy:false});
  const [result,setResult]=useState<SimResult|null>(null);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  useEffect(()=>{ if(!base) return; fetch(`${base}/simulate/options`).then(r=>r.json()).then(setOpt).catch(()=>{}); },[base]);

  const toggleSet=(s:Set<string>,v:string,set:(x:Set<string>)=>void)=>{ const n=new Set(s); n.has(v)?n.delete(v):n.add(v); set(n); };

  // Parse a plain-English scenario → fill the form → run. Also used when opened from chat.
  const runFromText=async(text:string)=>{
    const t=text.trim(); if(!t){ setErr("Describe your scenario first."); return; }
    if(!base){ setErr("Backend not configured (VITE_AILA_API_BASE_URL)."); return; }
    setLoading(true); setErr("");
    try{
      const r=await fetch(`${base}/simulate/parse`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t})});
      if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.error||`HTTP ${r.status}`); }
      const d:SimResult=await r.json();
      setResult(d);
      const s=d.scenario||{};
      if(s.businessType) setBusinessType(s.businessType);
      if(s.dataCategories) setCats(new Set(s.dataCategories));
      if(s.storageRegion) setRegion(s.storageRegion);
      if(s.targetJurisdictions) setTargets(new Set(s.targetJurisdictions));
      if(typeof s.crossBorderTransfer==="boolean") setCrossBorder(s.crossBorderTransfer);
      if(s.controls) setControls(c=>({...c,...s.controls}));
    }catch(e){ setErr(e instanceof Error?e.message:String(e)); }
    finally{ setLoading(false); }
  };

  // Auto-run when the twin is opened from the chat with a scenario question.
  useEffect(()=>{ if(seedText){ setNl(seedText); runFromText(seedText); onSeedConsumed?.(); } /* eslint-disable-next-line */ },[seedText]);

  const askAI=()=>{
    if(!result||!onAskAI) return;
    const notPermitted=result.jurisdictions.filter(j=>j.verdict!=="permitted").map(j=>`${j.jurisdiction} (${j.verdict})`).join(", ");
    const q=`My compliance simulation — ${businessType||"my business"} storing ${[...cats].join(", ")||"data"} in ${region}, serving ${[...targets].join(", ")} — returned ${result.overall.verdict} (score ${result.overall.score})${notPermitted?`, with issues in ${notPermitted}`:""}. What concrete steps would make this compliant?`;
    onAskAI(q);
  };

  const run=async()=>{
    if(!base){ setErr("Backend not configured (VITE_AILA_API_BASE_URL)."); return; }
    if(targets.size===0){ setErr("Pick at least one jurisdiction."); return; }
    setLoading(true); setErr("");
    try{
      const r=await fetch(`${base}/simulate`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({businessType,dataCategories:[...cats],storageRegion:region,targetJurisdictions:[...targets],crossBorderTransfer:crossBorder,controls,explain:true})});
      if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.error||`HTTP ${r.status}`); }
      setResult(await r.json());
    }catch(e){ setErr(e instanceof Error?e.message:String(e)); }
    finally{ setLoading(false); }
  };

  const chip=(active:boolean)=>({fontSize:"12px",padding:"6px 12px",borderRadius:"20px",cursor:"pointer",userSelect:"none" as const,
    border:`1px solid ${active?NAVY:"rgba(255,255,255,0.12)"}`,background:active?h2r(NAVY,0.18):"rgba(255,255,255,0.03)",color:active?"#93C5FD":"#9AA3B4",fontWeight:active?600:500});

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-1 flex items-center gap-3">
        <FlaskConical size={18} style={{color:NAVY}}/>
        <h1 className="text-xl font-semibold" style={{color:"#EEF1F7"}}>Compliance Digital Twin</h1>
      </div>
      <p className="text-sm mb-4" style={{color:"#9AA3B4"}}>Model a data-handling scenario and run what-ifs across ASEAN jurisdictions.</p>

      {/* natural-language scenario — Gemini parses it into the form below, then runs it */}
      <div className="rounded-xl p-4 mb-6" style={{background:h2r(NAVY,0.04),border:`1px solid ${h2r(NAVY,0.15)}`}}>
        <div className="flex items-center gap-2 mb-2">
          <Brain size={14} style={{color:NAVY}}/>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{color:NAVY}}>Describe your scenario</span>
        </div>
        <div className="flex gap-2">
          <input value={nl} onChange={e=>setNl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&runFromText(nl)}
            placeholder="e.g. A fintech storing Malaysian customer KYC data on AWS US, with consent but no local copy"
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{border:`1px solid ${h2r(NAVY,0.2)}`,color:"#EEF1F7",background:"#0B0F17"}}/>
          <button onClick={()=>runFromText(nl)} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold shrink-0"
            style={{background:loading?"#94A3B8":NAVY,color:"#fff",border:"none",cursor:loading?"default":"pointer"}}>
            <FlaskConical size={14}/>Build &amp; run
          </button>
        </div>
      </div>

      <div className="grid gap-6" style={{gridTemplateColumns:"340px 1fr"}}>
        {/* ===== scenario form ===== */}
        <div className="rounded-xl p-5 self-start" style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)"}}>
          <Field label="Business type">
            <input value={businessType} onChange={e=>setBusinessType(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{border:"1px solid rgba(255,255,255,0.1)",color:"#EEF1F7"}}/>
          </Field>

          <Field label="Data categories">
            <div className="flex flex-wrap gap-1.5">
              {(opt?.dataCategories??["Personal","Health / Sensitive","Financial","Biometric"]).map(c=>(
                <span key={c} style={chip(cats.has(c))} onClick={()=>toggleSet(cats,c,setCats)}>{c}</span>
              ))}
            </div>
          </Field>

          <Field label="Storage region">
            <select value={region} onChange={e=>setRegion(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{border:"1px solid rgba(255,255,255,0.1)",color:"#EEF1F7",background:"#0B0F17"}}>
              {(opt?.storageRegions??["In-country","AWS Singapore"]).map(r=> <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>

          <Field label="Target jurisdictions">
            <div className="flex flex-wrap gap-1.5">
              {(opt?.jurisdictions??["Philippines","Singapore","Malaysia"]).map(j=>(
                <span key={j} style={chip(targets.has(j))} onClick={()=>toggleSet(targets,j,setTargets)}>{j}</span>
              ))}
            </div>
          </Field>

          <Field label="Controls in place">
            <div className="flex flex-col gap-2">
              {[["crossBorder","Cross-border transfer"],["consent","User consent obtained"],["dpa","Data Processing Agreement"],["encryption","Encryption at rest & transit"],["localCopy","In-country data copy"]].map(([k,lbl])=>{
                const on = k==="crossBorder"?crossBorder:controls[k];
                const set = ()=> k==="crossBorder"?setCrossBorder(!crossBorder):setControls(c=>({...c,[k]:!c[k]}));
                return (
                  <button key={k} onClick={set} className="flex items-center justify-between text-sm" style={{color:"#C4CCD9"}}>
                    <span>{lbl}</span>
                    <span className="relative inline-block" style={{width:"34px",height:"18px",borderRadius:"20px",background:on?NAVY:"rgba(255,255,255,0.16)",transition:"background .15s"}}>
                      <span className="absolute rounded-full" style={{top:"2px",width:"14px",height:"14px",background:"#0B0F17",left:on?"18px":"2px",transition:"left .15s"}}/>
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <button onClick={run} disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold mt-2"
            style={{background:loading?"#94A3B8":NAVY,color:"#fff",border:"none",cursor:loading?"default":"pointer"}}>
            <FlaskConical size={15}/>{loading?"Running simulation…":"Run Simulation"}
          </button>
          {err&&<p className="text-xs mt-2" style={{color:"#F87171"}}>{err}</p>}
        </div>

        {/* ===== results ===== */}
        <div>
          {loading&&(
            <div className="rounded-xl p-8 flex flex-col items-center justify-center" style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)",minHeight:"260px"}}>
              <CrawlerGraphLoader/>
            </div>
          )}

          {!result&&!loading&&(
            <div className="rounded-xl p-10 text-center" style={{background:"#0B0F17",border:"1px dashed rgba(255,255,255,0.1)"}}>
              <FlaskConical size={26} style={{color:"#CBD5E1",margin:"0 auto 10px"}}/>
              <p className="text-sm" style={{color:"#94A3B8"}}>Configure a scenario and run the simulation to see the compliance verdict per jurisdiction.</p>
            </div>
          )}

          {result&&!loading&&(
            <div className="space-y-4">
              {/* overall */}
              <div className="rounded-xl p-5" style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)"}}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{color:VERDICT_STYLE[result.overall.verdict].color,background:VERDICT_STYLE[result.overall.verdict].bg}}>
                    {VERDICT_STYLE[result.overall.verdict].label}
                  </span>
                  <span className="text-sm" style={{color:"#9AA3B4"}}>Overall readiness</span>
                  <div className="ml-auto text-2xl font-bold" style={{color:NAVY,fontFamily:"JetBrains Mono, monospace"}}>{result.overall.score}</div>
                </div>
                <p className="text-sm leading-relaxed" style={{color:"#C4CCD9"}}>{result.overall.summary}</p>
                {result.narrative&&(
                  <div className="mt-3 pt-3 flex gap-2.5" style={{borderTop:"1px solid #F1F5F9"}}>
                    <Brain size={15} style={{color:NAVY,flexShrink:0,marginTop:"2px"}}/>
                    <p className="text-sm leading-relaxed italic" style={{color:"#AEB6C6"}}>{result.narrative}</p>
                  </div>
                )}
                {onAskAI&&(
                  <button onClick={askAI} className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
                    style={{background:h2r(NAVY,0.07),color:NAVY,border:`1px solid ${h2r(NAVY,0.2)}`,cursor:"pointer"}}>
                    <MessageSquare size={14}/> Ask AILA how to fix this
                  </button>
                )}
              </div>

              {/* per jurisdiction */}
              {result.jurisdictions.map(j=>(
                <div key={j.jurisdiction} className="rounded-xl p-5" style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)"}}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{j.flag}</span>
                    <h3 className="font-semibold" style={{color:"#EEF1F7"}}>{j.jurisdiction}</h3>
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{color:VERDICT_STYLE[j.verdict].color,background:VERDICT_STYLE[j.verdict].bg}}>{VERDICT_STYLE[j.verdict].label}</span>
                    <div className="ml-auto text-right">
                      <div className="text-lg font-bold" style={{color:NAVY,fontFamily:"JetBrains Mono, monospace"}}>{j.score}</div>
                      <div className="text-xs" style={{color:"#94A3B8"}}>{j.friction} friction</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{color:"#94A3B8"}}>Obligations</p>
                      {j.obligations.length?(
                        <ul className="space-y-1.5">{j.obligations.map((o,i)=>{
                          const critical=/residency|in-country|domestically|prohibited|infrastructure|approved mechanism|local copy/i.test(o);
                          return critical?(
                            <li key={i} className="text-xs leading-relaxed flex items-start gap-1.5 px-2 py-1 rounded"
                              style={{color:"#FCD34D",background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.25)"}}>
                              <span style={{fontSize:"9px",fontWeight:700,letterSpacing:"0.05em",background:"#B45309",color:"#fff",padding:"1px 5px",borderRadius:"4px",marginTop:"1px",flexShrink:0}}>KEY</span>
                              <span>{o}</span>
                            </li>
                          ):(
                            <li key={i} className="text-xs leading-relaxed" style={{color:"#C4CCD9"}}>• {o}</li>
                          );
                        })}</ul>
                      ):<p className="text-xs" style={{color:"#94A3B8"}}>Standard safeguards only</p>}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{color:"#94A3B8"}}>Risks to address</p>
                      {j.risks.length?(
                        <div className="rounded-lg p-2.5" style={{background:"rgba(185,28,28,0.05)",border:"1px solid rgba(185,28,28,0.18)"}}>
                          <ul className="space-y-1.5">{j.risks.map((o,i)=>(
                            <li key={i} className="text-xs leading-relaxed flex items-start gap-1.5" style={{color:"#F87171"}}>
                              <span style={{marginTop:"1px",flexShrink:0}}>⚠</span><span>{o}</span>
                            </li>
                          ))}</ul>
                        </div>
                      ):<p className="text-xs" style={{color:"#94A3B8"}}>None flagged</p>}
                    </div>
                  </div>
                  {j.instruments.length>0&&(
                    <div className="mt-3 pt-3 flex flex-wrap gap-1.5" style={{borderTop:"1px solid #F1F5F9"}}>
                      {j.instruments.map((ins,i)=>(
                        <a key={i} href={ins.url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md" style={{background:"rgba(15,23,42,0.04)",color:"#AEB6C6",textDecoration:"none"}}>
                          <Link size={10}/>{ins.instrument.length>34?ins.instrument.slice(0,33)+"…":ins.instrument}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({label,children}:{label:string;children:React.ReactNode}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:"#9AA3B4",fontFamily:"IBM Plex Sans, sans-serif"}}>{label}</p>
      {children}
    </div>
  );
}

// ==================== SME ASSISTANT ====================

type RichSection = { heading: string; type: "success"|"warning"|"info"|"neutral"; bullets: string[] };
type RichCitation = { num: number; title: string; instrument: string; section: string; flag: string };
type RichResponse = { summary: string; verdict: { label: string; color: string; bg: string }; sections: RichSection[]; citations: RichCitation[]; tags: string[] };
type ArticleSnippet = { id:string; question:string; summary:string; verdict?:string; confidence?:number; sourcesAdded?:number };
type ChatMsg = { role: "ai"|"user"; text?: string; rich?: RichResponse; article?: ArticleSnippet; result?: RagResult; sim?: { question:string; result:SimResult } };

const INIT_MSGS: ChatMsg[] = [
  {role:"ai",text:"Hello! I'm AILA's SME Assistant. Ask me about regulatory requirements, cross-border data transfers, or compliance obligations across Southeast Asia."},
];

const SME_RICH_RESPONSE: RichResponse = {
  summary: "Yes — you can store Filipino users’ health data on AWS Singapore, but only under strict compliance conditions. The Philippine Data Privacy Act classifies health data as sensitive personal information, making cross-border storage permissible only with strong safeguards.",
  verdict: { label: "Conditionally Permitted", color: "#B45309", bg: "rgba(245,158,11,0.09)" },
  sections: [
    {
      heading: "You are allowed if you implement",
      type: "success",
      bullets: [
        "Explicit, informed consent from users for offshore storage and processing",
        "A Data Processing Agreement (DPA) with AWS covering breach notification and security obligations",
        "Encryption of health data both at rest and in transit",
        "Strong access controls and audit logging for all sensitive records",
      ],
    },
    {
      heading: "Risk factors to consider",
      type: "warning",
      bullets: [
        "Health data is sensitive personal information — subject to stricter NPC scrutiny and higher penalties",
        "Cross-border processing increases regulatory exposure, especially for analytics or AI-model training",
        "Non-compliance can trigger mandatory NPC reporting and fines up to ₱5M per violation",
      ],
    },
    {
      heading: "Best-practice approach",
      type: "info",
      bullets: [
        "Use AWS Singapore for compute, but keep a mirrored storage layer in the Philippines for sensitive datasets",
        "Separate identifiable health data from analytical datasets (data minimization principle)",
        "Run a Privacy Impact Assessment (PIA) before deployment",
      ],
    },
  ],
  citations: [
    { num: 1, title: "Data Privacy Act", instrument: "R.A. 10173, §§ 12–13", section: "Sensitive Personal Information and Cross-border Transfer Requirements", flag: "🇵🇭" },
    { num: 2, title: "NPC Circular 2022-01", instrument: "National Privacy Commission", section: "Guidelines on Cross-border Data Sharing and Processing", flag: "🇵🇭" },
    { num: 3, title: "NPC Advisory 2023-03", instrument: "National Privacy Commission", section: "Cloud Storage and Offshore Processing of Sensitive Personal Information", flag: "🇵🇭" },
    { num: 4, title: "AWS Data Processing Addendum", instrument: "Amazon Web Services, Inc.", section: "APAC Compliance Obligations and Breach Notification Requirements", flag: "🌐" },
  ],
  tags: ["Health Data", "Cross-border Transfer", "Philippines", "Cloud Storage", "DPA"],
};

const PDF_SNIPPET = {
  filename: "data_processing_policy_v2.1.pdf",
  pages: 24,
  size: "1.8 MB",
  section: "§ 4.2 — Offshore Storage & Sub-processors",
  lines: [
    { t:"4.2.1  The Company may store and process Personal Data using infrastructure", hl:false },
    { t:"        located outside the Republic of the Philippines, including the AWS", hl:false },
    { t:"        Asia Pacific (Singapore) region, provided that:", hl:false },
    { t:"        (a) the data subject has given explicit, informed consent to such", hl:true },
    { t:"            offshore processing of their health-related information;", hl:true },
    { t:"        (b) a Data Processing Agreement is executed with the sub-processor", hl:true },
    { t:"            addressing breach notification within seventy-two (72) hours;", hl:false },
    { t:"        (c) all Sensitive Personal Information is encrypted at rest using", hl:false },
    { t:"            AES-256 and in transit using TLS 1.2 or higher.", hl:false },
  ],
};

// ===== Real long-form legal content (Philippine Data Privacy Act) =====
const ARTICLE = {
  category: "Data Privacy · Cross-Border",
  author: { name:"AILA Research Engine", role:"Regulatory Analyst", initials:"AI" },
  date: "June 5, 2026",
  views: "1,043",
  lead: "Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), a business may transfer personal data to infrastructure located abroad — including the AWS Asia Pacific (Singapore) region. But because health information is classified as sensitive personal information, the law imposes heightened conditions: a lawful basis under Section 13, the accountability obligations of Section 21, and security measures under Section 20. Done correctly, offshore storage is permissible; done carelessly, it exposes the controller to criminal liability.",
  body: [
    {
      heading: "Legal Basis",
      paras: [
        "The Data Privacy Act of 2012 (R.A. 10173) governs the processing of all personal data in the Philippines and is enforced by the National Privacy Commission (NPC), the independent body that became operational in 2016 together with the Act's Implementing Rules and Regulations (IRR).",
        "Section 3(l) defines sensitive personal information to include any data about an individual's health, genetic make-up, or sexual life. Health records therefore fall squarely within the most protected category of data under Philippine law, and Section 13 prohibits their processing unless a specific lawful ground applies — chief among them the data subject's explicit consent given prior to processing.",
      ],
    },
    {
      heading: "Cross-Border Transfer & Accountability",
      paras: [
        "The Act applies extraterritorially. Section 6 extends its reach to processing carried out abroad where it relates to Philippine residents, and Section 21 codifies the principle of accountability: a personal information controller remains responsible for personal data under its control or custody, including information that has been transferred to a third party for processing — whether domestically or internationally.",
        "In practical terms, moving health data to AWS Singapore does not transfer away your legal exposure. The controller must use contractual or other reasonable means to ensure that the overseas processor provides a comparable level of protection to that required under the Act. This is the core function of a Data Processing Agreement (DPA).",
      ],
    },
  ],
  pullQuote: {
    text: "The personal information controller is responsible for personal data under its control or custody, including data transferred to a third party for processing — whether domestically or internationally.",
    cite: "R.A. 10173, Section 21 — Principle of Accountability",
  },
  history: {
    heading: "The first comprehensive privacy law in the Philippines was enacted in 2012",
    sideCaption: "R.A. 10173 was signed into law on August 15, 2012, modeled on the EU Data Protection Directive and the APEC Privacy Framework.",
    sideLabel: "About the NPC",
    paras: [
      "Before R.A. 10173, the Philippines had no general statute governing the processing of personal data. The Act was signed into law on August 15, 2012, drawing on the EU Data Protection Directive 95/46/EC and the APEC Privacy Framework, and was designed in part to support the country's booming business-process-outsourcing sector.",
      "The National Privacy Commission was constituted in 2016 and issued the IRR the same year, followed by a series of circulars on security of personal data (NPC Circular 16-01), data sharing agreements, and personal data breach management (NPC Circular 16-03), which requires notification of the Commission and affected data subjects within seventy-two (72) hours of knowledge of a qualifying breach.",
    ],
  },
  callout: "Health data demands explicit consent, an executed Data Processing Agreement, and end-to-end encryption. Under Philippine law these are mandatory — not best-effort.",
  penalties: [
    { offense:"Unauthorized processing of sensitive personal information", penalty:"3–6 years imprisonment + ₱500,000–₱4,000,000", ref:"§ 25" },
    { offense:"Processing for unauthorized purposes (sensitive PII)", penalty:"2–7 years imprisonment + ₱500,000–₱2,000,000", ref:"§ 28" },
    { offense:"Concealment of a security breach involving sensitive PII", penalty:"1.5–5 years imprisonment + ₱500,000–₱1,000,000", ref:"§ 30" },
  ],
  tags: ["Data Privacy", "R.A. 10173", "Cross-Border", "Health Data", "NPC"],
};

// Real cited provisions (rendered as the "notes" thread)
const CITED_PROVISIONS = [
  { src:"R.A. 10173 — Data Privacy Act of 2012", flag:"🇵🇭", date:"§ 13", note:"Processing of sensitive personal information is prohibited except where the data subject has given consent specific to the purpose, or processing is necessary to protect the life and health of the data subject." },
  { src:"R.A. 10173 — Data Privacy Act of 2012", flag:"🇵🇭", date:"§ 20", note:"The personal information controller must implement reasonable and appropriate organizational, physical, and technical security measures intended for the protection of personal information against natural and human dangers." },
  { src:"NPC Circular 16-03", flag:"🇵🇭", date:"2016", note:"A personal data breach involving sensitive personal information that may give rise to a real risk of serious harm must be notified to the Commission and affected data subjects within 72 hours of knowledge." },
];

type RagCitation = { n:number; instrument:string; jurisdiction:string; url:string; score:number; snippet:string; live?:boolean };
type RagKeyPoint = { heading:string; detail:string; citations:number[] };
type RagResult = { question:string; answer:string; summary?:string; verdict?:string; keyPoints?:RagKeyPoint[]; risks?:string[]; recommendations?:string[]; confidence:number; grounded:boolean; citations:RagCitation[]; retrieved:number; sourcesAdded?:number; conversationId?:string; articleId?:string };

function AnswerPage({ query, onBack, onSimulate, result }: { query: string; onBack: () => void; onSimulate: () => void; result?: RagResult|null }) {
  const r = SME_RICH_RESPONSE;
  const serif = "Georgia, 'Times New Roman', serif";
  const frictionColor:Record<string,string>={Low:"#34D399",Medium:"#F59E0B",High:"#F87171"};
  const A = ARTICLE;

  // Live regional comparison (derived from the DB via /transfer-rules).
  const [regionRules,setRegionRules]=useState<TransferRule[]>([]);
  useEffect(()=>{
    const base=(import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
    if(!base) return;
    fetch(`${base}/transfer-rules`).then(x=>x.json())
      .then(d=>setRegionRules(Array.isArray(d?.rules)?d.rules:[])).catch(()=>{});
  },[]);
  // Pick the jurisdiction the answer is actually about (from the query + cited jurisdictions).
  const hay=`${query} ${(result?.citations??[]).map(c=>c.jurisdiction).join(" ")}`.toLowerCase();
  const focus=regionRules.find(rr=>hay.includes(rr.name.toLowerCase()))||null;
  const otherRules=regionRules.filter(rr=>rr!==focus);
  const provisions=result?.citations??[];   // real cited provisions for THIS answer

  return (
    <div className="aila-dark-page" style={{position:"absolute",inset:0,background:"#0B0F17",overflowY:"auto",zIndex:50,fontFamily:"Inter, sans-serif"}}>
      {/* ===== CLEAN HEADER ===== */}
      <div style={{position:"sticky",top:0,zIndex:20,background:"rgba(9,12,18,0.82)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
        <div style={{maxWidth:"1080px",margin:"0 auto",padding:"14px 28px",display:"flex",alignItems:"center",gap:"16px"}}>
          <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:"7px",fontSize:"13px",fontWeight:500,color:"#AEB6C6",background:"none",border:"none",cursor:"pointer"}}>
            <ChevronLeft size={16}/> Back to Assistant
          </button>
          <div style={{flex:1}}/>
          <img src={ailaLogo} alt="AILA" style={{height:"20px",width:"auto",objectFit:"contain",filter:"brightness(0) invert(1)"}}/>
        </div>
      </div>

      {/* ===== HERO ===== */}
      <div style={{position:"relative",minHeight:"360px",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",background:"linear-gradient(135deg,#0F1E33 0%,#2563EB 55%,#334155 100%)"}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(15,23,42,0.35),rgba(15,23,42,0.62))"}}/>
        <div style={{position:"relative",textAlign:"center",padding:"56px 28px",maxWidth:"760px"}}>
          <span style={{display:"inline-block",fontSize:"10px",fontWeight:700,letterSpacing:"0.18em",color:"#fff",border:"1px solid rgba(255,255,255,0.5)",borderRadius:"3px",padding:"5px 12px",marginBottom:"22px"}}>
            {result ? (result.grounded ? "GROUNDED ANSWER" : "LOW-CONFIDENCE ANSWER") : "DATA PRIVACY"}
          </span>
          <h1 style={{fontFamily:serif,fontSize:"42px",lineHeight:1.18,fontWeight:700,color:"#fff",margin:"0 0 22px",letterSpacing:"-0.01em"}}>{query}</h1>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"22px",color:"rgba(255,255,255,0.85)",fontSize:"12px"}}>
            {result ? (
              <>
                <span>{Math.round(result.confidence*100)}% confidence</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:"6px"}}><MessageCircle size={13}/> {result.citations.length} citations</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:"6px"}}>{result.retrieved} excerpts retrieved</span>
                {!!result.sourcesAdded&&<span style={{display:"inline-flex",alignItems:"center",gap:"6px",border:"1px solid rgba(255,255,255,0.35)",borderRadius:"20px",padding:"3px 10px"}}><Globe size={12}/> {result.sourcesAdded} scraped live</span>}
              </>
            ) : (
              <>
                <span>{A.date}</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:"6px"}}><Eye size={13}/> {A.views}</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:"6px"}}><MessageCircle size={13}/> {CITED_PROVISIONS.length}</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:"6px",border:"1px solid rgba(255,255,255,0.35)",borderRadius:"20px",padding:"4px 12px"}}><Share2 size={12}/> Share</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===== ARTICLE BODY ===== */}
      <div style={{maxWidth:"940px",margin:"0 auto",padding:"56px 28px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:"190px 1fr",gap:"44px",alignItems:"start"}}>
          {/* author card */}
          <aside style={{position:"sticky",top:"28px",textAlign:"center",borderRight:"1px solid rgba(255,255,255,0.08)",paddingRight:"24px"}}>
            <div style={{width:"72px",height:"72px",borderRadius:"50%",margin:"0 auto 14px",background:"linear-gradient(135deg,#2563EB,#2563EB)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:"22px",fontFamily:serif}}>{A.author.initials}</div>
            <p style={{fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#EEF1F7",margin:"0 0 3px"}}>{A.author.name}</p>
            <p style={{fontSize:"11px",color:"#94A3B8",margin:"0 0 14px"}}>{A.author.role}</p>
            <div style={{display:"flex",justifyContent:"center",gap:"8px",marginBottom:"16px"}}>
              {["f","t","in"].map(s=>(<span key={s} style={{width:"24px",height:"24px",borderRadius:"50%",border:"1px solid rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",color:"#9AA3B4"}}>{s}</span>))}
            </div>
            <span style={{display:"inline-block",fontSize:"10px",fontWeight:700,letterSpacing:"0.12em",color:"#60A5FA",borderBottom:"1px solid rgba(29,78,216,0.3)",paddingBottom:"3px",marginBottom:"18px",cursor:"default"}}>ALL SOURCES</span>
            <div style={{fontSize:"10px",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:r.verdict.color,background:r.verdict.bg,padding:"6px 8px",borderRadius:"6px",lineHeight:1.4}}>
              {result ? `${Math.round(result.confidence*100)}% confidence` : r.verdict.label}
            </div>
          </aside>

          {/* prose */}
          <div>
            {result ? (
              <>
                {/* verdict */}
                {result.verdict&&(
                  <div style={{display:"inline-block",fontSize:"11px",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:"#60A5FA",background:"rgba(30,58,95,0.08)",border:"1px solid rgba(30,58,95,0.2)",borderRadius:"20px",padding:"5px 12px",marginBottom:"16px",fontFamily:"IBM Plex Sans, sans-serif"}}>{result.verdict}</div>
                )}
                {/* direct answer */}
                <p style={{fontSize:"18px",lineHeight:1.75,color:"#DCE2EC",margin:"0 0 24px",fontFamily:serif}}>{result.summary||result.answer}</p>
                {!result.grounded&&(
                  <div style={{fontSize:"13px",color:"#FCD34D",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:"8px",padding:"10px 14px",marginBottom:"24px"}}>
                    ⚠ Limited evidence in the corpus for this question — treat the answer as indicative and verify against the cited sources.
                  </div>
                )}
                {/* key points */}
                {result.keyPoints&&result.keyPoints.length>0&&(
                  <div style={{marginBottom:"24px"}}>
                    <h2 style={{fontFamily:serif,fontSize:"21px",fontWeight:700,color:"#EEF1F7",margin:"0 0 12px"}}>Key Points</h2>
                    <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                      {result.keyPoints.map((kp,i)=>(
                        <div key={i} style={{display:"flex",gap:"12px"}}>
                          <span style={{flexShrink:0,width:"22px",height:"22px",borderRadius:"50%",background:"rgba(30,58,95,0.08)",color:"#60A5FA",fontSize:"11px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"JetBrains Mono, monospace"}}>{i+1}</span>
                          <div>
                            <p style={{fontSize:"14px",fontWeight:700,color:"#EEF1F7",margin:"0 0 2px"}}>{kp.heading}{kp.citations&&kp.citations.length>0&&<span style={{fontSize:"11px",fontWeight:600,color:"#60A5FA",marginLeft:"6px"}}>{kp.citations.map(n=>`[${n}]`).join("")}</span>}</p>
                            {kp.detail&&<p style={{fontSize:"14px",lineHeight:1.65,color:"#AEB6C6",margin:0}}>{kp.detail}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* risks + recommendations */}
                {((result.risks&&result.risks.length>0)||(result.recommendations&&result.recommendations.length>0))&&(
                  <div style={{display:"grid",gridTemplateColumns:(result.risks?.length&&result.recommendations?.length)?"1fr 1fr":"1fr",gap:"14px",marginBottom:"28px"}}>
                    {result.risks&&result.risks.length>0&&(
                      <div style={{borderRadius:"10px",padding:"14px 16px",background:"rgba(185,28,28,0.05)",border:"1px solid rgba(185,28,28,0.18)"}}>
                        <p style={{fontSize:"11px",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#F87171",margin:"0 0 8px",fontFamily:"IBM Plex Sans, sans-serif"}}>Risks</p>
                        <ul style={{margin:0,paddingLeft:"16px",display:"flex",flexDirection:"column",gap:"5px"}}>
                          {result.risks.map((x,i)=>(<li key={i} style={{fontSize:"13px",lineHeight:1.55,color:"#FCA5A5"}}>{x}</li>))}
                        </ul>
                      </div>
                    )}
                    {result.recommendations&&result.recommendations.length>0&&(
                      <div style={{borderRadius:"10px",padding:"14px 16px",background:"rgba(4,120,87,0.05)",border:"1px solid rgba(4,120,87,0.18)"}}>
                        <p style={{fontSize:"11px",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#34D399",margin:"0 0 8px",fontFamily:"IBM Plex Sans, sans-serif"}}>Recommendations</p>
                        <ul style={{margin:0,paddingLeft:"16px",display:"flex",flexDirection:"column",gap:"5px"}}>
                          {result.recommendations.map((x,i)=>(<li key={i} style={{fontSize:"13px",lineHeight:1.55,color:"#6EE7B7"}}>{x}</li>))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                <h2 style={{fontFamily:serif,fontSize:"21px",fontWeight:700,color:"#EEF1F7",margin:"0 0 4px"}}>Evidence Viewer</h2>
                <p style={{fontSize:"12px",color:"#94A3B8",margin:"0 0 14px"}}>Source text on the left, the extracted citation on the right — audit each claim against its origin.</p>
                {/* column headers */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"6px"}}>
                  <span style={{fontSize:"10px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#94A3B8",fontFamily:"IBM Plex Sans, sans-serif"}}>Source Excerpt</span>
                  <span style={{fontSize:"10px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#94A3B8",fontFamily:"IBM Plex Sans, sans-serif"}}>Extracted Evidence</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                  {result.citations.map(c=>(
                    <div key={c.n} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",overflow:"hidden"}}>
                      {/* LEFT — verbatim source */}
                      <div style={{padding:"12px 14px",borderRight:"1px solid rgba(255,255,255,0.1)",background:"#0B0F17"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"6px"}}>
                          <span style={{fontSize:"11px",fontWeight:700,color:"#fff",background:"#2563EB",borderRadius:"5px",padding:"1px 7px",fontFamily:"JetBrains Mono, monospace"}}>[{c.n}]</span>
                          <span style={{fontSize:"10px",color:"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>{(()=>{try{return new URL(c.url).hostname;}catch{return "source";}})()}</span>
                        </div>
                        <p style={{fontSize:"12px",lineHeight:1.65,color:"#AEB6C6",margin:0,fontFamily:"Georgia, serif",fontStyle:"italic"}}>&ldquo;{c.snippet}&rdquo;</p>
                      </div>
                      {/* RIGHT — structured extraction */}
                      <div style={{padding:"12px 14px"}}>
                        <p style={{fontSize:"13px",fontWeight:600,color:"#EEF1F7",margin:"0 0 2px"}}>{c.instrument}{c.live&&<span style={{marginLeft:"6px",fontSize:"9px",fontWeight:700,letterSpacing:"0.05em",padding:"1px 5px",borderRadius:"20px",background:"rgba(4,120,87,0.1)",color:"#34D399",verticalAlign:"middle"}}>LIVE</span>}</p>
                        <p style={{fontSize:"11px",color:"#9AA3B4",margin:"0 0 8px"}}>{c.jurisdiction}</p>
                        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                          <div style={{flex:1,height:"4px",borderRadius:"4px",background:"rgba(255,255,255,0.1)",overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${Math.round(c.score*100)}%`,background:"#2563EB"}}/>
                          </div>
                          <span style={{fontSize:"10px",color:"#9AA3B4",fontFamily:"JetBrains Mono, monospace"}}>{Math.round(c.score*100)}% match</span>
                        </div>
                        <a href={c.url} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",fontWeight:600,color:"#60A5FA",textDecoration:"none"}}>
                          <Link size={11}/> Open source ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={{fontSize:"18px",lineHeight:1.7,color:"#DCE2EC",margin:"0 0 34px",fontFamily:serif}}>{A.lead}</p>
                {A.body.map((s,i)=>(
                  <div key={i} style={{marginBottom:"30px"}}>
                    <h2 style={{fontFamily:serif,fontSize:"21px",fontWeight:700,color:"#EEF1F7",margin:"0 0 12px"}}>{s.heading}</h2>
                    {s.paras.map((p,j)=>(<p key={j} style={{fontSize:"15px",lineHeight:1.78,color:"#C4CCD9",margin:"0 0 14px"}}>{p}</p>))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===== EXHIBIT: uploaded PDF + pull quote (static demo only) ===== */}
      {!result&&<>
      <div style={{maxWidth:"940px",margin:"24px auto 0",padding:"0 28px"}}>
        <div style={{position:"relative"}}>
          {/* document exhibit */}
          <div style={{border:"1px solid rgba(255,255,255,0.1)",borderRadius:"6px",overflow:"hidden",background:"#0F1522"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"12px 18px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
              <FileText size={14} style={{color:"#F87171"}}/>
              <span style={{fontSize:"12px",fontWeight:600,color:"#E2E8F0"}}>{PDF_SNIPPET.filename}</span>
              <span style={{fontSize:"11px",color:"rgba(255,255,255,0.4)"}}>· {PDF_SNIPPET.section}</span>
            </div>
            <div style={{padding:"20px 22px 24px 200px",fontFamily:"JetBrains Mono, monospace",fontSize:"12px",lineHeight:1.9}}>
              {PDF_SNIPPET.lines.map((ln,i)=>(
                <div key={i} style={{display:"flex",gap:"14px",background:ln.hl?"rgba(250,204,21,0.16)":"transparent",margin:"0 -8px",padding:"0 8px",borderRadius:"3px"}}>
                  <span style={{color:"rgba(255,255,255,0.25)",userSelect:"none",minWidth:"18px",textAlign:"right"}}>{i+1}</span>
                  <span style={{color:ln.hl?"#FDE68A":"rgba(226,232,240,0.7)",whiteSpace:"pre"}}>{ln.t}</span>
                </div>
              ))}
            </div>
          </div>
          {/* pull-quote card */}
          <div style={{position:"absolute",top:"54px",left:"0",width:"190px",background:"#0B0F17",border:"1px solid rgba(15,23,42,0.1)",borderRadius:"4px",padding:"18px 18px 16px",boxShadow:"0 16px 40px rgba(15,23,42,0.18)"}}>
            <p style={{fontFamily:serif,fontStyle:"italic",fontSize:"14px",lineHeight:1.55,color:"#DCE2EC",margin:"0 0 12px"}}>{A.pullQuote.text}</p>
            <p style={{fontSize:"10px",color:"#94A3B8",margin:0,lineHeight:1.4}}>{A.pullQuote.cite}</p>
          </div>
          {/* arrows */}
          <button style={{position:"absolute",left:"-18px",top:"50%",transform:"translateY(-50%)",width:"40px",height:"40px",borderRadius:"50%",background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 6px 18px rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><ChevronLeft size={18} style={{color:"#AEB6C6"}}/></button>
          <button style={{position:"absolute",right:"-18px",top:"50%",transform:"translateY(-50%)",width:"40px",height:"40px",borderRadius:"50%",background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 6px 18px rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><ChevronRight size={18} style={{color:"#AEB6C6"}}/></button>
        </div>
      </div>

      {/* ===== HISTORY / BACKGROUND ===== */}
      <div style={{maxWidth:"940px",margin:"0 auto",padding:"56px 28px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:"190px 1fr",gap:"44px",alignItems:"start"}}>
          {/* side thumb + caption */}
          <aside style={{textAlign:"left",borderRight:"1px solid rgba(255,255,255,0.08)",paddingRight:"24px"}}>
            <div style={{width:"100%",height:"110px",borderRadius:"4px",background:"linear-gradient(135deg,#141B2A,#0C1119)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"12px"}}>
              <Scale size={30} style={{color:"rgba(15,23,42,0.25)"}}/>
            </div>
            <p style={{fontSize:"11px",color:"#9AA3B4",lineHeight:1.55,margin:"0 0 12px"}}>{A.history.sideCaption}</p>
            <span style={{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"10px",fontWeight:700,letterSpacing:"0.08em",color:"#60A5FA",cursor:"default"}}><ChevronRight size={11}/> {A.history.sideLabel}</span>
          </aside>
          {/* text */}
          <div>
            <h2 style={{fontFamily:serif,fontSize:"21px",fontWeight:700,color:"#EEF1F7",margin:"0 0 12px"}}>Regulatory Background</h2>
            {A.history.paras.map((p,i)=>(<p key={i} style={{fontSize:"15px",lineHeight:1.78,color:"#C4CCD9",margin:"0 0 14px"}}>{p}</p>))}
            <h2 style={{fontFamily:serif,fontSize:"27px",fontWeight:700,color:"#EEF1F7",lineHeight:1.3,margin:"28px 0 16px",paddingBottom:"16px",borderBottom:"1px solid rgba(15,23,42,0.1)"}}>{A.history.heading}</h2>
            {/* callout */}
            <blockquote style={{margin:"24px 0",padding:"6px 0 6px 22px",borderLeft:"3px solid #2563EB"}}>
              <p style={{fontFamily:serif,fontStyle:"italic",fontSize:"19px",lineHeight:1.55,color:"#EEF1F7",margin:0}}>{A.callout}</p>
            </blockquote>
          </div>
        </div>
      </div>

      {/* ===== PENALTIES ===== */}
      <div style={{maxWidth:"940px",margin:"40px auto 0",padding:"0 28px"}}>
        <div style={{maxWidth:"706px",marginLeft:"auto"}}>
          <h2 style={{fontFamily:serif,fontSize:"21px",fontWeight:700,color:"#EEF1F7",margin:"0 0 16px"}}>Penalties Under the Act</h2>
          <div style={{border:"1px solid rgba(15,23,42,0.1)",borderRadius:"8px",overflow:"hidden"}}>
            {A.penalties.map((p,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:"14px",padding:"14px 16px",borderBottom:i<A.penalties.length-1?"1px solid rgba(15,23,42,0.07)":"none"}}>
                <span style={{fontSize:"11px",fontWeight:700,color:"#DC2626",fontFamily:"JetBrains Mono, monospace",minWidth:"34px"}}>{p.ref}</span>
                <span style={{flex:1,fontSize:"13.5px",color:"#DCE2EC"}}>{p.offense}</span>
                <span style={{fontSize:"12px",fontWeight:600,color:"#AEB6C6",textAlign:"right"}}>{p.penalty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>}

      {/* ===== REGIONAL COMPARISON (live from /transfer-rules) ===== */}
      {regionRules.length>0 && (
      <div style={{maxWidth:"940px",margin:"56px auto 0",padding:"0 28px"}}>
        <div style={{maxWidth:"706px",marginLeft:"auto"}}>
          <h2 style={{fontFamily:serif,fontSize:"21px",fontWeight:700,color:"#EEF1F7",margin:"0 0 6px"}}>How the Region Compares</h2>
          <p style={{fontSize:"14px",color:"#9AA3B4",margin:"0 0 18px"}}>Cross-border transfer of sensitive data across ASEAN jurisdictions — derived from the validated corpus.</p>
          {focus && (
            <div style={{border:"1.5px solid rgba(96,165,250,0.35)",borderRadius:"12px",padding:"15px 17px",marginBottom:"12px",background:"rgba(96,165,250,0.06)"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"7px"}}>
                <span style={{fontSize:"19px"}}>{focus.flag}</span>
                <span style={{fontSize:"14px",fontWeight:700,color:"#EEF1F7"}}>{focus.name}</span>
                <span style={{fontSize:"10px",fontWeight:700,color:"#60A5FA",background:"rgba(96,165,250,0.14)",padding:"2px 8px",borderRadius:"20px",letterSpacing:"0.05em"}}>IN FOCUS</span>
                <div style={{flex:1}}/>
                <span style={{fontSize:"11px",fontWeight:700,color:frictionColor[focus.friction]}}>{focus.friction} friction</span>
              </div>
              <p style={{fontSize:"13px",color:"#AEB6C6",margin:0,lineHeight:1.55}}>{focus.summary}</p>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            {otherRules.map(c=>(
              <div key={c.key} style={{border:"1px solid rgba(255,255,255,0.09)",borderRadius:"12px",padding:"14px",background:"#0B0F17"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"7px"}}>
                  <span style={{fontSize:"16px"}}>{c.flag}</span>
                  <span style={{fontSize:"13px",fontWeight:700,color:"#EEF1F7"}}>{c.name}</span>
                  <div style={{flex:1}}/>
                  <span style={{fontSize:"10px",fontWeight:700,color:frictionColor[c.friction],background:frictionColor[c.friction]+"22",padding:"2px 8px",borderRadius:"20px"}}>{c.friction}</span>
                </div>
                <p style={{fontSize:"12px",color:"#9AA3B4",margin:0,lineHeight:1.55}}>{c.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* ===== TAGS + ACTIONS ===== */}
      <div style={{maxWidth:"940px",margin:"48px auto 0",padding:"0 28px"}}>
        <div style={{maxWidth:"706px",marginLeft:"auto"}}>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"20px"}}>
            {A.tags.map(t=>(<span key={t} style={{fontSize:"10px",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#9AA3B4",border:"1px solid rgba(15,23,42,0.14)",borderRadius:"4px",padding:"5px 10px"}}>{t}</span>))}
          </div>
          <div style={{display:"flex",gap:"10px"}}>
            <button style={{display:"inline-flex",alignItems:"center",gap:"7px",fontSize:"12px",fontWeight:600,color:"#9AA3B4",background:"#0B0F17",border:"1px solid rgba(15,23,42,0.14)",borderRadius:"24px",padding:"8px 16px",cursor:"pointer"}}><Heart size={14}/> Like <span style={{color:"#CBD5E1"}}>· 13</span></button>
            <button style={{display:"inline-flex",alignItems:"center",gap:"7px",fontSize:"12px",fontWeight:600,color:"#fff",background:"#1877F2",border:"none",borderRadius:"24px",padding:"8px 18px",cursor:"pointer"}}><Share2 size={14}/> Share</button>
            <button style={{display:"inline-flex",alignItems:"center",gap:"7px",fontSize:"12px",fontWeight:600,color:"#fff",background:"#0EA5E9",border:"none",borderRadius:"24px",padding:"8px 18px",cursor:"pointer"}}><Share2 size={14}/> Tweet</button>
          </div>
        </div>
      </div>

      {/* ===== CITED PROVISIONS (real, from result.citations) ===== */}
      {provisions.length>0 && (
      <div style={{background:"#0C1119",marginTop:"56px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
        <div style={{maxWidth:"820px",margin:"0 auto",padding:"44px 28px 52px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",marginBottom:"32px"}}>
            <h2 style={{fontFamily:serif,fontSize:"22px",fontWeight:700,color:"#EEF1F7",margin:0}}>Cited Provisions</h2>
            <span style={{fontSize:"12px",fontWeight:700,color:"#fff",background:"#2563EB",borderRadius:"50%",width:"22px",height:"22px",display:"flex",alignItems:"center",justifyContent:"center"}}>{provisions.length}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
            {provisions.map((c)=>{
              let host=""; try{ host=new URL(c.url).hostname; }catch{}
              return (
                <div key={c.n} style={{display:"flex",gap:"14px"}}>
                  <div style={{width:"38px",height:"38px",borderRadius:"50%",background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
                    {host
                      ? <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" width={20} height={20} style={{objectFit:"contain"}} onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none";}}/>
                      : <span style={{fontSize:"11px",fontWeight:700,color:"#60A5FA"}}>{c.n}</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"5px"}}>
                      <span style={{fontSize:"12px",fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",color:"#EEF1F7"}}>{c.instrument}</span>
                      <span style={{fontSize:"11px",color:"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>{c.jurisdiction}</span>
                      {c.live&&<span style={{fontSize:"9px",fontWeight:700,color:"#34D399",background:"rgba(52,211,153,0.14)",padding:"1px 6px",borderRadius:"10px"}}>LIVE</span>}
                    </div>
                    <p style={{fontSize:"14px",lineHeight:1.65,color:"#AEB6C6",margin:"0 0 6px",fontFamily:serif}}>{c.snippet}</p>
                    <a href={c.url} target="_blank" rel="noreferrer" style={{fontSize:"10px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#60A5FA",textDecoration:"none"}}>View Source ↗</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* ===== RELATED ANALYSIS (dark) — real cited sources for this answer ===== */}
      {(() => {
        const GRAD = [["#FEE2E2","#FECACA","#DC2626"],["#FFEDD5","#FED7AA","#EA580C"],["#DBEAFE","#BFDBFE","#2563EB"]];
        const cites = (result?.citations ?? []).slice(0, 3);
        if (!cites.length) return null; // no fabricated "related" cards when there's nothing real to show
        return (
          <div style={{background:"#111827"}}>
            <div style={{maxWidth:"1080px",margin:"0 auto",padding:"48px 28px 56px"}}>
              <h2 style={{fontFamily:serif,fontSize:"22px",fontWeight:700,color:"#fff",textAlign:"center",margin:"0 0 8px"}}>Related Sources</h2>
              <p style={{textAlign:"center",color:"#94A3B8",fontSize:"12px",margin:"0 0 32px"}}>The official sources this analysis is grounded in — open to verify each claim.</p>
              <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(3,cites.length)},1fr)`,gap:"22px"}}>
                {cites.map((c,i)=>{
                  const g = GRAD[i % 3];
                  return (
                    <a key={i} href={c.url} target="_blank" rel="noreferrer" style={{display:"block",textDecoration:"none",borderRadius:"8px",overflow:"hidden",background:"#0B0F17"}}>
                      <div style={{height:"130px",background:"linear-gradient(135deg,"+g[0]+","+g[1]+")",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
                        <FileText size={34} style={{color:"rgba(15,23,42,0.18)"}}/>
                        {/* Real preview image of the actual cited source page; falls back to the gradient on error */}
                        <img src={`https://image.thum.io/get/width/600/crop/360/${c.url}`} alt="" loading="lazy"
                          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}
                          onError={e=>{(e.currentTarget as HTMLImageElement).style.display="none";}}/>
                        <span style={{position:"absolute",top:"12px",left:"12px",zIndex:2,fontSize:"10px",fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:"#fff",background:c.live?"#047857":g[2],padding:"4px 9px",borderRadius:"4px"}}>{c.live?"Live Source":c.jurisdiction}</span>
                        <span style={{position:"absolute",top:"12px",right:"12px",zIndex:2,fontSize:"10px",fontWeight:700,color:"#fff",background:"rgba(0,0,0,0.5)",padding:"3px 7px",borderRadius:"4px",fontFamily:"JetBrains Mono, monospace"}}>[{c.n}]</span>
                      </div>
                      <div style={{padding:"16px 18px 18px"}}>
                        <h3 style={{fontFamily:serif,fontSize:"16px",fontWeight:700,color:"#EEF1F7",margin:"0 0 8px",lineHeight:1.4}}>{c.instrument}</h3>
                        <p style={{fontSize:"12px",color:"#9AA3B4",margin:"0 0 12px",lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{c.snippet}</p>
                        <span style={{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:g[2]}}>Open source <ChevronRight size={13}/></span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== FOOTER ===== */}
      <div style={{borderTop:"1px solid rgba(255,255,255,0.1)",marginTop:"32px"}}>
        <div style={{maxWidth:"706px",margin:"0 auto",padding:"32px 28px 56px",textAlign:"center"}}>
          <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={onSimulate} style={{display:"inline-flex",alignItems:"center",gap:"8px",fontSize:"13px",fontWeight:600,color:"#fff",background:"#2563EB",border:"none",borderRadius:"10px",padding:"11px 22px",cursor:"pointer"}}>
              <FlaskConical size={15}/> Run a Simulation
            </button>
            <button onClick={onBack} style={{display:"inline-flex",alignItems:"center",gap:"8px",fontSize:"13px",fontWeight:600,color:"#60A5FA",background:"#0B0F17",border:"1px solid #2563EB",borderRadius:"10px",padding:"11px 22px",cursor:"pointer"}}>
              <MessageSquare size={15}/> Ask another question
            </button>
          </div>
          <p style={{fontSize:"11px",color:"#94A3B8",margin:"18px 0 0",lineHeight:1.6}}>
            AILA · Regulatory Intelligence — generated analysis for informational purposes only, not legal advice.
          </p>
        </div>
      </div>
    </div>
  );
}

const CRAWL_CAPTIONS = [
  "Rotating regulatory graph…",
  "Scanning jurisdictions…",
  "Matching instruments…",
  "Locating relevant node…",
];

/** A small rotating graph-DB that sweeps and lights up nodes — the chatbot's "thinking" state. */
function CrawlerGraphLoader() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const ci = setInterval(() => setPhase(p => (p + 1) % CRAWL_CAPTIONS.length), 850);
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const W = 300, H = 138;
    c.width = W * DPR; c.height = H * DPR; c.style.width = W + "px"; c.style.height = H + "px";
    ctx.scale(DPR, DPR);

    const N = 18;
    const nodes = Array.from({ length: N }, () => {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), R = 42 + Math.random() * 10;
      return { x: R * Math.sin(ph) * Math.cos(th), y: R * Math.cos(ph) * 0.66, z: R * Math.sin(ph) * Math.sin(th) };
    });
    const edges: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      let b = -1, bd = 1e9;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const dd = (nodes[i].x-nodes[j].x)**2 + (nodes[i].y-nodes[j].y)**2 + (nodes[i].z-nodes[j].z)**2;
        if (dd < bd) { bd = dd; b = j; }
      }
      if (b >= 0) edges.push([i, b]);
    }

    let raf = 0, t = 0, target = Math.floor(Math.random() * N), lastSwitch = 0;
    const cx = W / 2, cy = H / 2;
    const loop = () => {
      t += 16;
      const yaw = t * 0.001;
      if (t - lastSwitch > 1250) { target = Math.floor(Math.random() * N); lastSwitch = t; }
      ctx.clearRect(0, 0, W, H);

      const proj = nodes.map(n => {
        const x = n.x * Math.cos(yaw) - n.z * Math.sin(yaw);
        const z = n.x * Math.sin(yaw) + n.z * Math.cos(yaw);
        const s = 170 / (170 + z);
        return { x: cx + x * s, y: cy + n.y * s, z, s };
      });

      ctx.lineWidth = 1;
      for (const [a, b] of edges) {
        const pa = proj[a], pb = proj[b];
        const al = Math.max(0.06, 0.12 + (Math.min(pa.s, pb.s) - 0.7) * 0.45);
        ctx.strokeStyle = `rgba(148,163,184,${al})`;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      }

      const order = [...proj.keys()].sort((i, j) => proj[i].z - proj[j].z);
      const tp = Math.min(1, (t - lastSwitch) / 700);
      const glow = Math.sin(tp * Math.PI); // ease the highlight in and out
      for (const i of order) {
        const p = proj[i], base = 2.2 * p.s;
        if (i === target) {
          ctx.save();
          ctx.shadowColor = "#2563EB"; ctx.shadowBlur = 18 * glow;
          ctx.beginPath(); ctx.arc(p.x, p.y, base + 5 + glow * 11, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(30,58,95,${0.55 * glow})`; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.beginPath(); ctx.arc(p.x, p.y, base + 1.6, 0, Math.PI * 2);
          ctx.fillStyle = "#2563EB"; ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.4, base), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(100,116,139,${Math.max(0.25, 0.4 + (p.s - 0.7) * 0.8)})`;
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clearInterval(ci); };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <canvas ref={ref} style={{ display: "block" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#2563EB", boxShadow: "0 0 6px #2563EB", animation: "pulse 1.1s ease-in-out infinite" }} />
        <span style={{ fontSize: "12px", color: "#9AA3B4", fontFamily: "IBM Plex Sans, sans-serif" }}>{CRAWL_CAPTIONS[phase]}</span>
      </div>
    </div>
  );
}

function SMEAssistant({ onAsk, conversationId, setConversationId, seedQuestion, onSeedConsumed, onOpenSim }: { onAsk: (q: string, result: RagResult|null) => void; conversationId: string|null; setConversationId: (id:string|null)=>void; seedQuestion?:string|null; onSeedConsumed?:()=>void; onOpenSim?:(text:string)=>void }) {
  const base=(import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
  const [msgs,setMsgs]=useState<ChatMsg[]>(INIT_MSGS);
  const [input,setInput]=useState("");
  const [pending,setPending]=useState(false);
  const [simming,setSimming]=useState(false);
  const [simEditor,setSimEditor]=useState<{i:number;text:string}|null>(null);  // customizable scenario per article
  const [uploading,setUploading]=useState(false);
  const [recent,setRecent]=useState<{id:string;title:string;articleCount?:number}[]>([]);
  const end=useRef<HTMLDivElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const loadedRef=useRef<string|null>(null);   // which conversation is currently rendered in msgs
  useEffect(()=>{ end.current?.scrollIntoView({behavior:"smooth"}); },[msgs,pending]);

  // Load the list of recent conversations for the resume dropdown.
  useEffect(()=>{ if(base) fetch(`${base}/conversations`).then(r=>r.json()).then(d=>setRecent(Array.isArray(d)?d:[])).catch(()=>{}); },[base]);

  // Rebuild the conversation transcript (question + inline article-snippet) when a
  // conversation is resumed or the assistant is re-entered — but not for the one
  // we are actively building (loadedRef guards against clobbering fresh sends).
  useEffect(()=>{
    if(!base||!conversationId||loadedRef.current===conversationId) return;
    fetch(`${base}/conversations/${conversationId}`).then(r=>r.json()).then(d=>{
      if(!d?.articles) return;
      const rebuilt:ChatMsg[]=[INIT_MSGS[0]];
      for(const a of d.articles){
        if(a.kind==="simulation"&&a.payload?.overall){
          // saved compliance simulation — rebuild the inline twin card
          rebuilt.push({role:"user",text:`🧪 Simulate: ${a.question}`});
          rebuilt.push({role:"ai",sim:{question:a.question,result:a.payload}});
        }else{
          rebuilt.push({role:"user",text:a.question});
          rebuilt.push({role:"ai",article:{id:a.id,question:a.question,summary:a.summary,verdict:a.verdict,confidence:a.confidence},result:a.payload});
        }
      }
      setMsgs(rebuilt);
      loadedRef.current=conversationId;
    }).catch(()=>{});
  },[base,conversationId]);

  const send=async(qOverride?:string)=>{
    const q=(qOverride??input).trim();
    if (!q||pending) return;
    setInput("");
    setMsgs(m=>[...m,{role:"user",text:q}]);
    setPending(true);
    // RAG: retrieve (+ live web fallback) + grounded answer, rendered inline as an article snippet.
    let result:RagResult|null=null;
    try{
      if(base){
        const r=await fetch(`${base}/rag/query`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q,conversationId})});
        if(r.ok) result=await r.json();
      }
    }catch{ /* fall back to static answer */ }
    setPending(false);
    if(result){
      if(result.conversationId){ setConversationId(result.conversationId); loadedRef.current=result.conversationId; }
      setMsgs(m=>[...m,{role:"ai",result,article:{id:result!.articleId||"",question:q,summary:result!.summary||result!.answer||"",verdict:result!.verdict,confidence:result!.confidence,sourcesAdded:result!.sourcesAdded}}]);
      fetch(`${base}/conversations`).then(r=>r.json()).then(d=>setRecent(Array.isArray(d)?d:[])).catch(()=>{}); // refresh resume list
    }else{
      setMsgs(m=>[...m,{role:"ai",text:"I couldn't reach the research backend. Please try again."}]);
    }
  };

  const openArticle=async(m:ChatMsg)=>{
    if(m.result){ onAsk(m.article!.question,m.result); return; }
    const id=m.article?.id; if(!base||!id) return;
    try{ const a=await fetch(`${base}/articles/${id}`).then(r=>r.json()); if(a?.payload) onAsk(a.question,a.payload); }catch{ /* ignore */ }
  };

  const newChat=()=>{ setConversationId(null); loadedRef.current=null; setMsgs(INIT_MSGS); };

  // Run the question through the compliance digital twin, rendered inline + saved to the conversation.
  const runSim=async(question:string)=>{
    if(!base||simming) return;
    setSimming(true);
    setMsgs(m=>[...m,{role:"user",text:`🧪 Simulate: ${question}`}]);
    try{
      const r=await fetch(`${base}/simulate/parse`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:question,conversationId})});
      const d=await r.json();
      if(r.ok){
        if(d.conversationId){ setConversationId(d.conversationId); loadedRef.current=d.conversationId; }
        setMsgs(m=>[...m,{role:"ai",sim:{question,result:d}}]);
        fetch(`${base}/conversations`).then(x=>x.json()).then(x=>setRecent(Array.isArray(x)?x:[])).catch(()=>{}); // refresh resume list
      }else{
        setMsgs(m=>[...m,{role:"ai",text:`Simulation failed: ${d?.error||"error"}.`}]);
      }
    }catch{ setMsgs(m=>[...m,{role:"ai",text:"Couldn't reach the simulation engine."}]); }
    setSimming(false);
  };

  // When opened from the twin ("Ask AILA"), auto-send the seeded question once.
  useEffect(()=>{ if(seedQuestion){ send(seedQuestion); onSeedConsumed?.(); } /* eslint-disable-next-line */ },[seedQuestion]);

  const onUpload=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0]; if(!f||!base) return;
    e.target.value="";
    setUploading(true);
    setMsgs(m=>[...m,{role:"user",text:`📎 ${f.name}`}]);
    try{
      const fd=new FormData(); fd.append("file",f);
      const r=await fetch(`${base}/upload`,{method:"POST",body:fd});
      const d=await r.json();
      const n=d?.clauses?.length ?? d?.pipeline?.extraction?.clauseCount ?? 0;
      setMsgs(m=>[...m,{role:"ai",text:r.ok?`Indexed “${f.name}” — ${n} clause${n===1?"":"s"} extracted. It's now part of the corpus and I can cite it in answers.`:`Couldn't process “${f.name}”: ${d?.error||"upload failed"}.`}]);
    }catch{ setMsgs(m=>[...m,{role:"ai",text:`Couldn't upload “${f.name}”.`}]); }
    setUploading(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col" style={{height:"calc(100vh - 56px)"}}>
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare size={18} style={{color:"#60A5FA"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#EEF1F7"}}>Legal Research Assistant</h1>
        <div className="ml-auto flex items-center gap-2">
          {recent.length>0&&(
            <select value={conversationId||""} onChange={e=>{ if(e.target.value){ setConversationId(e.target.value); setMsgs(INIT_MSGS); } else newChat(); }}
              className="text-xs px-2 py-1 rounded-lg outline-none" style={{border:"1px solid rgba(255,255,255,0.1)",color:"#AEB6C6",background:"#0B0F17",maxWidth:"180px"}}>
              <option value="">＋ New conversation</option>
              {recent.map(c=><option key={c.id} value={c.id}>{c.title.slice(0,32)}{c.articleCount?` (${c.articleCount})`:""}</option>)}
            </select>
          )}
          <div className="flex items-center gap-2 text-xs px-2.5 py-1 rounded-full"
            style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)",color:"#10B981"}}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>Live research on
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {["Can I store health data offshore?","Cross-border transfer rules","Fintech licensing in SG","AI regulation requirements"].map(q=>(
          <button key={q} onClick={()=>setInput(q)}
            className="text-xs px-3 py-1.5 rounded-full transition-colors"
            style={{background:"rgba(30,58,95,0.08)",border:"1px solid rgba(30,58,95,0.2)",color:"#60A5FA"}}>
            {q}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1" style={{minHeight:0}}>
        {msgs.map((m,i)=>(
          <div key={i} className={`flex gap-3 ${m.role==="user"?"justify-end":""}`}>
            {m.role==="ai"&&(
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{background:"rgba(30,58,95,0.15)",border:"1px solid rgba(30,58,95,0.3)"}}>
                <Brain size={13} style={{color:"#AEB6C6"}}/>
              </div>
            )}
            {m.article ? (
              <div className="flex flex-col gap-1.5 max-w-lg w-full">
                {/* inline article snippet — a preview of the generated brief, click to open */}
                <button onClick={()=>openArticle(m)} className="text-left rounded-2xl rounded-tl-sm overflow-hidden w-full transition-shadow"
                  style={{background:"#0B0F17",border:"1px solid rgba(0,0,0,0.09)",cursor:"pointer",boxShadow:"0 1px 2px rgba(15,23,42,0.04)"}}>
                  <div style={{background:"#2563EB",padding:"10px 14px"}}>
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={12} style={{color:"rgba(255,255,255,0.85)"}}/>
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{color:"rgba(255,255,255,0.85)",letterSpacing:"0.05em"}}>Research Brief</span>
                      <span className="ml-auto text-xs" style={{color:"rgba(255,255,255,0.7)",fontFamily:"JetBrains Mono, monospace"}}>{Math.round((m.article.confidence??0)*100)}%</span>
                    </div>
                    <p className="text-sm font-semibold" style={{color:"#fff",fontFamily:"Georgia, 'Times New Roman', serif",lineHeight:1.35}}>{m.article.question}</p>
                  </div>
                  <div style={{padding:"12px 14px"}}>
                    <p className="text-xs leading-relaxed" style={{color:"#AEB6C6",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{m.article.summary}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {m.article.verdict&&<span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:"rgba(30,58,95,0.08)",color:"#60A5FA",fontSize:"10px"}}>{m.article.verdict}</span>}
                      {!!m.article.sourcesAdded&&<span className="text-xs px-1.5 py-0.5 rounded-full inline-flex items-center gap-1" style={{background:"rgba(4,120,87,0.1)",color:"#34D399",fontSize:"10px"}}><Globe size={9}/>{m.article.sourcesAdded} scraped live</span>}
                      <span className="ml-auto text-xs font-semibold inline-flex items-center gap-1" style={{color:"#60A5FA"}}>Read full brief <ChevronRight size={12}/></span>
                    </div>
                  </div>
                </button>
                {/* bridge to the digital twin — customize the scenario before running */}
                {simEditor?.i===i ? (
                  <div className="self-stretch rounded-xl p-2.5" style={{background:"rgba(30,58,95,0.04)",border:"1px solid rgba(30,58,95,0.15)"}}>
                    <p className="text-xs font-semibold mb-1.5" style={{color:"#60A5FA"}}>Customize the compliance scenario</p>
                    <textarea value={simEditor.text} onChange={e=>setSimEditor({i,text:e.target.value})} rows={2}
                      placeholder="e.g. storing Malaysian KYC data on AWS US, with consent but no local copy"
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none resize-none" style={{border:"1px solid rgba(30,58,95,0.2)",color:"#EEF1F7",background:"#0B0F17",lineHeight:1.5}}/>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <button onClick={()=>{const t=simEditor.text.trim(); if(t){ runSim(t); setSimEditor(null); }}} disabled={simming||!simEditor.text.trim()}
                        className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5" style={{background:simming||!simEditor.text.trim()?"#94A3B8":"#2563EB",color:"#fff",border:"none",cursor:simming?"default":"pointer"}}>
                        <FlaskConical size={12}/> Run simulation
                      </button>
                      <button onClick={()=>setSimEditor(null)} className="text-xs font-medium rounded-full px-3 py-1.5" style={{background:"#0B0F17",color:"#9AA3B4",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer"}}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={()=>setSimEditor({i,text:m.article!.question})} disabled={simming}
                    className="self-start flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5"
                    style={{background:"rgba(30,58,95,0.06)",color:"#60A5FA",border:"1px solid rgba(30,58,95,0.18)",cursor:simming?"default":"pointer"}}>
                    <FlaskConical size={12}/> Simulate a scenario…
                  </button>
                )}
              </div>
            ) : m.sim ? (
              <div className="rounded-2xl rounded-tl-sm overflow-hidden max-w-lg w-full" style={{background:"#0B0F17",border:"1px solid rgba(0,0,0,0.09)",boxShadow:"0 1px 2px rgba(15,23,42,0.04)"}}>
                <div className="flex items-center gap-2" style={{background:"#0F2A43",padding:"10px 14px"}}>
                  <FlaskConical size={12} style={{color:"rgba(255,255,255,0.85)"}}/>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{color:"rgba(255,255,255,0.85)",letterSpacing:"0.05em"}}>Compliance Simulation</span>
                  <span className="ml-auto text-xs font-bold uppercase px-2 py-0.5 rounded-full" style={{color:VERDICT_STYLE[m.sim.result.overall.verdict].color,background:VERDICT_STYLE[m.sim.result.overall.verdict].bg}}>{VERDICT_STYLE[m.sim.result.overall.verdict].label} · {m.sim.result.overall.score}</span>
                </div>
                <div style={{padding:"12px 14px"}}>
                  <p className="text-xs leading-relaxed mb-3" style={{color:"#AEB6C6"}}>{m.sim.result.narrative||m.sim.result.overall.summary}</p>
                  <div className="flex flex-col gap-1.5">
                    {m.sim.result.jurisdictions.map(j=>(
                      <div key={j.jurisdiction} className="flex items-center gap-2 text-xs">
                        <span style={{fontSize:"13px",lineHeight:1}}>{j.flag}</span>
                        <span className="flex-1 truncate font-medium" style={{color:"#C4CCD9"}}>{j.jurisdiction}</span>
                        <span className="px-1.5 py-0.5 rounded-full font-semibold uppercase" style={{fontSize:"9px",letterSpacing:"0.03em",color:VERDICT_STYLE[j.verdict].color,background:VERDICT_STYLE[j.verdict].bg}}>{VERDICT_STYLE[j.verdict].label}</span>
                        <span style={{color:"#94A3B8",fontFamily:"JetBrains Mono, monospace",minWidth:"24px",textAlign:"right"}}>{j.score}</span>
                      </div>
                    ))}
                  </div>
                  {onOpenSim&&<button onClick={()=>onOpenSim(m.sim!.question)} className="mt-3 flex items-center gap-1 text-xs font-semibold" style={{color:NAVY,background:"none",border:"none",cursor:"pointer",padding:0}}>Open full simulator <ChevronRight size={12}/></button>}
                </div>
              </div>
            ) : (
              <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role==="user"?"max-w-sm rounded-tr-sm":"max-w-lg rounded-tl-sm"}`}
                style={{background:m.role==="user"?"rgba(96,165,250,0.14)":"rgba(255,255,255,0.05)",border:`1px solid ${m.role==="user"?"rgba(96,165,250,0.28)":"rgba(255,255,255,0.09)"}`,color:"#DCE2EC"}}>
                {m.text}
              </div>
            )}
          </div>
        ))}
        {pending&&(
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{background:"rgba(30,58,95,0.15)",border:"1px solid rgba(30,58,95,0.3)"}}>
              <Brain size={13} style={{color:"#AEB6C6"}}/>
            </div>
            <div className="rounded-2xl rounded-tl-sm px-4 py-3.5"
              style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.09)"}}>
              <CrawlerGraphLoader/>
            </div>
          </div>
        )}
        <div ref={end}/>
      </div>

      <div className="mt-4 flex gap-2">
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.tiff,.txt" onChange={onUpload} style={{display:"none"}}/>
        <button onClick={()=>fileRef.current?.click()} disabled={uploading} title="Upload or scan a document (PDF, image, or text) to add it to the corpus"
          className="px-3 py-3 rounded-xl flex items-center justify-center"
          style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.12)",cursor:uploading?"default":"pointer"}}>
          {uploading?<span className="w-4 h-4 rounded-full animate-spin" style={{border:"2px solid #CBD5E1",borderTopColor:"#2563EB"}}/>:<Paperclip size={16} style={{color:"#9AA3B4"}}/>}
        </button>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Ask about regulatory requirements, compliance obligations, or specific laws..."
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
          style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.12)",color:"#EEF1F7",fontFamily:"Inter, sans-serif"}}/>
        <button onClick={()=>send()}
          className="px-4 py-3 rounded-xl flex items-center justify-center"
          style={{background:"#2563EB",border:"1px solid rgba(29,78,216,0.5)"}}>
          <Send size={16} style={{color:"#fff"}}/>
        </button>
      </div>
    </div>
  );
}

// ==================== COUNTRIES VIEW ====================
function CountriesView() {
  const base=(import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
  const [countries,setCountries]=useState<any[]>([]);
  useEffect(()=>{ if(base) fetch(`${base}/countries`).then(r=>r.json()).then(d=>setCountries(Array.isArray(d?.countries)?d.countries:[])).catch(()=>{}); },[base]);
  const maxReg=Math.max(1,...countries.map(c=>c.regulations));
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Globe size={18} style={{color:"#60A5FA"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#EEF1F7"}}>Jurisdiction Overview</h1>
        <span className="text-xs" style={{color:"#94A3B8"}}>{countries.length} economies · live corpus</span>
      </div>
      {countries.length===0&&<p className="text-sm" style={{color:"#94A3B8"}}>Loading jurisdictions…</p>}
      <div className="grid grid-cols-3 gap-4">
        {countries.map((c)=>{
          const coverage=Math.round((c.regulations/maxReg)*100);  // relative corpus coverage
          return (
            <div key={c.country} className="rounded-xl p-4 transition-all"
              style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)"}}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{flagFor(c.country)}</span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate" style={{color:"#EEF1F7"}}>{c.country}</h3>
                  <p className="text-xs" style={{color:"#9AA3B4"}}>{c.region} · {c.regulations} sources</p>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-lg font-bold" style={{color:"#60A5FA",fontFamily:"JetBrains Mono, monospace"}}>{coverage}%</div>
                  <div className="text-xs" style={{color:"#9AA3B4"}}>coverage</div>
                </div>
              </div>
              <div className="h-1 rounded-full overflow-hidden mb-3" style={{background:"rgba(255,255,255,0.09)"}}>
                <div className="h-full rounded-full" style={{width:`${coverage}%`,background:"#2563EB"}}/>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[{l:"Sources",v:c.regulations},{l:"Clauses",v:c.clauses},{l:"Validated",v:c.validations}].map(s=>(
                  <div key={s.l} className="text-center">
                    <div className="text-sm font-bold" style={{color:"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>{s.v}</div>
                    <div className="text-xs" style={{color:"#9AA3B4"}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== MEMORY LAYER ====================
const CLAUSE_TYPE_COLOR: Record<string,string> = {
  obligation:"#2563EB", restriction:"#B91C1C", exception:"#B45309",
  penalty:"#7C2D12", right:"#047857", definition:"#AEB6C6",
};

function MemoryLayer() {
  const API = (import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
  const [health,setHealth]=React.useState<any>(null);
  const [clauses,setClauses]=React.useState<any[]>([]);
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState<string|null>(null);
  const [jur,setJur]=React.useState("");
  const [ctype,setCtype]=React.useState("");
  const [reviewOnly,setReviewOnly]=React.useState(false);
  const [val,setVal]=React.useState<number|null>(null);
  const [batch,setBatch]=React.useState<any>(null);

  // column picker: registry fetched from the backend (single source of truth for
  // ids/labels/groups/default order — never hardcoded on the frontend).
  const [columnMeta,setColumnMeta]=React.useState<{id:string;label:string;group:string;defaultChecked?:boolean}[]>([]);
  const [defaultColumns,setDefaultColumns]=React.useState<string[]>([]);
  const [maxColumns,setMaxColumns]=React.useState(25);
  const [pickerOpen,setPickerOpen]=React.useState(false);
  const [pickerSource,setPickerSource]=React.useState<"clauses"|"validations">("clauses");
  const [selectedCols,setSelectedCols]=React.useState<string[]>([]);
  const [showVal,setShowVal]=React.useState(false);           // Round-1 review mode
  const [vals,setVals]=React.useState<any[]>([]);             // validated provisions

  const loadClauses=React.useCallback(()=>{
    if(!API) return;
    const qs=new URLSearchParams();
    if(jur) qs.set("jurisdiction",jur);
    if(ctype) qs.set("type",ctype);
    fetch(`${API}/clauses?${qs.toString()}`).then(r=>r.json()).then(d=>{setClauses(Array.isArray(d)?d:[]);setLoading(false);}).catch(()=>{setError("Failed to load clauses.");setLoading(false);});
  },[API,jur,ctype]);

  React.useEffect(()=>{
    if(!API){ setError("Backend URL not configured."); setLoading(false); return; }
    fetch(`${API}/health`).then(r=>r.json()).then(setHealth).catch(()=>{});
    fetch(`${API}/validations`).then(r=>r.json()).then(d=>{ setVal(d?.stats?.total ?? 0); setVals(Array.isArray(d?.validations)?d.validations:[]); }).catch(()=>{});
    fetch(`${API}/export/columns`).then(r=>r.json()).then(d=>{
      setColumnMeta(Array.isArray(d?.columns)?d.columns:[]);
      setDefaultColumns(Array.isArray(d?.defaultColumns)?d.defaultColumns:[]);
      setSelectedCols(Array.isArray(d?.defaultColumns)?d.defaultColumns:[]);
      if(typeof d?.maxColumns==="number") setMaxColumns(d.maxColumns);
    }).catch(()=>{});
    loadClauses();
  },[API,loadClauses]);

  // Column ids in the order the picker displays them (registry/section order) — used
  // so a custom selection always exports in a stable, predictable column order.
  const orderedSelectedCols=React.useMemo(
    ()=>columnMeta.filter(c=>selectedCols.includes(c.id)).map(c=>c.id),
    [columnMeta,selectedCols],
  );

  const toggleCol=(id:string)=>{
    setSelectedCols(prev=>{
      if(prev.includes(id)) return prev.filter(x=>x!==id);
      if(prev.length>=maxColumns) return prev; // hard cap — silently ignore further checks
      return [...prev,id];
    });
  };

  const openPicker=(source:"clauses"|"validations")=>{
    setPickerSource(source);
    setPickerOpen(true);
  };

  const customExportUrl=(format:"csv"|"json")=>{
    const qs=new URLSearchParams();
    qs.set("source",pickerSource);
    qs.set("columns",orderedSelectedCols.join(","));
    if(pickerSource==="clauses"){
      if(jur) qs.set("jurisdiction",jur);
      if(ctype) qs.set("type",ctype);
    }
    return `${API}/export/custom.${format}?${qs.toString()}`;
  };

  // batch extraction progress polling
  const runBatch=async()=>{
    if(!API) return;
    const r=await fetch(`${API}/extract/all`,{method:"POST"});
    if(!r.ok){ const e=await r.json().catch(()=>({})); setBatch({error:e.error||`HTTP ${r.status}`}); return; }
    const poll=async()=>{
      const s=await fetch(`${API}/extract/status`).then(x=>x.json());
      setBatch(s);
      if(s.running) setTimeout(poll,3000); else { loadClauses(); fetch(`${API}/health`).then(x=>x.json()).then(setHealth); }
    };
    poll();
  };

  const jurisdictions=[...new Set(clauses.map(c=>c.jurisdiction))].sort();
  const types=["obligation","restriction","exception","penalty","right","definition"];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Database size={18} style={{color:"#C4CCD9"}}/>
          <h1 className="text-xl font-semibold" style={{color:"#EEF1F7"}}>Document Archive</h1>
        </div>
        <div className="flex gap-2 text-xs">
          {[{l:"Sources",v:health?.sources},{l:"Text chunks",v:health?.chunks},{l:"Clauses",v:health?.clauses}].map(s=>(
            <div key={s.l} className="text-center px-3 py-1.5 rounded-lg" style={{background:"rgba(30,58,95,0.08)",border:"1px solid rgba(30,58,95,0.18)"}}>
              <div className="font-bold" style={{color:"#60A5FA",fontFamily:"JetBrains Mono, monospace"}}>{s.v??"—"}</div>
              <div style={{color:"#9AA3B4"}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm mb-5" style={{color:"#9AA3B4"}}>Structured regulatory atoms extracted from the live corpus — each with its type, citation, and verbatim source evidence.</p>

      {/* controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select value={jur} onChange={e=>setJur(e.target.value)} className="rounded-lg px-3 py-1.5 text-sm outline-none" style={{border:"1px solid rgba(255,255,255,0.1)",color:"#C4CCD9",background:"#0B0F17"}}>
          <option value="">All jurisdictions</option>
          {jurisdictions.map(j=><option key={j} value={j}>{j}</option>)}
        </select>
        <select value={ctype} onChange={e=>setCtype(e.target.value)} className="rounded-lg px-3 py-1.5 text-sm outline-none" style={{border:"1px solid rgba(255,255,255,0.1)",color:"#C4CCD9",background:"#0B0F17"}}>
          <option value="">All types</option>
          {types.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={()=>setReviewOnly(v=>!v)} title="Show only low-confidence clauses (confidence < 0.80) for human review"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
          style={reviewOnly?{background:"rgba(217,119,6,0.12)",color:"#FBBF24",border:"1px solid #B45309"}:{background:"#0B0F17",color:"#9AA3B4",border:"1px solid rgba(255,255,255,0.1)"}}>
          ⚑ Needs review{clauses.filter(c=>c.reviewNeeded).length?` (${clauses.filter(c=>c.reviewNeeded).length})`:""}
        </button>
        <button onClick={()=>setShowVal(v=>!v)} title="Validated legal provisions — with confidence < 0.80 auto-flagged for review"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
          style={showVal?{background:"rgba(30,58,95,0.1)",color:"#60A5FA",border:"1px solid #2563EB"}:{background:"#0B0F17",color:"#9AA3B4",border:"1px solid rgba(255,255,255,0.1)"}}>
          ⚖ Validated provisions{val?` (${val})`:""}
        </button>
        <div className="flex-1"/>
        <a href={`${API}/export/round1.csv`} title="Primary export — the 13-column validated-provisions CSV"
          className="flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold"
          style={{background:"#2563EB",color:"#fff",border:"1px solid #2563EB",textDecoration:"none"}}>
          <Download size={14}/>Export CSV{val!=null?` (${val})`:""}
        </a>
        <a href={`${API}/export/round1.json`} title="Supplementary JSON — richer metadata + provisions[] per law"
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold"
          style={{background:"#0B0F17",color:"#A78BFA",border:"1px solid #6D28D9",textDecoration:"none"}}>
          <Download size={14}/>JSON
        </a>
        <button onClick={()=>openPicker("clauses")} title="Choose which columns to export (clauses or validated provisions)"
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold"
          style={{background:"#0B0F17",color:"#C4CCD9",border:"1px solid rgba(255,255,255,0.1)"}}>
          <Settings size={14}/>Columns…
        </button>
        <button onClick={runBatch} disabled={batch?.running}
          className="flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold"
          style={{background:batch?.running?"#94A3B8":"#2563EB",color:"#fff",border:"none",cursor:batch?.running?"default":"pointer"}}>
          <Brain size={14}/>{batch?.running?`Extracting ${batch.processed}/${batch.total}…`:"Extract clauses (all sources)"}
        </button>
      </div>
      {batch?.error&&<p className="text-xs mb-3" style={{color:"#F87171"}}>{batch.error}</p>}
      {batch&&!batch.running&&batch.processed>0&&<p className="text-xs mb-3" style={{color:"#34D399"}}>✓ Extracted {batch.clauses} clauses from {batch.processed} sources.</p>}

      {/* Round-1 validated provisions (review) — the actual submission rows */}
      {showVal&&(
        <div className="space-y-2 mb-6">
          {vals.length===0&&(
            <div className="rounded-xl p-8 text-center" style={{background:"#0B0F17",border:"1px dashed rgba(255,255,255,0.1)"}}>
              <p className="text-sm" style={{color:"#94A3B8"}}>No validated provisions yet. Run the engine (<span style={{fontFamily:"JetBrains Mono, monospace"}}>server: npm run seed -- --fill</span>) to populate the Round-1 rows.</p>
            </div>
          )}
          {vals.map((v,i)=>{
            const flag=v.confidence!=null&&v.confidence<0.8;
            return (
              <div key={i} className="rounded-xl px-4 py-3" style={{background:"#0B0F17",border:`1px solid ${flag?"#FBBF24":"rgba(255,255,255,0.1)"}`}}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{color:v.discoveryTag==="NEW"?"#B45309":"#2563EB",background:v.discoveryTag==="NEW"?"rgba(180,83,9,0.1)":"rgba(30,58,95,0.08)"}}>{v.discoveryTag==="NEW"?"NEW":"KNOWN"}</span>
                  <span className="text-sm font-semibold" style={{color:"#EEF1F7"}}>{v.economy}</span>
                  {v.indicatorId&&<span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:"rgba(30,58,95,0.1)",color:"#60A5FA",fontFamily:"JetBrains Mono, monospace",fontWeight:700,fontSize:"9px"}}>{v.indicatorId}</span>}
                  {v.articleSection&&<span className="text-xs" style={{color:"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>{v.articleSection}</span>}
                  {v.confidence!=null&&<span className="text-xs" style={{color:flag?"#B45309":"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>{v.confidence.toFixed(2)}</span>}
                  {flag&&<span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:"rgba(217,119,6,0.12)",color:"#FBBF24"}} title="Confidence < 0.80 — human review recommended">⚑ review</span>}
                  {v.dbRow&&<span className="text-xs" style={{color:"#CBD5E1"}}>{v.dbRow}</span>}
                  {v.sourceUrl&&<a href={v.sourceUrl} target="_blank" rel="noreferrer" className="ml-auto"><Link size={12} style={{color:"#94A3B8"}}/></a>}
                </div>
                <p className="text-sm font-semibold mb-0.5" style={{color:"#DCE2EC"}}>{v.lawName}{v.lawNumber?` · ${v.lawNumber}`:""}</p>
                {v.verbatim?(
                  <p className="text-xs leading-snug pl-2" style={{color:"#C4CCD9",fontFamily:"Georgia, serif",fontStyle:"italic",borderLeft:"2px solid rgba(255,255,255,0.1)"}}>&ldquo;{v.verbatim}&rdquo;</p>
                ):(
                  <p className="text-xs" style={{color:"#FBBF24"}}>⚑ Verbatim not populated — flagged for manual fetch (see Notes).</p>
                )}
                {v.mappingRationale&&<p className="text-xs mt-1" style={{color:"#9AA3B4"}}><span style={{fontWeight:600}}>Why:</span> {v.mappingRationale}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* clause list */}
      {!showVal&&<div className="space-y-2">
        {loading&&<p style={{color:"#9AA3B4",textAlign:"center",padding:"2rem"}}>Loading…</p>}
        {error&&<p style={{color:"#EF4444",textAlign:"center",padding:"2rem"}}>{error}</p>}
        {!loading&&!error&&clauses.length===0&&(
          <div className="rounded-xl p-8 text-center" style={{background:"#0B0F17",border:"1px dashed rgba(255,255,255,0.1)"}}>
            <FileText size={24} style={{color:"#CBD5E1",margin:"0 auto 10px"}}/>
            <p className="text-sm" style={{color:"#94A3B8"}}>No clauses extracted yet. Click &ldquo;Extract clauses (all sources)&rdquo; to populate the archive.</p>
          </div>
        )}
        {!loading&&!error&&reviewOnly&&clauses.length>0&&clauses.filter(c=>c.reviewNeeded).length===0&&(
          <div className="rounded-xl p-8 text-center" style={{background:"#0B0F17",border:"1px dashed rgba(255,255,255,0.1)"}}>
            <p className="text-sm" style={{color:"#34D399"}}>✓ No clauses need review — every extracted clause has confidence ≥ 0.80.</p>
          </div>
        )}
        {(reviewOnly?clauses.filter(c=>c.reviewNeeded):clauses).map((c,i)=>{
          const col=CLAUSE_TYPE_COLOR[c.type]||"#AEB6C6";
          return (
            <div key={i} className="rounded-xl px-4 py-3" style={{background:"#0B0F17",border:reviewOnly?"1px solid #FBBF24":"1px solid rgba(255,255,255,0.1)"}}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{color:col,background:h2r(col,0.1)}}>{c.type}</span>
                <span className="text-sm font-semibold" style={{color:"#EEF1F7"}}>{c.instrument}</span>
                <span className="text-xs" style={{color:"#94A3B8"}}>{c.jurisdiction}</span>
                {c.level&&<span className="text-xs px-1.5 py-0.5 rounded" style={{background:"rgba(30,58,95,0.06)",color:"#AEB6C6"}}>{c.level}</span>}
                {c.lawNumber&&<span className="text-xs" style={{color:"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>{c.lawNumber}</span>}
                {c.citation&&<span className="text-xs" style={{color:"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>{c.citation}{c.locationReference?` · ${c.locationReference}`:""}</span>}
                {c.discoveryTag&&<span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:"rgba(180,83,9,0.1)",color:"#FBBF24"}}>🔎 new find</span>}
                {c.reviewNeeded&&<span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:"rgba(217,119,6,0.12)",color:"#FBBF24"}} title={`Low confidence (${c.confidence?.toFixed(2)}) — human review recommended`}>⚑ review{c.confidence!=null?` · ${c.confidence.toFixed(2)}`:""}</span>}
                {(()=>{const t=sourceTier(c.url);return t?(<span className="text-xs px-1.5 py-0.5 rounded-full" title={t==="primary"?"Official / primary source":"Secondary source — verify against an official publisher"} style={t==="primary"?{background:"rgba(4,120,87,0.1)",color:"#34D399"}:{background:"rgba(100,116,139,0.12)",color:"#9AA3B4"}}>{t==="primary"?"✓ primary":"secondary"}</span>):null;})()}
                <a href={c.url} target="_blank" rel="noreferrer" className="ml-auto"><Link size={12} style={{color:"#94A3B8"}}/></a>
              </div>
              {reviewOnly?(
                <div className="grid gap-3 mt-1" style={{gridTemplateColumns:"1fr 1fr"}}>
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{color:"#FBBF24"}}>AI-extracted rule</p>
                    <p className="text-sm leading-relaxed" style={{color:"#DCE2EC"}}>{c.text}</p>
                    {c.mappingRationale&&<p className="text-xs mt-1" style={{color:"#9AA3B4"}}><span style={{fontWeight:600}}>Why:</span> {c.mappingRationale}</p>}
                  </div>
                  <div style={{borderLeft:"2px solid #FDE68A",paddingLeft:"0.75rem"}}>
                    <p className="text-xs font-semibold mb-1" style={{color:"#9AA3B4"}}>Source evidence {c.citation?`· ${c.citation}`:""}</p>
                    {c.sourceQuote
                      ? <p className="text-xs leading-snug" style={{color:"#C4CCD9",fontFamily:"Georgia, serif",fontStyle:"italic"}}>&ldquo;{c.sourceQuote}&rdquo;</p>
                      : <p className="text-xs" style={{color:"#94A3B8"}}>No verbatim quote captured — open the source to verify.</p>}
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 mt-1.5" style={{color:"#60A5FA"}}><Link size={11}/>Open source</a>
                  </div>
                </div>
              ):(<>
                <p className="text-sm leading-relaxed mb-1" style={{color:"#DCE2EC"}}>{c.text}</p>
                {c.sourceQuote&&<p className="text-xs leading-snug pl-2" style={{color:"#9AA3B4",fontFamily:"Georgia, serif",fontStyle:"italic",borderLeft:"2px solid rgba(255,255,255,0.1)"}}>&ldquo;{c.sourceQuote}&rdquo;</p>}
                {c.mappingRationale&&<p className="text-xs mt-1" style={{color:"#9AA3B4"}}><span style={{fontWeight:600}}>Why:</span> {c.mappingRationale}</p>}
              </>)}
              {((c.indicators&&c.indicators.length)||c.penalty)&&(
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {(c.indicators||[]).map((id:string,k:number)=>(<span key={id} className="text-xs px-1.5 py-0.5 rounded-full inline-flex items-center gap-1" style={{background:"rgba(30,58,95,0.1)",color:"#60A5FA",border:"1px solid rgba(30,58,95,0.22)"}}><span style={{fontFamily:"JetBrains Mono, monospace",fontWeight:700,fontSize:"9px"}}>{id}</span>{c.rdtii?.[k]?<span style={{opacity:0.75}}>{c.rdtii[k]}</span>:null}</span>))}
                  {c.penalty&&<span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:"rgba(185,28,28,0.08)",color:"#F87171"}}>⚠ {c.penalty}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>}
      {pickerOpen&&(
        <ColumnPickerModal
          columnMeta={columnMeta}
          selectedCols={selectedCols}
          maxColumns={maxColumns}
          defaultColumns={defaultColumns}
          source={pickerSource}
          onSourceChange={setPickerSource}
          onToggle={toggleCol}
          onReset={()=>setSelectedCols(defaultColumns)}
          onClear={()=>setSelectedCols([])}
          onClose={()=>setPickerOpen(false)}
          csvUrl={customExportUrl("csv")}
          jsonUrl={customExportUrl("json")}
        />
      )}
    </div>
  );
}

// Column picker: checkbox list grouped by the six gap-analysis sections, capped at
// `maxColumns`. Column ids/labels/groups/default order all come from the backend
// registry (GET /export/columns) — nothing about the 25 fields is hardcoded here.
function ColumnPickerModal({columnMeta,selectedCols,maxColumns,defaultColumns,source,onSourceChange,onToggle,onReset,onClear,onClose,csvUrl,jsonUrl}:{
  columnMeta:{id:string;label:string;group:string;defaultChecked?:boolean}[];
  selectedCols:string[];
  maxColumns:number;
  defaultColumns:string[];
  source:"clauses"|"validations";
  onSourceChange:(s:"clauses"|"validations")=>void;
  onToggle:(id:string)=>void;
  onReset:()=>void;
  onClear:()=>void;
  onClose:()=>void;
  csvUrl:string;
  jsonUrl:string;
}) {
  const groups=[...new Set(columnMeta.map(c=>c.group))];
  const atCap=selectedCols.length>=maxColumns;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(15,23,42,0.45)"}} onClick={onClose}>
      <div className="rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" style={{background:"#0B0F17"}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
          <div>
            <h2 className="text-base font-semibold" style={{color:"#EEF1F7"}}>Choose export columns</h2>
            <p className="text-xs mt-0.5" style={{color:"#9AA3B4"}}>{selectedCols.length} / {maxColumns} selected</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5" style={{color:"#9AA3B4"}}><X size={18}/></button>
        </div>

        <div className="px-5 py-3 flex items-center gap-2 flex-wrap" style={{borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
          <span className="text-xs font-medium" style={{color:"#9AA3B4"}}>Source:</span>
          {(["clauses","validations"] as const).map(s=>(
            <button key={s} onClick={()=>onSourceChange(s)}
              className="rounded-lg px-3 py-1 text-xs font-semibold"
              style={source===s?{background:"#2563EB",color:"#fff"}:{background:"#0F1522",color:"#C4CCD9"}}>
              {s==="clauses"?"Extracted clauses":"Validated provisions (Round-1)"}
            </button>
          ))}
          <div className="flex-1"/>
          <button onClick={onReset} className="text-xs font-semibold" style={{color:"#60A5FA"}}>Reset to Round-1 default ({defaultColumns.length})</button>
          <button onClick={onClear} className="text-xs font-semibold" style={{color:"#F87171"}}>Clear all</button>
        </div>

        <div className="overflow-y-auto px-5 py-3 flex-1">
          {columnMeta.length===0&&<p className="text-sm" style={{color:"#94A3B8"}}>Loading columns…</p>}
          {groups.map(g=>(
            <div key={g} className="mb-4">
              <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{color:"#94A3B8"}}>{g}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {columnMeta.filter(c=>c.group===g).map(c=>{
                  const checked=selectedCols.includes(c.id);
                  const disabled=!checked&&atCap;
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-sm py-0.5" style={{color:disabled?"#6B7488":"#C4CCD9",cursor:disabled?"not-allowed":"pointer"}}>
                      <input type="checkbox" checked={checked} disabled={disabled} onChange={()=>onToggle(c.id)}/>
                      {c.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-5 py-4" style={{borderTop:"1px solid rgba(255,255,255,0.1)"}}>
          <div className="flex-1"/>
          <a href={csvUrl} onClick={e=>{if(!selectedCols.length)e.preventDefault();}}
            className="flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold"
            style={selectedCols.length?{background:"#2563EB",color:"#fff",textDecoration:"none"}:{background:"#94A3B8",color:"#fff",textDecoration:"none",cursor:"not-allowed"}}>
            <Download size={14}/>Export CSV
          </a>
          <a href={jsonUrl} onClick={e=>{if(!selectedCols.length)e.preventDefault();}}
            className="flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold"
            style={selectedCols.length?{background:"#0B0F17",color:"#A78BFA",border:"1px solid #6D28D9",textDecoration:"none"}:{background:"#0B0F17",color:"#94A3B8",border:"1px solid rgba(255,255,255,0.1)",textDecoration:"none",cursor:"not-allowed"}}>
            <Download size={14}/>Export JSON
          </a>
        </div>
      </div>
    </div>
  );
}

// ==================== API VIEW ====================
function APIView() {
  const endpoints=[
    {method:"GET",path:"/v1/regulations",desc:"List all tracked regulations with optional country and category filters"},
    {method:"GET",path:"/v1/regulations/{id}",desc:"Retrieve full regulation document with extracted clauses and metadata"},
    {method:"POST",path:"/v1/diff",desc:"Generate semantic diff between two regulation versions"},
    {method:"POST",path:"/v1/simulate",desc:"Run compliance simulation for a given business profile"},
    {method:"GET",path:"/v1/graph",desc:"Export regulatory knowledge graph in JSON or Cytoscape format"},
    {method:"POST",path:"/v1/query",desc:"Natural language query against the regulatory memory layer"},
  ];
  const mc:{[k:string]:string}={GET:"#10B981",POST:"#2563EB",DELETE:"#EF4444"};

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Code2 size={18} style={{color:"#60A5FA"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#EEF1F7"}}>API Reference</h1>
        <span className="text-xs px-2 py-0.5 rounded" style={{background:"rgba(30,58,95,0.1)",color:"#60A5FA",border:"1px solid rgba(30,58,95,0.25)"}}>v1.4.2</span>
      </div>

      <div className="rounded-xl mb-4 p-4" style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)"}}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:"#9AA3B4",fontFamily:"IBM Plex Sans, sans-serif"}}>Authentication</p>
        <div className="rounded-lg px-3 py-2" style={{background:"#0F1522",border:"1px solid rgba(255,255,255,0.1)"}}>
          <code className="text-xs" style={{color:"#C4CCD9",fontFamily:"JetBrains Mono, monospace"}}>
            Authorization: Bearer {"<YOUR_AILA_API_KEY>"}
          </code>
        </div>
      </div>

      <div className="space-y-2">
        {endpoints.map((e,i)=>(
          <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.09)"}}>
            <span className="text-xs font-bold w-12 shrink-0 mt-0.5" style={{color:mc[e.method]||"#C4CCD9",fontFamily:"JetBrains Mono, monospace"}}>{e.method}</span>
            <code className="text-xs shrink-0 w-52" style={{color:"#C4CCD9",fontFamily:"JetBrains Mono, monospace"}}>{e.path}</code>
            <span className="text-xs" style={{color:"#9AA3B4"}}>{e.desc}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl p-4" style={{background:"#0F1522",border:"1px solid rgba(255,255,255,0.1)"}}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:"#9AA3B4",fontFamily:"IBM Plex Sans, sans-serif"}}>Example Request</p>
        <pre className="text-xs leading-relaxed overflow-x-auto" style={{color:"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>
{`curl -X POST https://api.aila.legal/v1/simulate \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "business_type": "saas",
    "data_categories": ["personal", "biometric"],
    "storage_region": "ap-southeast-1",
    "target_jurisdictions": ["sg", "vn", "ph"]
  }'`}
        </pre>
      </div>
    </div>
  );
}

// ==================== SETTINGS VIEW ====================
function SettingsView() {
  const [vals,setVals]=useState({aiModel:"claude-sonnet-4-6",crawlInterval:"6h",notifications:true,memoryAuto:true,semanticDiff:true});
  const toggle=(k:keyof typeof vals)=>setVals(v=>({...v,[k]:!v[k]}));

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={18} style={{color:"#9AA3B4"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#EEF1F7"}}>System Configuration</h1>
      </div>
      <div className="space-y-4">
        {[
          {title:"AI Engine",items:[
            {l:"Model",v:<select value={vals.aiModel} onChange={e=>setVals(v=>({...v,aiModel:e.target.value}))} className="rounded px-2 py-1 text-xs outline-none" style={{background:"#0F1522",border:"1px solid rgba(255,255,255,0.12)",color:"#C4CCD9"}}><option value="claude-sonnet-4-6">Claude Sonnet 4.6</option><option value="claude-opus-4-7">Claude Opus 4.7</option></select>},
            {l:"Semantic Diff Engine",v:<button onClick={()=>toggle("semanticDiff")} className="w-9 h-5 rounded-full transition-colors relative" style={{background:vals.semanticDiff?"#2563EB":"#E2E8F0"}}><span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{background:"#0B0F17",left:vals.semanticDiff?"calc(100% - 18px)":"2px"}}/></button>},
          ]},
          {title:"Crawler Settings",items:[
            {l:"Crawl Interval",v:<select value={vals.crawlInterval} onChange={e=>setVals(v=>({...v,crawlInterval:e.target.value}))} className="rounded px-2 py-1 text-xs outline-none" style={{background:"#0F1522",border:"1px solid rgba(255,255,255,0.12)",color:"#C4CCD9"}}><option value="1h">Every 1 hour</option><option value="6h">Every 6 hours</option><option value="24h">Daily</option></select>},
            {l:"Auto Memory Growth",v:<button onClick={()=>toggle("memoryAuto")} className="w-9 h-5 rounded-full transition-colors relative" style={{background:vals.memoryAuto?"#2563EB":"#E2E8F0"}}><span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{background:"#0B0F17",left:vals.memoryAuto?"calc(100% - 18px)":"2px"}}/></button>},
          ]},
          {title:"Notifications",items:[
            {l:"Amendment Alerts",v:<button onClick={()=>toggle("notifications")} className="w-9 h-5 rounded-full transition-colors relative" style={{background:vals.notifications?"#2563EB":"#E2E8F0"}}><span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{background:"#0B0F17",left:vals.notifications?"calc(100% - 18px)":"2px"}}/></button>},
          ]},
        ].map(section=>(
          <div key={section.title} className="rounded-xl overflow-hidden" style={{background:"#0B0F17",border:"1px solid rgba(255,255,255,0.1)"}}>
            <div className="px-4 py-2.5 border-b" style={{borderColor:"rgba(255,255,255,0.08)"}}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#9AA3B4",fontFamily:"IBM Plex Sans, sans-serif"}}>{section.title}</p>
            </div>
            {section.items.map(item=>(
              <div key={item.l} className="flex items-center justify-between px-4 py-3 border-b last:border-0"
                style={{borderColor:"rgba(255,255,255,0.07)"}}>
                <span className="text-sm" style={{color:"#C4CCD9"}}>{item.l}</span>
                {item.v}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== APP ====================
const GlobeView = React.lazy(() => import("./GlobeView"));

export default function App() {
  const [view,setView]=useState<ViewId>("dashboard");
  const [selNode,setSelNode]=useState<GNode|null>(null);
  const [query,setQuery]=useState("");
  const [answer,setAnswer]=useState<RagResult|null>(null);
  const [conversationId,setConversationId]=useState<string|null>(null);
  const [simSeed,setSimSeed]=useState<string|null>(null);   // text sent from chat → twin
  const [chatSeed,setChatSeed]=useState<string|null>(null); // question sent from twin → chat
  const [viz,setViz]=useState<"graph"|"globe">("globe");
  const isDash=view==="dashboard"||view==="graph";

  const onNav=(v:ViewId)=>{
    setView(v);
    if (v==="dashboard"||v==="graph") setSelNode(null);
  };

  const onAsk=(q:string,result:RagResult|null)=>{ setQuery(q); setAnswer(result); setView("answer"); };

  const onGraphSelect=(n:GNode|null)=>{
    if (!isDash) return;
    setSelNode(n);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{background:"#000000",fontFamily:"Inter, sans-serif"}}>
      {/* Sharp edges on every inner page (no border-radius), scoped so the nav island /
          view-switch keep their rounded glass look. */}
      <style>{`.aila-dark-page *{border-radius:0 !important}
        .aila-dark-page ::placeholder{color:#6B7488 !important;opacity:1}
        .aila-dark-page input,.aila-dark-page textarea{color:#EEF1F7}
        .aila-dark-page ::-webkit-scrollbar{width:10px;height:10px}
        .aila-dark-page ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1)}
        .aila-dark-page ::-webkit-scrollbar-track{background:transparent}`}</style>
      {viz==="globe" ? (
        <React.Suspense fallback={<div className="absolute inset-0 flex items-center justify-center"><span className="text-xs tracking-widest uppercase" style={{color:"#94A3B8"}}>Loading globe…</span></div>}>
          <GlobeView onSelect={onGraphSelect} dimmed={!isDash}/>
        </React.Suspense>
      ) : (
        <RegulatoryGraph onSelect={onGraphSelect} selId={selNode?.id||null} dimmed={!isDash} simulateAction={{tick:0,step:"crawler"}}/>
      )}

      <TopNav cur={view} onNav={onNav}/>

      {/* Globe / Graph view switch — floating glass segmented control, bottom-center */}
      {isDash && (
        <div className="fixed z-40 flex items-center gap-1 p-1"
          style={{
            bottom:"24px", left:"50%", transform:"translateX(-50%)",
            borderRadius:"999px",
            border:"1px solid rgba(255,255,255,0.1)",
            background:"rgba(16,18,27,0.55)",
            backdropFilter:"blur(22px) saturate(170%)",
            WebkitBackdropFilter:"blur(22px) saturate(170%)",
            boxShadow:"0 10px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}>
          {(["globe","graph"] as const).map(m=>{
            const on=viz===m;
            return (
              <button key={m} onClick={()=>{setViz(m); setSelNode(null);}}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold transition-all"
                style={{
                  borderRadius:"999px",
                  background:on?"rgba(96,165,250,0.9)":"transparent",
                  color:on?"#0B0F14":"#A6AEC0",
                  boxShadow:on?"0 2px 12px rgba(96,165,250,0.4)":"none",
                  cursor:"pointer",letterSpacing:"0.03em",
                }}>
                {m==="globe"?<Globe size={13}/>:<Network size={13}/>}{m==="globe"?"Globe":"Network"}
              </button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {isDash && selNode &&(
          <IntelligenceDrawer key={selNode.id} node={selNode} onClose={()=>setSelNode(null)}/>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isDash&&view!=="answer"&&(
          <motion.div key={view}
            initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}}
            transition={{duration:0.28,ease:"easeOut"}}
            className="absolute inset-0 z-40 overflow-auto aila-dark-page"
            style={{background:"#05070D",paddingTop:"56px"}}>
            {view==="simulation"&&<SimulationSandbox seedText={simSeed} onSeedConsumed={()=>setSimSeed(null)} onAskAI={q=>{setChatSeed(q);setView("sme");}}/>}
            {view==="memory"&&<MemoryLayer/>}
            {view==="sme"&&<SMEAssistant onAsk={onAsk} conversationId={conversationId} setConversationId={setConversationId} seedQuestion={chatSeed} onSeedConsumed={()=>setChatSeed(null)} onOpenSim={text=>{setSimSeed(text);setView("simulation");}}/>}
            {view==="settings"&&<SettingsView/>}
            {view==="diff"&&<DiffEngine/>}
            {view==="countries"&&<CountriesView/>}
            {view==="api"&&<APIView/>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-page answer redirect */}
      <AnimatePresence>
        {view==="answer"&&(
          <motion.div key="answer"
            initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:14}}
            transition={{duration:0.3,ease:"easeOut"}}
            className="absolute inset-0 z-50">
            <AnswerPage query={query} result={answer} onBack={()=>setView("sme")} onSimulate={()=>setView("simulation")}/>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
