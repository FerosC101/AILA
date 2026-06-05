import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Network, GitBranch, FlaskConical, Database,
  Globe, MessageSquare, Code2, Settings, X,
  Brain,
  ChevronRight, Radio,
  Send,
  Link,
  FileText, Scale,
  Search, Menu, Heart, Share2, ChevronLeft, Eye, MessageCircle,
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

const CROSS_LINKS: Array<[string, string, EdgeType]> = [
  ["sg-pdpa", "ph-dpa", "precedent"],
  ["th-pdpa", "id-pdp", "precedent"],
  ["my-pdpa", "sg-pdpa", "precedent"],
  ["vn-csl", "th-cca", "precedent"],
  ["id-ojk", "sg-psa", "simulation"],
  ["ph-dpa", "my-pdpa", "amendment"],
];

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

// ==================== GRAPH INIT ====================
function initGraph(w: number, h: number): { nodes: GNode[]; edges: GEdge[] } {
  const sphere = Math.min(w, h) * 0.34;
  const nodes: GNode[] = [], edges: GEdge[] = [];
  const keys = Object.keys(COUNTRY_DATA);

  keys.forEach((key, i) => {
    const angle = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
    const data = COUNTRY_DATA[key];
    const nx = sphere * Math.cos(angle) * 0.9;
    const ny = sphere * Math.sin(angle * 1.3) * 0.45;
    const nz = sphere * Math.sin(angle) * 0.82;

    nodes.push({
      id: key, type: "country", label: data.name, flag: data.flag,
      x: nx + (Math.random()-.5)*16, y: ny + (Math.random()-.5)*16, z: nz + (Math.random()-.5)*24,
      vx: 0, vy: 0, vz: 0, radius: 26, color: data.color, glowColor: data.color,
      pulsePhase: Math.random() * Math.PI * 2,
      details: {
        category: "Jurisdiction", enacted: "N/A", status: "Active",
        clauses: 0, amendments: 0, coverage: data.name, confidence: 1,
        description: `${data.name} regulatory jurisdiction tracking ${data.regulations.length} active legislative instruments across digital trade and data governance.`,
        regulations: data.regulations.length, complianceScore: 0.75 + Math.random() * 0.22,
      },
    });

    data.regulations.forEach((reg, j) => {
      const ra = angle + (j - 1) * 0.68;
      const rr = 108;
      const rx = nx + rr * Math.cos(ra);
      const ry = ny + rr * Math.sin(ra) * 0.92;
      const rz = nz + rr * Math.sin(ra * 0.8) * 0.7;
      nodes.push({
        id: reg.id, type: "regulation", label: reg.label, shortLabel: reg.short,
        countryId: key,
        x: rx+(Math.random()-.5)*12, y: ry+(Math.random()-.5)*12, z: rz+(Math.random()-.5)*16,
        vx: 0, vy: 0, vz: 0, radius: 13, color: data.color, glowColor: data.color,
        pulsePhase: Math.random() * Math.PI * 2,
        details: {
          category: reg.category, enacted: reg.enacted, status: "Active",
          clauses: reg.clauses, amendments: reg.amendments, coverage: data.name,
          confidence: 0.83 + Math.random() * 0.15,
          description: `${reg.label} establishes the regulatory framework for ${reg.category.toLowerCase()} activities in ${data.name}, enforced by national agencies with cross-border implications.`,
        },
      });
      edges.push({
        id: `${key}-${reg.id}`, sourceId: key, targetId: reg.id, type: "cluster",
        particles: Array.from({length: 2}, () => ({ progress: Math.random(), speed: 0.0018+Math.random()*0.0025, opacity: 0.75 })),
      });
      for (let c = 0; c < 2; c++) {
        const ca = ra + (c-.5)*0.95, cr = 52, clId = `${reg.id}-c${c}`;
        nodes.push({
          id: clId, type: "clause", label: `§${c+1}`, countryId: key,
          x: rx+cr*Math.cos(ca)+(Math.random()-.5)*8,
          y: ry+cr*Math.sin(ca)*0.9+(Math.random()-.5)*8,
          z: rz+cr*Math.sin(ca*1.25)*0.42+(Math.random()-.5)*8,
          vx: 0, vy: 0, vz: 0, radius: 6, color: data.color, glowColor: "#22D3EE",
          pulsePhase: Math.random()*Math.PI*2,
        });
        edges.push({
          id: `${reg.id}-${clId}`, sourceId: reg.id, targetId: clId, type: "cluster",
          particles: [{progress: Math.random(), speed: 0.003+Math.random()*0.004, opacity: 0.5}],
        });
      }
    });
  });

  const vnCsl = nodes.find(n => n.id === "vn-csl")!;
  nodes.push({
    id: "vn-amend", type: "amendment", label: "CSL Amendment 2024", shortLabel: "Amend.",
    countryId: "vn", x: vnCsl.x+85, y: vnCsl.y-35, z: vnCsl.z+42, vx: 0, vy: 0, vz: 0, radius: 9,
    color: "#F59E0B", glowColor: "#F59E0B", pulsePhase: Math.random()*Math.PI*2, alerting: true,
    details: {
      category: "Amendment", enacted: "2024", status: "Proposed",
      clauses: 12, amendments: 0, coverage: "Vietnam", confidence: 0.91,
      description: "Proposed amendment expanding cross-border data flow restrictions and introducing mandatory AI audit requirements for digital platforms operating in Vietnam.",
    },
  });
  edges.push({ id: "vn-amend-e", sourceId: "vn-csl", targetId: "vn-amend", type: "amendment",
    particles: [{progress: Math.random(), speed: 0.005, opacity: 1}] });

  CROSS_LINKS.forEach(([s, t, type]) => {
    edges.push({ id: `x-${s}-${t}`, sourceId: s, targetId: t, type,
      particles: [{progress: Math.random(), speed: 0.0012, opacity: 0.9}] });
  });

  return { nodes, edges };
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

// Pillar palette — the two governance pillars get distinct hues; everything else grey.
const PILLAR_COLORS: Record<string, string> = {
  "Cross-border data policies": "#06B6D4",        // cyan
  "Domestic data protection & privacy": "#8B5CF6", // violet
};
const pillarColor = (name?: string) => (name && PILLAR_COLORS[name]) || "#94A3B8";
const pillarShort = (name: string) => name.replace(/ data policies| data protection.*/i, "").trim();

/** Convert the backend /graph payload into positioned GNode/GEdge (country → pillar → URL). */
function graphFromApi(payload: ApiGraph, w: number, h: number): { nodes: GNode[]; edges: GEdge[] } {
  const sphere = Math.min(w, h) * 0.34;
  const nodes: GNode[] = [], edges: GEdge[] = [];
  const jit = (m = 14) => (Math.random() - 0.5) * m;

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
    const ra = baseAngle + (n > 1 ? (idx / (n - 1) - 0.5) * 1.1 : 0);
    const rr = 52 + (idx % 3) * 14;
    nodes.push({
      id: r.id, type: "regulation", label: r.label, shortLabel: shortLabelFor(r.label),
      x: cx + rr * Math.cos(ra) + jit(), y: cy + rr * Math.sin(ra) * 0.9 + jit(), z: cz + rr * Math.sin(ra * 0.8) * 0.7 + jit(),
      vx: 0, vy: 0, vz: 0, radius: 10, color, glowColor: color, pulsePhase: Math.random() * Math.PI * 2,
      details: {
        category: r.coverage || "Regulation", enacted: r.timeframe || "N/A", status: "Active",
        clauses: r.policies?.length ?? 0, amendments: 0, coverage: r.country, confidence: 0.9,
        description: `${r.instrument}\n\nPillars: ${(r.pillars ?? []).join(", ") || "—"}\nPolicy focus: ${(r.policies ?? []).join("; ") || "—"}\nSource: ${r.url ?? ""}`,
      },
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
      radius: 26, color: "#64748B", glowColor: "#64748B", pulsePhase: Math.random() * Math.PI * 2,
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
      const pr = 96;
      const px = nx + pr * Math.cos(pa), py = ny + pr * Math.sin(pa) * 0.92, pz = nz + pr * Math.sin(pa * 0.8) * 0.7;
      const col = pillarColor(pl.pillar);
      nodes.push({
        id: pl.id, type: "pillar", label: pl.label, shortLabel: pillarShort(pl.label),
        countryId: c.id, x: px + jit(), y: py + jit(), z: pz + jit(), vx: 0, vy: 0, vz: 0,
        radius: 16, color: col, glowColor: col, pulsePhase: Math.random() * Math.PI * 2,
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

    // regulations with no pillar hang directly off the country hub (grey)
    regKids.forEach((r, j) => {
      placeReg(r, nx, ny, nz, angle, j, regKids.length, "#94A3B8");
      pushEdge(c.id, r.id);
    });
  });

  return { nodes, edges };
}

// ==================== FORCE SIMULATION ====================
function applyForces(nodes: GNode[], edges: GEdge[], w: number, h: number) {
  const radius = Math.min(w, h) * 0.34;
  const REP = 3900, CK = 0.07, XK = 0.016, GR = 0.00045, D = 0.88;
  nodes.forEach(n => {
    n.vx += (-n.x) * GR;
    n.vy += (-n.y) * GR;
    n.vz += (-n.z) * GR;
  });
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i+1; j < nodes.length; j++) {
      const dx=nodes[j].x-nodes[i].x, dy=nodes[j].y-nodes[i].y, dz=nodes[j].z-nodes[i].z;
      const d2=dx*dx+dy*dy+dz*dz||1, d=Math.sqrt(d2);
      if (d < (nodes[i].radius+nodes[j].radius+20)*3.5) {
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
    const rest=e.type==="cluster"?(s.type==="country"?122:62):265;
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
    const maxD = radius * 1.08;
    if (d > maxD) {
      const s = maxD / d;
      n.x *= s; n.y *= s; n.z *= s;
      n.vx *= 0.7; n.vy *= 0.7; n.vz *= 0.7;
    }
  });
}

// ==================== CANVAS DRAWING ====================
const EDGE_COLORS: Record<EdgeType, [string, number, number]> = {
  cluster:    ["148,163,184", 0.28, 0.6],
  precedent:  ["100,116,139", 0.4,  0.8],
  amendment:  ["71,85,105",   0.5,  1.0],
  simulation: ["148,163,184", 0.35, 0.8],
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
  view: GraphView
): Record<string, ProjNode> {
  ctx.clearRect(0,0,w,h);
  ctx.globalAlpha = dimmed ? 0.22 : 1;

  const projected = new Map<string, ProjNode>(nodes.map(n => [n.id, projectNode(n, w, h, view)]));

  // Dot grid — subtle dark dots on white
  ctx.fillStyle="rgba(15,23,42,0.05)";
  for (let x=0;x<w;x+=48) for (let y=0;y<h;y+=48) {
    ctx.beginPath(); ctx.arc(x,y,0.5,0,Math.PI*2); ctx.fill();
  }
  // Faint central vignette
  const cg=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,Math.min(w,h)*0.55);
  cg.addColorStop(0,"rgba(100,116,139,0.04)");
  cg.addColorStop(1,"transparent");
  ctx.fillStyle=cg; ctx.fillRect(0,0,w,h);

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

    // Clause nodes: micro dots, skip full pipeline
    if (n.type==="clause") {
      ctx.save();
      ctx.beginPath(); ctx.arc(pn.x,pn.y,Math.max(1.2,pn.r*0.42),0,Math.PI*2);
      ctx.fillStyle=h2r(NC,0.55);
      ctx.fill(); ctx.restore();
      return;
    }

    // Country: subtle breathing outer ring
    if (n.type==="country") {
      ctx.save();
      ctx.beginPath(); ctx.arc(pn.x,pn.y,pn.r+6+pulse*3,0,Math.PI*2);
      ctx.strokeStyle=h2r(NC_DARK,0.22+pulse*0.08); ctx.lineWidth=1; ctx.stroke();
      ctx.restore();
    }

    // Pillar: breathing ring in the pillar's colour
    if (n.type==="pillar") {
      ctx.save();
      ctx.beginPath(); ctx.arc(pn.x,pn.y,pn.r+5+pulse*3,0,Math.PI*2);
      ctx.strokeStyle=h2r(n.color,0.3+pulse*0.12); ctx.lineWidth=1; ctx.stroke();
      ctx.restore();
    }

    // Amendment: pulsing grey ring
    if (n.type==="amendment") {
      const ap=(Math.sin(time*0.008+n.pulsePhase)+1)/2;
      ctx.save();
      ctx.beginPath(); ctx.arc(pn.x,pn.y,pn.r+5+ap*4,0,Math.PI*2);
      ctx.strokeStyle=h2r(NC_DARK,0.18+ap*0.28); ctx.lineWidth=1; ctx.stroke();
      ctx.restore();
    }

    // Node fill — country grey, pillars & their regulations carry the pillar colour
    const accent = n.type==="country" ? NC_DARK : n.color;
    ctx.save();
    if (isS||isH) { ctx.shadowColor=h2r(accent,0.6); ctx.shadowBlur=isS?18:10; }
    ctx.beginPath(); ctx.arc(pn.x,pn.y,pn.r,0,Math.PI*2);
    if (n.type==="country") {
      const gr=ctx.createRadialGradient(pn.x-pn.r*0.28,pn.y-pn.r*0.28,0,pn.x,pn.y,pn.r);
      gr.addColorStop(0,lighten(NC_DARK,30)); gr.addColorStop(1,NC_DARK);
      ctx.fillStyle=gr;
    } else if (n.type==="pillar") {
      const gr=ctx.createRadialGradient(pn.x-pn.r*0.28,pn.y-pn.r*0.28,0,pn.x,pn.y,pn.r);
      gr.addColorStop(0,lighten(n.color,34)); gr.addColorStop(1,n.color);
      ctx.fillStyle=gr;
    } else if (n.type==="regulation") {
      ctx.fillStyle=h2r(n.color,isS||isH?0.95:0.72);
    } else {
      ctx.fillStyle=h2r(NC_DARK,0.85); // amendment: darker grey
    }
    ctx.fill();
    // Thin ring on everything except country
    if (n.type!=="country") {
      ctx.strokeStyle=h2r(accent,isS?1:isH?0.75:0.45);
      ctx.lineWidth=isS?1.5:0.8; ctx.stroke();
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

    // Obsidian-style labels: clean floating text, no pill background
    const isHub=n.type==="country"||n.type==="pillar";
    const showLabel=isHub||isH||isS;
    if (showLabel) {
      const label=n.shortLabel||n.label;
      const fs=n.type==="country"?11:n.type==="pillar"?10:9;
      ctx.save();
      ctx.font=`${isHub?"600 ":"400 "}${fs}px Inter, sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="top";
      ctx.shadowColor="rgba(255,255,255,0.9)"; ctx.shadowBlur=4;
      ctx.fillStyle=n.type==="country"?"#1E293B":n.type==="pillar"?n.color:"rgba(71,85,105,0.92)";
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
  const gr = useRef<GRef>({
    nodes:[], edges:[], hovId:null, dragId:null,
    selId:null, time:0, w:0, h:0, init:false, raf:0, dimmed:false,
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

  // Load the live graph (countries + scraped URL nodes) from the backend when configured.
  useEffect(()=>{
    const base = import.meta.env.VITE_AILA_API_BASE_URL?.trim();
    if (!base) return;
    let cancelled = false;
    fetch(`${base}/graph`)
      .then(r => r.json())
      .then((payload: ApiGraph) => {
        if (cancelled || !payload?.nodes?.length) return;
        const w = gr.current.w || window.innerWidth;
        const h = gr.current.h || window.innerHeight;
        const { nodes, edges } = graphFromApi(payload, w, h);
        gr.current.nodes = nodes;
        gr.current.edges = edges;
        gr.current.init = true;
      })
      .catch(() => {/* keep seed graph on failure */});
    return ()=>{ cancelled = true; };
  },[]);

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
      if (!gr.current.init&&w>0&&h>0) {
        const {nodes,edges}=initGraph(w,h);
        gr.current.nodes=nodes; gr.current.edges=edges; gr.current.init=true;
      }
    };
    setup();
    const ro=new ResizeObserver(setup); ro.observe(c.parentElement!);
    let tick=0;
    const loop=()=>{
      gr.current.time+=16; tick++;
      gr.current.edges.forEach(e=>e.particles.forEach(p=>{ p.progress+=p.speed; if(p.progress>1)p.progress=0; }));
      if (tick%2===0) applyForces(gr.current.nodes,gr.current.edges,gr.current.w,gr.current.h);
      gr.current.view.targetYaw += gr.current.rotateMode ? 0 : 0.00055;
      gr.current.view.yaw += (gr.current.view.targetYaw - gr.current.view.yaw) * 0.14;
      gr.current.view.pitch += (gr.current.view.targetPitch - gr.current.view.pitch) * 0.14;
      gr.current.view.zoom += (gr.current.view.targetZoom - gr.current.view.zoom) * 0.1;
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
          { yaw: gr.current.view.yaw, pitch: gr.current.view.pitch, zoom: gr.current.view.zoom }
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
  },[findNodeAt]);

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
    <canvas ref={cvs} className="absolute inset-0 w-full h-full"
      onMouseMove={onMove} onMouseDown={onDown} onMouseUp={onUp}
      onClick={onClick} onWheel={onWheel}
      onMouseLeave={()=>{gr.current.hovId=null; gr.current.rotateMode=false;}} />
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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex flex-col" style={{height:"56px"}}>
      <div style={{height:"3px",flexShrink:0,background:"linear-gradient(90deg,#1D4ED8 0%,#3B82F6 52%,#7C3AED 100%)"}}/>
      <div
        className="flex items-center flex-1 w-full px-6"
        style={{background:"#0D1F40",borderBottom:"1px solid rgba(255,255,255,0.07)"}}
      >
        <button onClick={() => onNav("dashboard")} className="flex items-center gap-3 shrink-0 mr-8">
          <img src="/src/assets/aila-logo-2.png" alt="AILA"
            style={{height:"27px",width:"auto",objectFit:"contain",filter:"brightness(1.1)"}}/>
          <span
            className="hidden md:block text-xs font-semibold tracking-widest uppercase pl-4 border-l"
            style={{color:"rgba(255,255,255,0.36)",borderColor:"rgba(255,255,255,0.14)",fontFamily:"IBM Plex Sans, sans-serif",letterSpacing:"0.12em"}}
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
                className="flex items-center gap-2 px-4 text-sm font-medium transition-colors h-full"
                style={{color:isA?"#93C5FD":"rgba(255,255,255,0.56)",borderBottom:isA?"2px solid #60A5FA":"2px solid transparent"}}
              >
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mx-4 shrink-0" style={{width:"1px",height:"20px",background:"rgba(255,255,255,0.12)"}} />

        <div ref={menuRef} className="relative shrink-0 h-full flex items-center">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-4 text-sm font-medium transition-colors h-full"
            style={{color:toolActive?"#93C5FD":"rgba(255,255,255,0.56)",borderBottom:toolActive?"2px solid #60A5FA":"2px solid transparent"}}
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
                className="absolute right-0 top-full w-64 rounded-lg py-1 z-50"
                style={{marginTop:"4px",background:"#FFFFFF",border:"1px solid #E2E8F0",boxShadow:"0 8px 28px rgba(0,0,0,0.2),0 2px 8px rgba(0,0,0,0.1)"}}
              >
                {TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  const isA = tool.id === "dashboard" ? isDash : cur === tool.id;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => { onNav(tool.id); setMenuOpen(false); }}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                      style={{borderLeft:`3px solid ${isA?"#1D4ED8":"transparent"}`}}
                    >
                      <Icon size={14} style={{color:isA?"#1D4ED8":"#94A3B8",marginTop:"2px",flexShrink:0}}/>
                      <div>
                        <div className="text-sm font-medium leading-tight" style={{color:isA?"#1D4ED8":"#1E293B"}}>
                          {tool.label}
                        </div>
                        <div className="text-xs mt-0.5" style={{color:"#94A3B8"}}>{tool.desc}</div>
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
  const [stats,setStats] = useState({regs:2847,amends:12,diffs:7,queue:23,aiConf:94.2,ragH:98.1,memGb:"142.7",conflicts:3,precedents:156});
  const [feedIdx,setFeedIdx] = useState(0);
  const [extraEvents,setExtraEvents] = useState<LiveEvent[]>([]);

  useEffect(()=>{
    if (!simulatedEvent) return;
    setExtraEvents(prev => [simulatedEvent, ...prev].slice(0, 6));
  },[simulatedEvent]);

  const mergedFeed = [...extraEvents, ...LIVE_EVENTS];
  useEffect(()=>{
    const t=setInterval(()=>{
      setStats(s=>({...s,
        regs:s.regs+(Math.random()>0.7?1:0),
        amends:Math.max(0,s.amends+(Math.random()>0.85?1:0)),
        diffs:Math.max(0,s.diffs+(Math.random()>0.9?1:0)),
        queue:Math.max(0,s.queue+Math.floor((Math.random()-.35)*5)),
        aiConf:Math.min(99.9,Math.max(84,s.aiConf+(Math.random()-.5)*0.8)),
        ragH:Math.min(99.9,Math.max(90,s.ragH+(Math.random()-.5)*0.4)),
      }));
      setFeedIdx(i=>(i+1)%Math.max(1, mergedFeed.length));
    },2800);
    return ()=>clearInterval(t);
  },[mergedFeed.length]);

  const feed=mergedFeed.slice(feedIdx,feedIdx+3).concat(mergedFeed.slice(0,Math.max(0,3-(mergedFeed.length-feedIdx))));
  const feedColors:{[k:string]:string}={alert:"#EF4444",diff:"#8B5CF6",verify:"#10B981",ingest:"#3B82F6",analysis:"#1D4ED8"};

  return <>
    {/* Top Left */}
    <motion.div initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:0.3,duration:0.5}}
      className="absolute top-20 left-4 w-56 z-40" style={PANEL_STYLE}>
      <PanelTitle>System Status</PanelTitle>
      <div className="p-3 space-y-2">
        <StatRow label="Active Jurisdictions" value="6 / 6" color="#10B981" dot="#10B981"/>
        <StatRow label="Regulations Tracked" value={stats.regs.toLocaleString()} color="#60A5FA"/>
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
            <div className="h-full rounded-full transition-all duration-700" style={{width:`${stats.ragH}%`,background:"linear-gradient(90deg,#3B82F680,#3B82F6)"}}/>
          </div>
        </div>
        <StatRow label="Change Detections" value={stats.diffs} color="#8B5CF6" dot="#8B5CF6"/>
        <StatRow label="Document Index" value={`${stats.memGb} GB`} color="#1D4ED8"/>
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
        <StatRow label="Active Simulations" value="2 running" color="#1D4ED8" dot="#1D4ED8"/>
        <StatRow label="Regulatory Conflicts" value={stats.conflicts} color={stats.conflicts>2?"#EF4444":"#F59E0B"} dot={stats.conflicts>0?"#EF4444":undefined}/>
        <StatRow label="Precedent Matches" value={stats.precedents} color="#8B5CF6"/>
        <div className="pt-2 border-t space-y-1.5" style={{borderColor:"rgba(0,0,0,0.06)"}}>
          {[{country:"PH Philippines",score:87,c:"#3B82F6"},{country:"SG Singapore",score:94,c:"#10B981"},{country:"VN Vietnam",score:71,c:"#EF4444"}].map(r=>(
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

// ==================== INTELLIGENCE DRAWER ====================
function IntelligenceDrawer({node,onClose,side="right"}:{node:GNode;onClose:()=>void;side?:"right"|"left"}) {
  const details=node.details;
  const isC=node.type==="country";
  const cd=node.countryId?COUNTRY_DATA[node.countryId]:null;
  const ci=isC?COUNTRY_DATA[node.id]:null;
  if (!details) return null;
  const conf=details.confidence;
  const confC=conf>0.9?"#10B981":conf>0.75?"#F59E0B":"#EF4444";

  return (
    <motion.div initial={{x:side==="right"?"100%":"-100%",opacity:0}} animate={{x:0,opacity:1}} exit={{x:side==="right"?"100%":"-100%",opacity:0}}
      transition={{type:"spring",damping:28,stiffness:220}}
      className={`absolute ${side==="right"?"right-0 border-l":"left-0 border-r"} top-0 bottom-0 w-80 z-50 overflow-y-auto flex flex-col`}
      style={{background:"rgba(255,255,255,0.97)",backdropFilter:"blur(24px)",borderColor:"rgba(0,0,0,0.08)",boxShadow:side==="right"?"-4px 0 24px rgba(0,0,0,0.08)":"4px 0 24px rgba(0,0,0,0.08)"}}>

      <div className="sticky top-0 z-10 flex items-start justify-between p-4 border-b"
        style={{borderColor:"rgba(0,0,0,0.07)",background:"rgba(255,255,255,0.99)"}}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {node.flag&&<span className="text-xl">{node.flag}</span>}
            <span className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded"
              style={{background:h2r(node.glowColor,0.14),color:node.glowColor,fontFamily:"IBM Plex Sans, sans-serif"}}>{node.type}</span>
            {node.alerting&&<span className="text-xs px-1.5 py-0.5 rounded animate-pulse" style={{background:"rgba(239,68,68,0.14)",color:"#EF4444"}}>ALERT</span>}
          </div>
          <h3 className="font-semibold text-sm leading-snug" style={{color:"#0F172A",fontFamily:"Inter, sans-serif"}}>{node.label}</h3>
          {cd&&!isC&&<p className="text-xs mt-0.5" style={{color:"#64748B"}}>{cd.flag} {cd.name}</p>}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md ml-2 transition-colors"
          style={{color:"#64748B"}} onMouseEnter={e=>(e.currentTarget.style.color="#0F172A")} onMouseLeave={e=>(e.currentTarget.style.color="#64748B")}>
          <X size={15}/>
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <p className="text-xs leading-relaxed" style={{color:"#475569"}}>{details.description}</p>

        <div className="grid grid-cols-2 gap-2">
          {[{l:"Category",v:details.category},{l:"Status",v:details.status,c:details.status==="Active"?"#10B981":details.status==="Proposed"?"#F59E0B":"#EF4444"},{l:"Enacted",v:details.enacted},{l:"Coverage",v:details.coverage}]
            .filter(m=>m.v&&m.v!=="N/A").map(m=>(
            <div key={m.l} className="rounded-lg p-2.5" style={{background:"rgba(0,0,0,0.02)",border:"1px solid rgba(0,0,0,0.07)"}}>
              <div className="text-xs mb-0.5" style={{color:"#64748B"}}>{m.l}</div>
              <div className="text-xs font-medium truncate" style={{color:(m as any).c||"#0F172A",fontFamily:"JetBrains Mono, monospace"}}>{m.v}</div>
            </div>
          ))}
        </div>

        {!isC&&(
          <div className="flex gap-3">
            {[{v:details.clauses,l:"Clauses",c:"#60A5FA",bg:"rgba(59,130,246,0.08)",br:"rgba(59,130,246,0.2)"},
              {v:details.amendments,l:"Amendments",c:"#F59E0B",bg:"rgba(245,158,11,0.08)",br:"rgba(245,158,11,0.2)"}].map(s=>(
              <div key={s.l} className="flex-1 rounded-lg p-2.5 text-center" style={{background:s.bg,border:`1px solid ${s.br}`}}>
                <div className="text-xl font-bold" style={{color:s.c,fontFamily:"JetBrains Mono, monospace"}}>{s.v}</div>
                <div className="text-xs mt-0.5" style={{color:"#64748B"}}>{s.l}</div>
              </div>
            ))}
          </div>
        )}

        {isC&&ci&&(
          <>
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg p-2.5 text-center" style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)"}}>
                <div className="text-xl font-bold" style={{color:"#60A5FA",fontFamily:"JetBrains Mono, monospace"}}>{ci.regulations.length}</div>
                <div className="text-xs mt-0.5" style={{color:"#64748B"}}>Regulations</div>
              </div>
              <div className="flex-1 rounded-lg p-2.5 text-center" style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)"}}>
                <div className="text-xl font-bold" style={{color:"#10B981",fontFamily:"JetBrains Mono, monospace"}}>{Math.round((details.complianceScore||0.85)*100)}%</div>
                <div className="text-xs mt-0.5" style={{color:"#64748B"}}>Compliance</div>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>Tracked Regulations</p>
              {ci.regulations.map(r=>(
                <div key={r.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{background:"rgba(0,0,0,0.025)",border:"1px solid rgba(0,0,0,0.06)"}}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:node.glowColor}}/>
                  <span className="text-xs flex-1 truncate" style={{color:"#374151"}}>{r.label}</span>
                  <span className="text-xs shrink-0" style={{color:"#64748B",fontFamily:"JetBrains Mono, monospace"}}>{r.clauses}§</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>AI Confidence</span>
            <span className="text-xs font-bold" style={{color:confC,fontFamily:"JetBrains Mono, monospace"}}>{(conf*100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{background:"rgba(0,0,0,0.07)"}}>
            <motion.div initial={{width:0}} animate={{width:`${conf*100}%`}} transition={{duration:0.9,delay:0.2}}
              className="h-full rounded-full" style={{background:`linear-gradient(90deg,${confC}70,${confC})`}}/>
          </div>
        </div>

        {!isC&&(
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>AI Reasoning Trace</p>
            <div className="rounded-lg p-3 space-y-2.5" style={{background:"rgba(139,92,246,0.04)",border:"1px solid rgba(139,92,246,0.14)"}}>
              {["Extracted from official government PDF portal","Semantic classification via RDTII taxonomy","Cross-referenced with regional precedent database","Compliance vector encoded to persistent memory","Citation graph updated — 3 new edges added"].map((s,i)=>(
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{background:"rgba(139,92,246,0.15)",border:"1px solid rgba(139,92,246,0.3)"}}>
                    <span style={{color:"#7C3AED",fontSize:"8px",fontWeight:700}}>{i+1}</span>
                  </div>
                  <span className="text-xs leading-snug" style={{color:"#475569"}}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {node.type==="regulation"&&details.amendments>0&&(
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>Amendment Timeline</p>
            {Array.from({length:Math.min(details.amendments,3)},(_,i)=>(
              <div key={i} className="flex items-start gap-2.5">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full mt-0.5" style={{background:"#F59E0B"}}/>
                  {i<Math.min(details.amendments,3)-1&&<div className="w-px flex-1 mt-1" style={{background:"rgba(245,158,11,0.25)",minHeight:"14px"}}/>}
                </div>
                <div>
                  <div className="text-xs font-medium" style={{color:"#0F172A",fontFamily:"JetBrains Mono, monospace"}}>{parseInt(details.enacted)+i+1}</div>
                  <div className="text-xs mt-0.5" style={{color:"#64748B"}}>{["Scope clarification and definitions update","Cross-border provision expansion","Enforcement mechanism revised","AI-specific obligations added"][i%4]}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isC&&(
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>Precedent Relationships</p>
            {Object.entries(COUNTRY_DATA).filter(([k])=>k!==node.countryId).slice(0,2).map(([k,d])=>{
              const rel=d.regulations.find(r=>r.category===details.category);
              if (!rel) return null;
              return (
                <div key={k} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                  style={{background:"rgba(139,92,246,0.04)",border:"1px solid rgba(139,92,246,0.12)"}}>
                  <span className="text-base">{d.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate" style={{color:"#374151"}}>{rel.label}</p>
                    <p className="text-xs" style={{color:"#64748B"}}>{d.name}</p>
                  </div>
                  <Link size={10} style={{color:"#8B5CF6"}}/>
                </div>
              );
            })}
          </div>
        )}
      </div>
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

function buildBriefMarkdown(query: string, selected: AseanCountryKey[]) {
  const now = new Date();
  const rows = ASEAN_TRANSFER_RULES.filter(r=>selected.includes(r.key));
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

  const runQuery=()=>{
    setRunning(true);
    setReady(false);
    // Simulate "populates in seconds".
    setTimeout(()=>{ setRunning(false); setReady(true); }, 1200);
  };

  const toggle=(k:AseanCountryKey)=>{
    setSelected(s=>s.includes(k)?s.filter(x=>x!==k):[...s,k]);
  };

  const rows=ASEAN_TRANSFER_RULES.filter(r=>selected.includes(r.key));

  const frictionColor = (f: TransferRule["friction"]) => f==="Low"?"#10B981":f==="Medium"?"#F59E0B":"#EF4444";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <GitBranch size={18} style={{color:"#8B5CF6"}}/>
          <h1 className="text-xl font-semibold" style={{color:"#0F172A",fontFamily:"Inter, sans-serif"}}>Country Comparison — Cross-Border Transfer</h1>
          <span className="text-xs px-2 py-0.5 rounded" style={{background:"rgba(139,92,246,0.14)",color:"#8B5CF6",border:"1px solid rgba(139,92,246,0.3)"}}>ESCAP Analyst Mode</span>
        </div>
        <p className="text-sm" style={{color:"#64748B"}}>
          Type one question, generate a comparison dashboard in seconds, and export a cited brief.
        </p>
      </div>

      <div className="rounded-xl p-4 mb-5" style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)"}}>
        <div className="flex items-center gap-3">
          <input value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&runQuery()}
            className="flex-1 rounded-lg px-4 py-3 text-sm outline-none"
            placeholder="Ask: Compare cross-border transfer rules across ASEAN..."
            style={{background:"#F8FAFC",border:"1px solid rgba(0,0,0,0.1)",color:"#0F172A"}}/>
          <button onClick={runQuery} disabled={running}
            className="px-4 py-3 rounded-lg text-sm font-medium transition-all"
            style={{background:running?"rgba(59,130,246,0.15)":"rgba(59,130,246,0.9)",border:"1px solid rgba(59,130,246,0.5)",color:running?"#60A5FA":"#fff"}}>
            {running?"Querying…":"Run"}
          </button>
          <button
            onClick={()=>downloadTextFile("asean-cross-border-transfer-brief.md", buildBriefMarkdown(query, selected))}
            disabled={!ready}
            className="px-4 py-3 rounded-lg text-sm font-medium transition-all"
            style={{background:ready?"rgba(16,185,129,0.1)":"rgba(0,0,0,0.03)",border:`1px solid ${ready?"rgba(16,185,129,0.35)":"rgba(0,0,0,0.1)"}`,color:ready?"#059669":"#64748B"}}>
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
                style={{background:on?"rgba(59,130,246,0.1)":"rgba(0,0,0,0.04)",border:`1px solid ${on?"rgba(59,130,246,0.3)":"rgba(0,0,0,0.1)"}`,color:on?"#1D4ED8":"#374151"}}>
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
        <div className="rounded-xl p-6 text-sm" style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",color:"#64748B"}}>
          Run a query to generate the ASEAN comparison dashboard.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-6 gap-2 mb-5">
            {["Low","Medium","High"].map((f,i)=>(
              <div key={f} className="col-span-2 rounded-xl p-3" style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)"}}>
                <div className="text-xs" style={{color:"#64748B"}}>Friction</div>
                <div className="text-lg font-bold" style={{color:f==="Low"?"#10B981":f==="Medium"?"#F59E0B":"#EF4444",fontFamily:"JetBrains Mono, monospace"}}>{f}</div>
                <div className="text-xs mt-1" style={{color:"#94A3B8"}}>
                  {rows.filter(r=>r.friction===f).length} jurisdictions
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden" style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)"}}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{borderColor:"rgba(0,0,0,0.06)"}}>
              <div>
                <p className="text-sm font-medium" style={{color:"#0F172A"}}>ASEAN cross-border transfer comparison</p>
                <p className="text-xs" style={{color:"#64748B",fontFamily:"JetBrains Mono, monospace"}}>{query}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded" style={{background:"rgba(59,130,246,0.1)",color:"#1D4ED8",border:"1px solid rgba(59,130,246,0.25)"}}>
                {rows.length} selected
              </span>
            </div>

            <div className="grid grid-cols-6 gap-0">
              {rows.map(r=>{
                const fc=frictionColor(r.friction);
                return (
                  <div key={r.key} className="col-span-3 border-r last:border-r-0" style={{borderColor:"rgba(0,0,0,0.07)"}}>
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{r.flag}</span>
                          <span className="text-sm font-semibold" style={{color:"#0F172A"}}>{r.name}</span>
                        </div>
                        <span className="text-xs px-2 py-1 rounded" style={{background:`${fc}22`,border:`1px solid ${fc}44`,color:fc,fontFamily:"JetBrains Mono, monospace"}}>
                          {r.friction}
                        </span>
                      </div>
                      <p className="text-xs mt-2" style={{color:"#94A3B8"}}>{r.summary}</p>

                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>Typical conditions</p>
                        <div className="mt-2 space-y-1.5">
                          {r.conditions.map((c,i)=>(
                            <div key={i} className="text-xs px-2.5 py-2 rounded-lg" style={{background:"#F8FAFC",border:"1px solid rgba(0,0,0,0.07)",color:"#374151"}}>
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>Citations</p>
                        <div className="mt-2 space-y-1.5">
                          {r.citations.map((c,i)=>(
                            <div key={i} className="text-xs px-2.5 py-2 rounded-lg" style={{background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.15)",color:"#6D28D9"}}>
                              <span style={{fontFamily:"JetBrains Mono, monospace"}}>{c.instrument}</span>
                              <span style={{color:"#64748B"}}> — {c.section}</span>
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

          <div className="rounded-xl p-4 mt-5" style={{background:"rgba(139,92,246,0.04)",border:"1px solid rgba(139,92,246,0.15)"}}>
            <div className="flex items-center gap-2 mb-3">
              <Brain size={14} style={{color:"#8B5CF6"}}/>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{color:"#8B5CF6",fontFamily:"IBM Plex Sans, sans-serif"}}>Automated analyst brief</span>
            </div>
            <p className="text-sm leading-relaxed" style={{color:"#475569"}}>
              This dashboard compresses what used to take weeks of manual legal review: collecting cross-border transfer clauses, normalizing them into comparable conditions, and producing a citation-ready brief for policy work.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ==================== SIMULATION SANDBOX ====================
function SimulationSandbox() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <FlaskConical size={18} style={{color:"#1D4ED8"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#0F172A"}}>Compliance Simulation Sandbox</h1>
      </div>
      <div className="rounded-xl p-4" style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)"}}>
        <p className="text-sm" style={{color:"#64748B"}}>
          Simulation view placeholder.
        </p>
      </div>
    </div>
  );
}

// ==================== SME ASSISTANT ====================

type RichSection = { heading: string; type: "success"|"warning"|"info"|"neutral"; bullets: string[] };
type RichCitation = { num: number; title: string; instrument: string; section: string; flag: string };
type RichResponse = { summary: string; verdict: { label: string; color: string; bg: string }; sections: RichSection[]; citations: RichCitation[]; tags: string[] };
type ChatMsg = { role: "ai"|"user"; text: string; rich?: RichResponse };

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

const RELATED_ARTICLES = [
  { source:"NPC Bulletin", cat:"Regulation", catColor:"#DC2626", date:"28 Mar 2024", title:"Cross-Border Data Transfers Under the Philippine Data Privacy Act", read:"6 min", grad:["#FEE2E2","#FECACA"] },
  { source:"ASEAN Privacy Review", cat:"Best Practice", catColor:"#EA580C", date:"14 Jan 2024", title:"Cloud Storage Compliance for Health-Tech Startups in Southeast Asia", read:"9 min", grad:["#FFEDD5","#FED7AA"] },
  { source:"Cloud Legal Journal", cat:"Advisory", catColor:"#2563EB", date:"30 Nov 2023", title:"AWS Singapore Region: Data Residency & Adequacy Considerations", read:"5 min", grad:["#DBEAFE","#BFDBFE"] },
];

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

function AnswerPage({ query, onBack }: { query: string; onBack: () => void }) {
  const r = SME_RICH_RESPONSE;
  const serif = "Georgia, 'Times New Roman', serif";
  const frictionColor:Record<string,string>={Low:"#10B981",Medium:"#F59E0B",High:"#EF4444"};
  const flagEmoji:Record<string,string>={SG:"🇸🇬",MY:"🇲🇾",TH:"🇹🇭",ID:"🇮🇩",VN:"🇻🇳",PH:"🇵🇭"};
  const others = ASEAN_TRANSFER_RULES.filter(x=>x.key!=="ph");
  const ph = ASEAN_TRANSFER_RULES.find(x=>x.key==="ph")!;
  const A = ARTICLE;

  return (
    <div style={{position:"absolute",inset:0,background:"#FFFFFF",overflowY:"auto",zIndex:50,fontFamily:"Inter, sans-serif"}}>
      {/* ===== DARK MASTHEAD ===== */}
      <div style={{background:"#1A1A1A",color:"#fff"}}>
        <div style={{maxWidth:"1080px",margin:"0 auto",padding:"16px 28px",display:"flex",alignItems:"center",gap:"16px"}}>
          <div style={{display:"flex",gap:"8px"}}>
            {["f","t","in"].map(s=>(
              <span key={s} style={{width:"24px",height:"24px",borderRadius:"50%",border:"1px solid rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",color:"rgba(255,255,255,0.7)"}}>{s}</span>
            ))}
          </div>
          <div style={{flex:1,textAlign:"center"}}>
            <span style={{fontFamily:serif,fontSize:"22px",fontWeight:700,letterSpacing:"0.01em"}}>AILA <span style={{fontWeight:400}}>Legal</span></span>
          </div>
          <button onClick={onBack} style={{fontSize:"11px",fontWeight:600,letterSpacing:"0.12em",color:"rgba(255,255,255,0.85)",background:"none",border:"1px solid rgba(255,255,255,0.3)",borderRadius:"4px",padding:"7px 16px",cursor:"pointer"}}>SIGN IN</button>
        </div>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.1)"}}>
          <div style={{maxWidth:"1080px",margin:"0 auto",padding:"12px 28px",display:"flex",alignItems:"center",gap:"16px"}}>
            <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.85)",display:"flex",alignItems:"center"}}><Menu size={18}/></button>
            <div style={{flex:1,display:"flex",justifyContent:"center",gap:"30px"}}>
              {["PRIVACY","FINTECH","AI","CROSS-BORDER","ADVISORIES"].map(t=>(
                <span key={t} style={{fontSize:"11px",fontWeight:600,letterSpacing:"0.1em",color:"rgba(255,255,255,0.7)",cursor:"default"}}>{t}</span>
              ))}
            </div>
            <Search size={16} style={{color:"rgba(255,255,255,0.7)"}}/>
          </div>
        </div>
      </div>

      {/* ===== HERO ===== */}
      <div style={{position:"relative",minHeight:"360px",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",background:"linear-gradient(135deg,#1E3A5F 0%,#2D6A8F 50%,#3B8EA5 100%)"}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(15,23,42,0.35),rgba(15,23,42,0.62))"}}/>
        <div style={{position:"relative",textAlign:"center",padding:"56px 28px",maxWidth:"760px"}}>
          <span style={{display:"inline-block",fontSize:"10px",fontWeight:700,letterSpacing:"0.18em",color:"#fff",border:"1px solid rgba(255,255,255,0.5)",borderRadius:"3px",padding:"5px 12px",marginBottom:"22px"}}>DATA PRIVACY</span>
          <h1 style={{fontFamily:serif,fontSize:"42px",lineHeight:1.18,fontWeight:700,color:"#fff",margin:"0 0 22px",letterSpacing:"-0.01em"}}>{query}</h1>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"22px",color:"rgba(255,255,255,0.85)",fontSize:"12px"}}>
            <span>{A.date}</span>
            <span style={{display:"inline-flex",alignItems:"center",gap:"6px"}}><Eye size={13}/> {A.views}</span>
            <span style={{display:"inline-flex",alignItems:"center",gap:"6px"}}><MessageCircle size={13}/> {CITED_PROVISIONS.length}</span>
            <span style={{display:"inline-flex",alignItems:"center",gap:"6px",border:"1px solid rgba(255,255,255,0.35)",borderRadius:"20px",padding:"4px 12px"}}><Share2 size={12}/> Share</span>
          </div>
        </div>
      </div>

      {/* ===== ARTICLE BODY ===== */}
      <div style={{maxWidth:"940px",margin:"0 auto",padding:"56px 28px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:"190px 1fr",gap:"44px",alignItems:"start"}}>
          {/* author card */}
          <aside style={{position:"sticky",top:"28px",textAlign:"center",borderRight:"1px solid rgba(15,23,42,0.08)",paddingRight:"24px"}}>
            <div style={{width:"72px",height:"72px",borderRadius:"50%",margin:"0 auto 14px",background:"linear-gradient(135deg,#1D4ED8,#3B82F6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:"22px",fontFamily:serif}}>{A.author.initials}</div>
            <p style={{fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#0F172A",margin:"0 0 3px"}}>{A.author.name}</p>
            <p style={{fontSize:"11px",color:"#94A3B8",margin:"0 0 14px"}}>{A.author.role}</p>
            <div style={{display:"flex",justifyContent:"center",gap:"8px",marginBottom:"16px"}}>
              {["f","t","in"].map(s=>(<span key={s} style={{width:"24px",height:"24px",borderRadius:"50%",border:"1px solid rgba(15,23,42,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",color:"#64748B"}}>{s}</span>))}
            </div>
            <span style={{display:"inline-block",fontSize:"10px",fontWeight:700,letterSpacing:"0.12em",color:"#1D4ED8",borderBottom:"1px solid rgba(29,78,216,0.3)",paddingBottom:"3px",marginBottom:"18px",cursor:"default"}}>ALL SOURCES</span>
            <div style={{fontSize:"10px",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",color:r.verdict.color,background:r.verdict.bg,padding:"6px 8px",borderRadius:"6px",lineHeight:1.4}}>{r.verdict.label}</div>
          </aside>

          {/* prose */}
          <div>
            <p style={{fontSize:"18px",lineHeight:1.7,color:"#1E293B",margin:"0 0 34px",fontFamily:serif}}>{A.lead}</p>
            {A.body.map((s,i)=>(
              <div key={i} style={{marginBottom:"30px"}}>
                <h2 style={{fontFamily:serif,fontSize:"21px",fontWeight:700,color:"#0F172A",margin:"0 0 12px"}}>{s.heading}</h2>
                {s.paras.map((p,j)=>(<p key={j} style={{fontSize:"15px",lineHeight:1.78,color:"#334155",margin:"0 0 14px"}}>{p}</p>))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== EXHIBIT: uploaded PDF + pull quote ===== */}
      <div style={{maxWidth:"940px",margin:"24px auto 0",padding:"0 28px"}}>
        <div style={{position:"relative"}}>
          {/* document exhibit */}
          <div style={{border:"1px solid rgba(15,23,42,0.12)",borderRadius:"6px",overflow:"hidden",background:"#0F172A"}}>
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
          <div style={{position:"absolute",top:"54px",left:"0",width:"190px",background:"#fff",border:"1px solid rgba(15,23,42,0.1)",borderRadius:"4px",padding:"18px 18px 16px",boxShadow:"0 16px 40px rgba(15,23,42,0.18)"}}>
            <p style={{fontFamily:serif,fontStyle:"italic",fontSize:"14px",lineHeight:1.55,color:"#1E293B",margin:"0 0 12px"}}>{A.pullQuote.text}</p>
            <p style={{fontSize:"10px",color:"#94A3B8",margin:0,lineHeight:1.4}}>{A.pullQuote.cite}</p>
          </div>
          {/* arrows */}
          <button style={{position:"absolute",left:"-18px",top:"50%",transform:"translateY(-50%)",width:"40px",height:"40px",borderRadius:"50%",background:"#fff",border:"1px solid rgba(15,23,42,0.12)",boxShadow:"0 6px 18px rgba(15,23,42,0.12)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><ChevronLeft size={18} style={{color:"#475569"}}/></button>
          <button style={{position:"absolute",right:"-18px",top:"50%",transform:"translateY(-50%)",width:"40px",height:"40px",borderRadius:"50%",background:"#fff",border:"1px solid rgba(15,23,42,0.12)",boxShadow:"0 6px 18px rgba(15,23,42,0.12)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><ChevronRight size={18} style={{color:"#475569"}}/></button>
        </div>
      </div>

      {/* ===== HISTORY / BACKGROUND ===== */}
      <div style={{maxWidth:"940px",margin:"0 auto",padding:"56px 28px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:"190px 1fr",gap:"44px",alignItems:"start"}}>
          {/* side thumb + caption */}
          <aside style={{textAlign:"left",borderRight:"1px solid rgba(15,23,42,0.08)",paddingRight:"24px"}}>
            <div style={{width:"100%",height:"110px",borderRadius:"4px",background:"linear-gradient(135deg,#E2E8F0,#CBD5E1)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"12px"}}>
              <Scale size={30} style={{color:"rgba(15,23,42,0.25)"}}/>
            </div>
            <p style={{fontSize:"11px",color:"#64748B",lineHeight:1.55,margin:"0 0 12px"}}>{A.history.sideCaption}</p>
            <span style={{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"10px",fontWeight:700,letterSpacing:"0.08em",color:"#1D4ED8",cursor:"default"}}><ChevronRight size={11}/> {A.history.sideLabel}</span>
          </aside>
          {/* text */}
          <div>
            <h2 style={{fontFamily:serif,fontSize:"21px",fontWeight:700,color:"#0F172A",margin:"0 0 12px"}}>Regulatory Background</h2>
            {A.history.paras.map((p,i)=>(<p key={i} style={{fontSize:"15px",lineHeight:1.78,color:"#334155",margin:"0 0 14px"}}>{p}</p>))}
            <h2 style={{fontFamily:serif,fontSize:"27px",fontWeight:700,color:"#0F172A",lineHeight:1.3,margin:"28px 0 16px",paddingBottom:"16px",borderBottom:"1px solid rgba(15,23,42,0.1)"}}>{A.history.heading}</h2>
            {/* callout */}
            <blockquote style={{margin:"24px 0",padding:"6px 0 6px 22px",borderLeft:"3px solid #1D4ED8"}}>
              <p style={{fontFamily:serif,fontStyle:"italic",fontSize:"19px",lineHeight:1.55,color:"#0F172A",margin:0}}>{A.callout}</p>
            </blockquote>
          </div>
        </div>
      </div>

      {/* ===== PENALTIES ===== */}
      <div style={{maxWidth:"940px",margin:"40px auto 0",padding:"0 28px"}}>
        <div style={{maxWidth:"706px",marginLeft:"auto"}}>
          <h2 style={{fontFamily:serif,fontSize:"21px",fontWeight:700,color:"#0F172A",margin:"0 0 16px"}}>Penalties Under the Act</h2>
          <div style={{border:"1px solid rgba(15,23,42,0.1)",borderRadius:"8px",overflow:"hidden"}}>
            {A.penalties.map((p,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:"14px",padding:"14px 16px",borderBottom:i<A.penalties.length-1?"1px solid rgba(15,23,42,0.07)":"none"}}>
                <span style={{fontSize:"11px",fontWeight:700,color:"#DC2626",fontFamily:"JetBrains Mono, monospace",minWidth:"34px"}}>{p.ref}</span>
                <span style={{flex:1,fontSize:"13.5px",color:"#1E293B"}}>{p.offense}</span>
                <span style={{fontSize:"12px",fontWeight:600,color:"#475569",textAlign:"right"}}>{p.penalty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== REGIONAL COMPARISON ===== */}
      <div style={{maxWidth:"940px",margin:"56px auto 0",padding:"0 28px"}}>
        <div style={{maxWidth:"706px",marginLeft:"auto"}}>
          <h2 style={{fontFamily:serif,fontSize:"21px",fontWeight:700,color:"#0F172A",margin:"0 0 6px"}}>How the Region Compares</h2>
          <p style={{fontSize:"14px",color:"#64748B",margin:"0 0 18px"}}>Cross-border transfer of sensitive data across ASEAN jurisdictions.</p>
          <div style={{border:"1.5px solid rgba(29,78,216,0.3)",borderRadius:"12px",padding:"15px 17px",marginBottom:"12px",background:"rgba(59,130,246,0.04)"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"7px"}}>
              <span style={{fontSize:"19px"}}>🇵🇭</span>
              <span style={{fontSize:"14px",fontWeight:700,color:"#0F172A"}}>{ph.name}</span>
              <span style={{fontSize:"10px",fontWeight:700,color:"#1D4ED8",background:"rgba(29,78,216,0.1)",padding:"2px 8px",borderRadius:"20px",letterSpacing:"0.05em"}}>YOUR JURISDICTION</span>
              <div style={{flex:1}}/>
              <span style={{fontSize:"11px",fontWeight:700,color:frictionColor[ph.friction]}}>{ph.friction} friction</span>
            </div>
            <p style={{fontSize:"13px",color:"#475569",margin:0,lineHeight:1.55}}>{ph.summary}</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            {others.map(c=>(
              <div key={c.key} style={{border:"1px solid rgba(15,23,42,0.09)",borderRadius:"12px",padding:"14px",background:"#fff"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"7px"}}>
                  <span style={{fontSize:"16px"}}>{flagEmoji[c.flag]}</span>
                  <span style={{fontSize:"13px",fontWeight:700,color:"#0F172A"}}>{c.name}</span>
                  <div style={{flex:1}}/>
                  <span style={{fontSize:"10px",fontWeight:700,color:frictionColor[c.friction],background:frictionColor[c.friction]+"14",padding:"2px 8px",borderRadius:"20px"}}>{c.friction}</span>
                </div>
                <p style={{fontSize:"12px",color:"#64748B",margin:0,lineHeight:1.55}}>{c.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== TAGS + ACTIONS ===== */}
      <div style={{maxWidth:"940px",margin:"48px auto 0",padding:"0 28px"}}>
        <div style={{maxWidth:"706px",marginLeft:"auto"}}>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"20px"}}>
            {A.tags.map(t=>(<span key={t} style={{fontSize:"10px",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:"#64748B",border:"1px solid rgba(15,23,42,0.14)",borderRadius:"4px",padding:"5px 10px"}}>{t}</span>))}
          </div>
          <div style={{display:"flex",gap:"10px"}}>
            <button style={{display:"inline-flex",alignItems:"center",gap:"7px",fontSize:"12px",fontWeight:600,color:"#64748B",background:"#fff",border:"1px solid rgba(15,23,42,0.14)",borderRadius:"24px",padding:"8px 16px",cursor:"pointer"}}><Heart size={14}/> Like <span style={{color:"#CBD5E1"}}>· 13</span></button>
            <button style={{display:"inline-flex",alignItems:"center",gap:"7px",fontSize:"12px",fontWeight:600,color:"#fff",background:"#1877F2",border:"none",borderRadius:"24px",padding:"8px 18px",cursor:"pointer"}}><Share2 size={14}/> Share</button>
            <button style={{display:"inline-flex",alignItems:"center",gap:"7px",fontSize:"12px",fontWeight:600,color:"#fff",background:"#0EA5E9",border:"none",borderRadius:"24px",padding:"8px 18px",cursor:"pointer"}}><Share2 size={14}/> Tweet</button>
          </div>
        </div>
      </div>

      {/* ===== CITED PROVISIONS (notes) ===== */}
      <div style={{background:"#F4F5F7",marginTop:"56px",borderTop:"1px solid rgba(15,23,42,0.06)"}}>
        <div style={{maxWidth:"820px",margin:"0 auto",padding:"44px 28px 52px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",marginBottom:"32px"}}>
            <h2 style={{fontFamily:serif,fontSize:"22px",fontWeight:700,color:"#0F172A",margin:0}}>Cited Provisions</h2>
            <span style={{fontSize:"12px",fontWeight:700,color:"#fff",background:"#1D4ED8",borderRadius:"50%",width:"22px",height:"22px",display:"flex",alignItems:"center",justifyContent:"center"}}>{CITED_PROVISIONS.length}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
            {CITED_PROVISIONS.map((c,i)=>(
              <div key={i} style={{display:"flex",gap:"14px"}}>
                <div style={{width:"38px",height:"38px",borderRadius:"50%",background:"#fff",border:"1px solid rgba(15,23,42,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0}}>{c.flag}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"5px"}}>
                    <span style={{fontSize:"12px",fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",color:"#0F172A"}}>{c.src}</span>
                    <span style={{fontSize:"11px",color:"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>{c.date}</span>
                  </div>
                  <p style={{fontSize:"14px",lineHeight:1.65,color:"#475569",margin:"0 0 6px",fontFamily:serif}}>{c.note}</p>
                  <span style={{fontSize:"10px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#1D4ED8",cursor:"default"}}>View Source</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== RELATED ANALYSIS (dark) ===== */}
      <div style={{background:"#1F2937"}}>
        <div style={{maxWidth:"1080px",margin:"0 auto",padding:"48px 28px 56px"}}>
          <h2 style={{fontFamily:serif,fontSize:"22px",fontWeight:700,color:"#fff",textAlign:"center",margin:"0 0 32px"}}>Related Analysis</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"22px"}}>
            {RELATED_ARTICLES.map((a,i)=>(
              <a key={i} href="#" onClick={e=>e.preventDefault()} style={{display:"block",textDecoration:"none",borderRadius:"8px",overflow:"hidden",background:"#fff"}}>
                <div style={{height:"130px",background:"linear-gradient(135deg,"+a.grad[0]+","+a.grad[1]+")",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                  <FileText size={34} style={{color:"rgba(15,23,42,0.18)"}}/>
                  <span style={{position:"absolute",top:"12px",left:"12px",fontSize:"10px",fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:"#fff",background:a.catColor,padding:"4px 9px",borderRadius:"4px"}}>{a.cat}</span>
                </div>
                <div style={{padding:"16px 18px 18px"}}>
                  <h3 style={{fontFamily:serif,fontSize:"16px",fontWeight:700,color:"#0F172A",margin:"0 0 12px",lineHeight:1.4}}>{a.title}</h3>
                  <span style={{display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"11px",fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:a.catColor}}>Read More <ChevronRight size={13}/></span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <div style={{background:"#111827",color:"rgba(255,255,255,0.7)"}}>
        <div style={{maxWidth:"1080px",margin:"0 auto",padding:"28px",display:"flex",alignItems:"center",gap:"24px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <span style={{fontFamily:serif,fontSize:"18px",fontWeight:700,color:"#fff"}}>AILA Legal</span>
          <div style={{flex:1,display:"flex",gap:"24px"}}>
            {["PRIVACY","FINTECH","AI","CROSS-BORDER","ADVISORIES"].map(t=>(<span key={t} style={{fontSize:"11px",fontWeight:600,letterSpacing:"0.08em"}}>{t}</span>))}
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            {["f","t","in"].map(s=>(<span key={s} style={{width:"24px",height:"24px",borderRadius:"50%",border:"1px solid rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px"}}>{s}</span>))}
          </div>
        </div>
        <div style={{maxWidth:"1080px",margin:"0 auto",padding:"28px",display:"flex",alignItems:"center",justifyContent:"center",gap:"14px"}}>
          <span style={{fontSize:"13px",color:"rgba(255,255,255,0.8)"}}>Subscribe to regulatory alerts</span>
          <input placeholder="Your email address" style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"6px",padding:"9px 14px",fontSize:"13px",color:"#fff",outline:"none",width:"240px"}}/>
          <button onClick={onBack} style={{fontSize:"12px",fontWeight:700,letterSpacing:"0.08em",color:"#fff",background:"#1D4ED8",border:"none",borderRadius:"6px",padding:"10px 20px",cursor:"pointer"}}>SIGN UP</button>
        </div>
      </div>
    </div>
  );
}

function SMEAssistant({ onAsk }: { onAsk: (q: string) => void }) {
  const [msgs,setMsgs]=useState<ChatMsg[]>(INIT_MSGS);
  const [input,setInput]=useState("");
  const [pending,setPending]=useState(false);
  const end=useRef<HTMLDivElement>(null);
  useEffect(()=>{ end.current?.scrollIntoView({behavior:"smooth"}); },[msgs,pending]);

  const send=()=>{
    if (!input.trim()||pending) return;
    const q=input.trim();
    setInput("");
    setMsgs(m=>[...m,{role:"user",text:q}]);
    setPending(true);
    // brief "analyzing" beat, then redirect to the full answer page
    setTimeout(()=>{ setPending(false); onAsk(q); },1400);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col" style={{height:"calc(100vh - 56px)"}}>
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare size={18} style={{color:"#3B82F6"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#0F172A"}}>Legal Research Assistant</h1>
        <div className="ml-auto flex items-center gap-2 text-xs px-2.5 py-1 rounded-full"
          style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)",color:"#10B981"}}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>ASEAN corpus loaded
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {["Can I store health data offshore?","Cross-border transfer rules","Fintech licensing in SG","AI regulation requirements"].map(q=>(
          <button key={q} onClick={()=>setInput(q)}
            className="text-xs px-3 py-1.5 rounded-full transition-colors"
            style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",color:"#1D4ED8"}}>
            {q}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1" style={{minHeight:0}}>
        {msgs.map((m,i)=>(
          <div key={i} className={`flex gap-3 ${m.role==="user"?"justify-end":""}`}>
            {m.role==="ai"&&(
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)"}}>
                <Brain size={13} style={{color:"#60A5FA"}}/>
              </div>
            )}
            <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role==="user"?"max-w-sm rounded-tr-sm":"max-w-lg rounded-tl-sm"}`}
              style={{background:m.role==="user"?"rgba(30,64,175,0.07)":"#ffffff",border:`1px solid ${m.role==="user"?"rgba(30,64,175,0.15)":"rgba(0,0,0,0.07)"}`,color:"#1E293B"}}>
              {m.text}
            </div>
          </div>
        ))}
        {pending&&(
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.3)"}}>
              <Brain size={13} style={{color:"#60A5FA"}}/>
            </div>
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex items-center gap-2.5"
              style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",color:"#64748B"}}>
              <span style={{display:"flex",gap:"3px",alignItems:"center"}}>
                {[0,1,2].map(k=>(
                  <span key={k} style={{width:"5px",height:"5px",borderRadius:"50%",background:"#60A5FA",display:"inline-block",animation:`pulse 1.2s ease-in-out ${k*0.2}s infinite`}}/>
                ))}
              </span>
              Researching ASEAN corpus & your documents…
            </div>
          </div>
        )}
        <div ref={end}/>
      </div>

      <div className="mt-4 flex gap-2">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Ask about regulatory requirements, compliance obligations, or specific laws..."
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
          style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.1)",color:"#0F172A",fontFamily:"Inter, sans-serif"}}/>
        <button onClick={send}
          className="px-4 py-3 rounded-xl flex items-center justify-center"
          style={{background:"#1D4ED8",border:"1px solid rgba(29,78,216,0.5)"}}>
          <Send size={16} style={{color:"#fff"}}/>
        </button>
      </div>
    </div>
  );
}

// ==================== COUNTRIES VIEW ====================
function CountriesView() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Globe size={18} style={{color:"#1D4ED8"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#0F172A"}}>Jurisdiction Overview</h1>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(COUNTRY_DATA).map(([key,data])=>{
          const score=Math.floor(75+Math.random()*22);
          const amends=data.regulations.reduce((a,r)=>a+r.amendments,0);
          return (
            <div key={key} className="rounded-xl p-4 transition-all"
              style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)",cursor:"pointer"}}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{data.flag}</span>
                <div>
                  <h3 className="font-semibold text-sm" style={{color:"#0F172A"}}>{data.name}</h3>
                  <p className="text-xs" style={{color:"#64748B"}}>{data.regulations.length} regulations tracked</p>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-lg font-bold" style={{color:data.color,fontFamily:"JetBrains Mono, monospace"}}>{score}%</div>
                  <div className="text-xs" style={{color:"#64748B"}}>compliance</div>
                </div>
              </div>
              <div className="h-1 rounded-full overflow-hidden mb-3" style={{background:"rgba(0,0,0,0.07)"}}>
                <div className="h-full rounded-full" style={{width:`${score}%`,background:data.color}}/>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[{l:"Regulations",v:data.regulations.length},{l:"Amendments",v:amends},{l:"Clauses",v:data.regulations.reduce((a,r)=>a+r.clauses,0)}].map(s=>(
                  <div key={s.l} className="text-center">
                    <div className="text-sm font-bold" style={{color:"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>{s.v}</div>
                    <div className="text-xs" style={{color:"#64748B"}}>{s.l}</div>
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
function MemoryLayer() {
  const events=[
    {flag:"VN",label:"VN Cybersecurity Law — Amendment 2024",cat:"Amendment",date:"2024-02-28",size:"2.3 MB",c:"#EF4444"},
    {flag:"SG",label:"SG PDPA — Updated Prescribed Periods",cat:"Regulation",date:"2024-01-15",size:"1.1 MB",c:"#10B981"},
    {flag:"PH",label:"PH DPA — NPC Advisory No. 2023-01",cat:"Advisory",date:"2023-11-30",size:"0.8 MB",c:"#3B82F6"},
    {flag:"ID",label:"ID PDP Law — Full Implementation Text",cat:"Regulation",date:"2023-10-17",size:"4.7 MB",c:"#8B5CF6"},
    {flag:"TH",label:"TH Computer Crimes Act — Third Amendment",cat:"Amendment",date:"2023-08-22",size:"1.4 MB",c:"#F59E0B"},
    {flag:"MY",label:"MY PDPA — Proposed Amendments 2023",cat:"Draft",date:"2023-07-01",size:"2.1 MB",c:"#22D3EE"},
    {flag:"SG",label:"SG Payment Services Act — MAS Notice PSN02",cat:"Notice",date:"2023-05-14",size:"0.5 MB",c:"#10B981"},
  ];
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database size={18} style={{color:"#8B5CF6"}}/>
          <h1 className="text-xl font-semibold" style={{color:"#0F172A"}}>Regulatory Memory Layer</h1>
        </div>
        <div className="flex gap-3 text-xs">
          {[{l:"Total Documents",v:"2,847"},{l:"Memory Size",v:"142.7 GB"},{l:"Retrieval Speed",v:"84ms avg"}].map(s=>(
            <div key={s.l} className="text-center px-3 py-1.5 rounded-lg" style={{background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.18)"}}>
              <div className="font-bold" style={{color:"#A78BFA",fontFamily:"JetBrains Mono, monospace"}}>{s.v}</div>
              <div style={{color:"#64748B"}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {events.map((e,i)=>(
          <motion.div key={i} initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}
            className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all"
            style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)",cursor:"pointer"}}>
            <div className="flex items-center gap-2 w-8">
              <div className="w-2 h-2 rounded-full shrink-0" style={{background:e.c}}/>
            </div>
            <span className="text-xl">{e.flag}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{color:"#0F172A"}}>{e.label}</p>
              <p className="text-xs" style={{color:"#64748B"}}>{e.cat} · Ingested {e.date}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{background:"#F1F5F9",color:"#64748B",fontFamily:"JetBrains Mono, monospace"}}>{e.size}</span>
            <ChevronRight size={14} style={{color:"#64748B"}}/>
          </motion.div>
        ))}
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
  const mc:{[k:string]:string}={GET:"#10B981",POST:"#3B82F6",DELETE:"#EF4444"};

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Code2 size={18} style={{color:"#1D4ED8"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#0F172A"}}>API Reference</h1>
        <span className="text-xs px-2 py-0.5 rounded" style={{background:"rgba(59,130,246,0.1)",color:"#1D4ED8",border:"1px solid rgba(59,130,246,0.25)"}}>v1.4.2</span>
      </div>

      <div className="rounded-xl mb-4 p-4" style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)"}}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>Authentication</p>
        <div className="rounded-lg px-3 py-2" style={{background:"#F8FAFC",border:"1px solid rgba(0,0,0,0.08)"}}>
          <code className="text-xs" style={{color:"#0891B2",fontFamily:"JetBrains Mono, monospace"}}>
            Authorization: Bearer {"<YOUR_AILA_API_KEY>"}
          </code>
        </div>
      </div>

      <div className="space-y-2">
        {endpoints.map((e,i)=>(
          <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.07)"}}>
            <span className="text-xs font-bold w-12 shrink-0 mt-0.5" style={{color:mc[e.method]||"#374151",fontFamily:"JetBrains Mono, monospace"}}>{e.method}</span>
            <code className="text-xs shrink-0 w-52" style={{color:"#374151",fontFamily:"JetBrains Mono, monospace"}}>{e.path}</code>
            <span className="text-xs" style={{color:"#64748B"}}>{e.desc}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl p-4" style={{background:"#F8FAFC",border:"1px solid rgba(0,0,0,0.08)"}}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>Example Request</p>
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
        <Settings size={18} style={{color:"#64748B"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#0F172A"}}>System Configuration</h1>
      </div>
      <div className="space-y-4">
        {[
          {title:"AI Engine",items:[
            {l:"Model",v:<select value={vals.aiModel} onChange={e=>setVals(v=>({...v,aiModel:e.target.value}))} className="rounded px-2 py-1 text-xs outline-none" style={{background:"#F8FAFC",border:"1px solid rgba(0,0,0,0.1)",color:"#374151"}}><option value="claude-sonnet-4-6">Claude Sonnet 4.6</option><option value="claude-opus-4-7">Claude Opus 4.7</option></select>},
            {l:"Semantic Diff Engine",v:<button onClick={()=>toggle("semanticDiff")} className="w-9 h-5 rounded-full transition-colors relative" style={{background:vals.semanticDiff?"#1D4ED8":"#E2E8F0"}}><span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{background:"#fff",left:vals.semanticDiff?"calc(100% - 18px)":"2px"}}/></button>},
          ]},
          {title:"Crawler Settings",items:[
            {l:"Crawl Interval",v:<select value={vals.crawlInterval} onChange={e=>setVals(v=>({...v,crawlInterval:e.target.value}))} className="rounded px-2 py-1 text-xs outline-none" style={{background:"#F8FAFC",border:"1px solid rgba(0,0,0,0.1)",color:"#374151"}}><option value="1h">Every 1 hour</option><option value="6h">Every 6 hours</option><option value="24h">Daily</option></select>},
            {l:"Auto Memory Growth",v:<button onClick={()=>toggle("memoryAuto")} className="w-9 h-5 rounded-full transition-colors relative" style={{background:vals.memoryAuto?"#1D4ED8":"#E2E8F0"}}><span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{background:"#fff",left:vals.memoryAuto?"calc(100% - 18px)":"2px"}}/></button>},
          ]},
          {title:"Notifications",items:[
            {l:"Amendment Alerts",v:<button onClick={()=>toggle("notifications")} className="w-9 h-5 rounded-full transition-colors relative" style={{background:vals.notifications?"#1D4ED8":"#E2E8F0"}}><span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{background:"#fff",left:vals.notifications?"calc(100% - 18px)":"2px"}}/></button>},
          ]},
        ].map(section=>(
          <div key={section.title} className="rounded-xl overflow-hidden" style={{background:"#ffffff",border:"1px solid rgba(0,0,0,0.08)"}}>
            <div className="px-4 py-2.5 border-b" style={{borderColor:"rgba(0,0,0,0.06)"}}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>{section.title}</p>
            </div>
            {section.items.map(item=>(
              <div key={item.l} className="flex items-center justify-between px-4 py-3 border-b last:border-0"
                style={{borderColor:"rgba(0,0,0,0.05)"}}>
                <span className="text-sm" style={{color:"#374151"}}>{item.l}</span>
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
export default function App() {
  const [view,setView]=useState<ViewId>("dashboard");
  const [selNode,setSelNode]=useState<GNode|null>(null);
  const [query,setQuery]=useState("");
  const isDash=view==="dashboard"||view==="graph";

  const onNav=(v:ViewId)=>{
    setView(v);
    if (v==="dashboard"||v==="graph") setSelNode(null);
  };

  const onAsk=(q:string)=>{ setQuery(q); setView("answer"); };

  const onGraphSelect=(n:GNode|null)=>{
    if (!isDash) return;
    setSelNode(n);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{background:"#FFFFFF",fontFamily:"Inter, sans-serif"}}>
      <RegulatoryGraph onSelect={onGraphSelect} selId={selNode?.id||null} dimmed={!isDash} simulateAction={{tick:0,step:"crawler"}}/>

      <TopNav cur={view} onNav={onNav}/>

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
            className="absolute inset-0 z-40 overflow-auto"
            style={{background:"rgba(248,250,252,0.99)",paddingTop:"56px"}}>
            {view==="simulation"&&<SimulationSandbox/>}
            {view==="memory"&&<MemoryLayer/>}
            {view==="sme"&&<SMEAssistant onAsk={onAsk}/>}
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
            <AnswerPage query={query} onBack={()=>setView("sme")}/>
          </motion.div>
        )}
      </AnimatePresence>

      {isDash && !selNode &&(
        <div className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 pointer-events-none select-none text-center"
          style={{opacity:0.5}}>
          <p className="text-xs tracking-widest uppercase" style={{color:"rgba(100,116,139,0.7)",fontFamily:"IBM Plex Sans, sans-serif"}}>
            Click any node to inspect · Drag to rotate · Scroll to zoom
          </p>
        </div>
      )}
    </div>
  );
}
