import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard, Network, GitBranch, FlaskConical, Database,
  Globe, MessageSquare, Code2, Settings, X, AlertTriangle,
  CheckCircle2, Zap, Brain, FileText, Activity, Shield,
  ChevronRight, Clock, TrendingUp, Eye, Cpu, Radio,
  ArrowRight, Terminal, Server, Wifi, BarChart3,
  Send, Sparkles, Lock, BookOpen, Filter, RefreshCw,
  Layers, Link, Search, Bell, User, Play,
} from "lucide-react";

// ==================== TYPES ====================
type ViewId = "dashboard" | "graph" | "diff" | "simulation" | "memory" | "countries" | "sme" | "api" | "settings";
type NodeType = "country" | "regulation" | "clause" | "amendment";
type EdgeType = "cluster" | "precedent" | "amendment" | "simulation";

interface GNode {
  id: string;
  type: NodeType;
  label: string;
  shortLabel?: string;
  flag?: string;
  countryId?: string;
  x: number; y: number;
  vx: number; vy: number;
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

// ==================== DATA ====================
const COUNTRY_DATA: Record<string, {
  name: string; flag: string; color: string;
  regulations: Array<{ id: string; label: string; short: string; category: string; clauses: number; amendments: number; enacted: string; }>;
}> = {
  ph: { name: "Philippines", flag: "PH", color: "#3B82F6", regulations: [
    { id: "ph-dpa", label: "Data Privacy Act", short: "DPA", category: "Data Protection", clauses: 48, amendments: 3, enacted: "2012" },
    { id: "ph-eca", label: "E-Commerce Act", short: "ECA", category: "Digital Commerce", clauses: 32, amendments: 1, enacted: "2000" },
    { id: "ph-cpa", label: "Cybercrime Prevention", short: "CPA", category: "Cybersecurity", clauses: 21, amendments: 2, enacted: "2012" },
  ]},
  sg: { name: "Singapore", flag: "SG", color: "#10B981", regulations: [
    { id: "sg-pdpa", label: "Personal Data Protection Act", short: "PDPA", category: "Data Protection", clauses: 65, amendments: 5, enacted: "2012" },
    { id: "sg-psa", label: "Payment Services Act", short: "PSA", category: "Fintech", clauses: 43, amendments: 2, enacted: "2019" },
    { id: "sg-cma", label: "Computer Misuse Act", short: "CMA", category: "Cybersecurity", clauses: 18, amendments: 4, enacted: "1993" },
  ]},
  vn: { name: "Vietnam", flag: "VN", color: "#EF4444", regulations: [
    { id: "vn-csl", label: "Cybersecurity Law", short: "CSL", category: "Cybersecurity", clauses: 43, amendments: 1, enacted: "2018" },
    { id: "vn-dpd", label: "Decree 13 Personal Data", short: "DPD", category: "Data Protection", clauses: 38, amendments: 0, enacted: "2023" },
    { id: "vn-ecd", label: "E-Commerce Decree", short: "ECD", category: "Digital Commerce", clauses: 54, amendments: 3, enacted: "2013" },
  ]},
  th: { name: "Thailand", flag: "TH", color: "#F59E0B", regulations: [
    { id: "th-pdpa", label: "PDPA B.E. 2562", short: "PDPA", category: "Data Protection", clauses: 96, amendments: 2, enacted: "2019" },
    { id: "th-cca", label: "Computer Crimes Act", short: "CCA", category: "Cybersecurity", clauses: 29, amendments: 3, enacted: "2007" },
    { id: "th-eta", label: "Electronic Transactions Act", short: "ETA", category: "Digital Commerce", clauses: 41, amendments: 1, enacted: "2001" },
  ]},
  id: { name: "Indonesia", flag: "ID", color: "#8B5CF6", regulations: [
    { id: "id-pdp", label: "Personal Data Protection Law", short: "PDP", category: "Data Protection", clauses: 76, amendments: 0, enacted: "2022" },
    { id: "id-gr71", label: "GR 71/2019 E-Commerce", short: "GR71", category: "Digital Commerce", clauses: 23, amendments: 1, enacted: "2019" },
    { id: "id-ojk", label: "OJK Fintech Regulation", short: "OJK", category: "Fintech", clauses: 34, amendments: 4, enacted: "2016" },
  ]},
  my: { name: "Malaysia", flag: "MY", color: "#22D3EE", regulations: [
    { id: "my-pdpa", label: "Personal Data Protection Act", short: "PDPA", category: "Data Protection", clauses: 44, amendments: 2, enacted: "2010" },
    { id: "my-cma", label: "Communications & Multimedia Act", short: "CMA", category: "Telecom", clauses: 212, amendments: 8, enacted: "1998" },
    { id: "my-dst", label: "Digital Services Tax", short: "DST", category: "Digital Tax", clauses: 18, amendments: 1, enacted: "2019" },
  ]},
};

const CROSS_LINKS: Array<[string, string, EdgeType]> = [
  ["sg-pdpa", "ph-dpa", "precedent"],
  ["th-pdpa", "id-pdp", "precedent"],
  ["my-pdpa", "sg-pdpa", "precedent"],
  ["vn-csl", "th-cca", "precedent"],
  ["id-ojk", "sg-psa", "simulation"],
  ["ph-dpa", "my-pdpa", "amendment"],
];

const LIVE_EVENTS = [
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
  const cx = w / 2, cy = h / 2;
  const ring = Math.min(w, h) * 0.27;
  const nodes: GNode[] = [], edges: GEdge[] = [];
  const keys = Object.keys(COUNTRY_DATA);

  keys.forEach((key, i) => {
    const angle = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
    const data = COUNTRY_DATA[key];
    const nx = cx + ring * Math.cos(angle);
    const ny = cy + ring * Math.sin(angle);

    nodes.push({
      id: key, type: "country", label: data.name, flag: data.flag,
      x: nx + (Math.random()-.5)*10, y: ny + (Math.random()-.5)*10,
      vx: 0, vy: 0, radius: 26, color: data.color, glowColor: data.color,
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
      const rr = 118;
      const rx = nx + rr * Math.cos(ra), ry = ny + rr * Math.sin(ra);
      nodes.push({
        id: reg.id, type: "regulation", label: reg.label, shortLabel: reg.short,
        countryId: key, x: rx+(Math.random()-.5)*8, y: ry+(Math.random()-.5)*8,
        vx: 0, vy: 0, radius: 13, color: data.color, glowColor: data.color,
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
          x: rx+cr*Math.cos(ca)+(Math.random()-.5)*6, y: ry+cr*Math.sin(ca)+(Math.random()-.5)*6,
          vx: 0, vy: 0, radius: 6, color: data.color, glowColor: "#22D3EE",
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
    countryId: "vn", x: vnCsl.x+85, y: vnCsl.y-35, vx: 0, vy: 0, radius: 9,
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

// ==================== FORCE SIMULATION ====================
function applyForces(nodes: GNode[], edges: GEdge[], w: number, h: number) {
  const REP = 3000, CK = 0.07, XK = 0.016, GR = 0.0005, D = 0.86;
  nodes.forEach(n => { n.vx += (w/2-n.x)*GR; n.vy += (h/2-n.y)*GR; });
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i+1; j < nodes.length; j++) {
      const dx=nodes[j].x-nodes[i].x, dy=nodes[j].y-nodes[i].y;
      const d2=dx*dx+dy*dy||1, d=Math.sqrt(d2);
      if (d < (nodes[i].radius+nodes[j].radius+20)*3.5) {
        const f=REP/d2;
        nodes[i].vx-=(dx/d)*f; nodes[i].vy-=(dy/d)*f;
        nodes[j].vx+=(dx/d)*f; nodes[j].vy+=(dy/d)*f;
      }
    }
  }
  const nm = new Map(nodes.map(n=>[n.id,n]));
  edges.forEach(e => {
    const s=nm.get(e.sourceId), t=nm.get(e.targetId);
    if (!s||!t) return;
    const dx=t.x-s.x, dy=t.y-s.y, d=Math.sqrt(dx*dx+dy*dy)||1;
    const rest=e.type==="cluster"?(s.type==="country"?122:62):265;
    const k=e.type==="cluster"?CK:XK, f=(d-rest)*k;
    s.vx+=(dx/d)*f; s.vy+=(dy/d)*f;
    t.vx-=(dx/d)*f; t.vy-=(dy/d)*f;
  });
  nodes.forEach(n => {
    n.vx=(n.vx+(Math.random()-.5)*0.06)*D;
    n.vy=(n.vy+(Math.random()-.5)*0.06)*D;
    n.x+=n.vx; n.y+=n.vy;
    const m=n.radius+12;
    n.x=Math.max(m,Math.min(w-m,n.x));
    n.y=Math.max(m,Math.min(h-m,n.y));
  });
}

// ==================== CANVAS DRAWING ====================
const EDGE_COLORS: Record<EdgeType, [string, number, number]> = {
  cluster:    ["59,130,246", 0.13, 1],
  precedent:  ["139,92,246", 0.2, 0.8],
  amendment:  ["245,158,11", 0.32, 1.2],
  simulation: ["34,211,238", 0.22, 0.8],
};
const NODE_ORDER: Record<NodeType, number> = { clause:0, amendment:1, regulation:2, country:3 };

function drawGraph(
  ctx: CanvasRenderingContext2D,
  nodes: GNode[], edges: GEdge[],
  w: number, h: number,
  hovId: string|null, selId: string|null,
  time: number, dimmed: boolean
) {
  ctx.clearRect(0,0,w,h);
  ctx.globalAlpha = dimmed ? 0.22 : 1;

  ctx.fillStyle="rgba(255,255,255,0.04)";
  for (let x=0;x<w;x+=36) for (let y=0;y<h;y+=36) {
    ctx.beginPath(); ctx.arc(x,y,0.6,0,Math.PI*2); ctx.fill();
  }

  const p=(Math.sin(time*0.0007)+1)/2;
  [
    {x:0.12,y:0.2,c:"59,130,246",s:0.32},{x:0.88,y:0.7,c:"139,92,246",s:0.28},
    {x:0.5,y:0.88,c:"34,211,238",s:0.2},{x:0.5,y:0.12,c:"16,185,129",s:0.18},
  ].forEach(g=>{
    const gx=g.x*w,gy=g.y*h,gr=g.s*w;
    const grad=ctx.createRadialGradient(gx,gy,0,gx,gy,gr);
    grad.addColorStop(0,`rgba(${g.c},${(0.042+p*0.022).toFixed(3)})`);
    grad.addColorStop(1,"transparent");
    ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);
  });

  const nm=new Map(nodes.map(n=>[n.id,n]));
  edges.forEach(e=>{
    const s=nm.get(e.sourceId),t=nm.get(e.targetId);
    if (!s||!t) return;
    const [rgb,alpha,lw]=EDGE_COLORS[e.type];
    ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(t.x,t.y);
    ctx.strokeStyle=`rgba(${rgb},${alpha})`; ctx.lineWidth=lw; ctx.stroke();
    e.particles.forEach(pp=>{
      const px=s.x+(t.x-s.x)*pp.progress, py=s.y+(t.y-s.y)*pp.progress;
      ctx.save(); ctx.shadowColor=`rgb(${rgb})`; ctx.shadowBlur=7;
      ctx.beginPath(); ctx.arc(px,py,2,0,Math.PI*2);
      ctx.fillStyle=`rgba(${rgb},${pp.opacity})`; ctx.fill(); ctx.restore();
    });
  });

  [...nodes].sort((a,b)=>NODE_ORDER[a.type]-NODE_ORDER[b.type]).forEach(n=>{
    const isH=n.id===hovId, isS=n.id===selId;
    const pulse=(Math.sin(time*0.0022+n.pulsePhase)+1)/2;

    if (n.type==="country") {
      ctx.save();
      ctx.beginPath(); ctx.arc(n.x,n.y,n.radius+19+pulse*11,0,Math.PI*2);
      ctx.strokeStyle=h2r(n.glowColor,0.07+pulse*0.06); ctx.lineWidth=1; ctx.stroke();
      ctx.beginPath(); ctx.arc(n.x,n.y,n.radius+9+pulse*4,0,Math.PI*2);
      ctx.strokeStyle=h2r(n.glowColor,0.18+pulse*0.1); ctx.lineWidth=1.5; ctx.stroke();
      ctx.restore();
    }
    if (n.type==="amendment") {
      const ap=(Math.sin(time*0.008+n.pulsePhase)+1)/2;
      ctx.save();
      ctx.beginPath(); ctx.arc(n.x,n.y,n.radius+8+ap*6,0,Math.PI*2);
      ctx.strokeStyle=h2r("#F59E0B",0.14+ap*0.22); ctx.lineWidth=1; ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor=n.glowColor;
    ctx.shadowBlur=isS?52:isH?35:n.type==="country"?24:n.type==="regulation"?12:6;
    ctx.beginPath(); ctx.arc(n.x,n.y,n.radius,0,Math.PI*2);
    if (n.type==="country") {
      const gr=ctx.createRadialGradient(n.x-n.radius*0.35,n.y-n.radius*0.35,0,n.x,n.y,n.radius);
      gr.addColorStop(0,lighten(n.color,50)); gr.addColorStop(1,n.color);
      ctx.fillStyle=gr;
    } else if (n.type==="regulation") {
      ctx.fillStyle=h2r(n.glowColor,0.22);
    } else if (n.type==="amendment") {
      ctx.fillStyle=h2r("#F59E0B",0.28);
    } else {
      ctx.fillStyle=h2r("#22D3EE",0.12);
    }
    ctx.fill(); ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.arc(n.x,n.y,n.radius,0,Math.PI*2);
    ctx.strokeStyle=h2r(n.glowColor,isS?1:isH?0.85:n.type==="country"?0.7:0.4);
    ctx.lineWidth=isS?2.5:1.5; ctx.stroke(); ctx.restore();

    if (n.type==="country"&&n.flag) {
      ctx.font=`${Math.floor(n.radius*0.85)}px sans-serif`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(n.flag,n.x,n.y+1);
    }
    if (n.alerting) {
      const ap=(Math.sin(time*0.009+n.pulsePhase)+1)/2;
      ctx.save(); ctx.shadowColor="#EF4444"; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(n.x+n.radius-2,n.y-n.radius+2,4,0,Math.PI*2);
      ctx.fillStyle=`rgba(239,68,68,${0.7+ap*0.3})`; ctx.fill(); ctx.restore();
    }

    const showLabel=n.type==="country"||isH||isS;
    if (showLabel) {
      const label=n.shortLabel||n.label;
      const fs=n.type==="country"?11:9;
      ctx.font=`${n.type==="country"?"600 ":""}${fs}px Inter, sans-serif`;
      const tw=ctx.measureText(label).width, pad=3;
      const lx=n.x, ly=n.y+n.radius+6;
      ctx.fillStyle="rgba(7,16,24,0.88)";
      ctx.beginPath();
      if ((ctx as any).roundRect) (ctx as any).roundRect(lx-tw/2-pad,ly,tw+pad*2,fs+pad*1.5,3);
      else ctx.rect(lx-tw/2-pad,ly,tw+pad*2,fs+pad*1.5);
      ctx.fill();
      ctx.fillStyle=n.type==="country"?"#F5F7FA":"#94A3B8";
      ctx.textAlign="center"; ctx.textBaseline="top";
      ctx.fillText(label,lx,ly+pad*0.75);
    }
  });
  ctx.globalAlpha=1;
}

// ==================== GRAPH COMPONENT ====================
interface GRef {
  nodes:GNode[]; edges:GEdge[]; hovId:string|null; dragId:string|null;
  selId:string|null; time:number; w:number; h:number; init:boolean; raf:number; dimmed:boolean;
}

function RegulatoryGraph({ onSelect, selId, dimmed }: { onSelect:(n:GNode|null)=>void; selId:string|null; dimmed:boolean; }) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const gr = useRef<GRef>({ nodes:[],edges:[],hovId:null,dragId:null,selId:null,time:0,w:0,h:0,init:false,raf:0,dimmed:false });

  useEffect(()=>{ gr.current.selId=selId; },[selId]);
  useEffect(()=>{ gr.current.dimmed=dimmed; },[dimmed]);

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
      const ctx=c.getContext("2d");
      if (ctx&&gr.current.init) drawGraph(ctx,gr.current.nodes,gr.current.edges,gr.current.w,gr.current.h,gr.current.hovId,gr.current.selId,gr.current.time,gr.current.dimmed);
      gr.current.raf=requestAnimationFrame(loop);
    };
    gr.current.raf=requestAnimationFrame(loop);
    return ()=>{ ro.disconnect(); cancelAnimationFrame(gr.current.raf); };
  },[]);

  const onMove=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{
    const r=cvs.current!.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    if (gr.current.dragId) {
      const n=gr.current.nodes.find(n=>n.id===gr.current.dragId);
      if (n){n.x=mx;n.y=my;n.vx=0;n.vy=0;} return;
    }
    let hov:string|null=null;
    for (const n of gr.current.nodes) { const dx=mx-n.x,dy=my-n.y; if(dx*dx+dy*dy<(n.radius+8)**2){hov=n.id;break;} }
    gr.current.hovId=hov; cvs.current!.style.cursor=hov?"pointer":"default";
  },[]);

  const onDown=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{
    const r=cvs.current!.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
    for (const n of gr.current.nodes) { const dx=mx-n.x,dy=my-n.y; if(dx*dx+dy*dy<(n.radius+6)**2){gr.current.dragId=n.id;break;} }
  },[]);

  const onUp=useCallback(()=>{ gr.current.dragId=null; },[]);

  const onClick=useCallback((e:React.MouseEvent<HTMLCanvasElement>)=>{
    const r=cvs.current!.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
    let found:GNode|null=null;
    for (const n of gr.current.nodes) { const dx=mx-n.x,dy=my-n.y; if(dx*dx+dy*dy<(n.radius+6)**2){found=n;break;} }
    onSelect(found);
  },[onSelect]);

  return (
    <canvas ref={cvs} className="absolute inset-0 w-full h-full"
      onMouseMove={onMove} onMouseDown={onDown} onMouseUp={onUp}
      onClick={onClick} onMouseLeave={()=>{gr.current.hovId=null;}} />
  );
}

// ==================== NAV ====================
const NAV_ITEMS: Array<{id:ViewId;label:string;icon:React.ElementType;short:string}> = [
  {id:"dashboard",label:"Dashboard",icon:LayoutDashboard,short:"Dashboard"},
  {id:"graph",label:"Regulatory Graph",icon:Network,short:"Graph"},
  {id:"diff",label:"Diff Engine",icon:GitBranch,short:"Diff"},
  {id:"simulation",label:"Simulation",icon:FlaskConical,short:"Sim"},
  {id:"memory",label:"Memory Layer",icon:Database,short:"Memory"},
  {id:"countries",label:"Countries",icon:Globe,short:"Countries"},
  {id:"sme",label:"SME Assistant",icon:MessageSquare,short:"SME"},
  {id:"api",label:"API",icon:Code2,short:"API"},
  {id:"settings",label:"Settings",icon:Settings,short:"Settings"},
];

function FloatingNav({
  cur,
  onNav,
}: {
  cur: ViewId;
  onNav: (v: ViewId) => void;
}) {
  const [hov, setHov] = useState<ViewId | null>(null);

  return (
    <nav className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-auto">
      <div
        className="flex items-center gap-0.5 px-2 py-1 rounded-full overflow-visible"
        style={{
          background: "rgba(11,18,28,0.82)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.04),0 8px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* LOGO */}
        <div
          className="flex items-center px-2 pr-3 mr-1 border-r flex-shrink-0 overflow-visible"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <img
            src="/src/assets/aila-logo-2.png"
            alt="AILA"
            className="block flex-shrink-0 max-w-none"
            style={{
              width: "140px",
              height: "auto",
              objectFit: "contain",
              // filter:
              //   "invert(1) drop-shadow(0 0 10px rgba(59,130,246,0.35))",
            }}
          />
        </div>

        {/* NAV ITEMS */}
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isA = cur === item.id;
          const isH = hov === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              onMouseEnter={() => setHov(item.id)}
              onMouseLeave={() => setHov(null)}
              className="relative flex items-center gap-1 px-2 py-1 rounded-full transition-all duration-150 flex-shrink-0"
              style={{
                background: isA
                  ? "rgba(59,130,246,0.16)"
                  : isH
                  ? "rgba(255,255,255,0.06)"
                  : "transparent",
                color: isA
                  ? "#60A5FA"
                  : isH
                  ? "#F5F7FA"
                  : "#64748B",
              }}
            >
              {isA && (
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    boxShadow: "0 0 14px rgba(59,130,246,0.28)",
                    border: "1px solid rgba(59,130,246,0.32)",
                  }}
                />
              )}

              <Icon size={11} />

              <span
                className="text-[11px] font-medium whitespace-nowrap"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {item.short}
              </span>
            </button>
          );
        })}

        {/* DIVIDER */}
        <div
          className="w-px h-3 mx-1 flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        {/* NOTIFICATIONS */}
        <button
          className="p-1 rounded-full transition-colors flex-shrink-0"
          style={{ color: "#64748B" }}
          title="Notifications"
        >
          <Bell size={11} />
        </button>

        {/* USER */}
        <button
          className="w-6 h-6 rounded-full flex items-center justify-center ml-0.5 flex-shrink-0"
          style={{
            background: "rgba(59,130,246,0.2)",
            border: "1px solid rgba(59,130,246,0.3)",
          }}
        >
          <User size={10} style={{ color: "#60A5FA" }} />
        </button>
      </div>
    </nav>
  );
}

// ==================== INTEL PANELS ====================
const PANEL_STYLE = {background:"rgba(11,18,28,0.78)",backdropFilter:"blur(18px)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",boxShadow:"0 4px 24px rgba(0,0,0,0.45)"};

function PanelTitle({children}:{children:React.ReactNode}) {
  return <div className="px-3 py-2 border-b" style={{borderColor:"rgba(255,255,255,0.06)"}}>
    <span className="text-xs font-semibold tracking-widest uppercase" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>{children}</span>
  </div>;
}
function StatRow({label,value,color,dot}:{label:string;value:string|number;color?:string;dot?:string}) {
  return <div className="flex items-center justify-between">
    <span className="text-xs" style={{color:"#64748B"}}>{label}</span>
    <span className="flex items-center gap-1.5 text-xs font-medium" style={{color:color||"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>
      {dot&&<span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:dot}}/>}
      {value}
    </span>
  </div>;
}

function IntelPanels() {
  const [stats,setStats] = useState({regs:2847,amends:12,diffs:7,queue:23,aiConf:94.2,ragH:98.1,memGb:"142.7",conflicts:3,precedents:156});
  const [feedIdx,setFeedIdx] = useState(0);
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
      setFeedIdx(i=>(i+1)%LIVE_EVENTS.length);
    },2800);
    return ()=>clearInterval(t);
  },[]);

  const feed=LIVE_EVENTS.slice(feedIdx,feedIdx+3).concat(LIVE_EVENTS.slice(0,Math.max(0,3-(LIVE_EVENTS.length-feedIdx))));
  const feedColors:{[k:string]:string}={alert:"#EF4444",diff:"#8B5CF6",verify:"#10B981",ingest:"#3B82F6",analysis:"#22D3EE"};

  return <>
    {/* Top Left */}
    <motion.div initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:0.3,duration:0.5}}
      className="absolute top-20 left-4 w-56 z-40" style={PANEL_STYLE}>
      <PanelTitle>System Status</PanelTitle>
      <div className="p-3 space-y-2">
        <StatRow label="Active Jurisdictions" value="6 / 6" color="#10B981" dot="#10B981"/>
        <StatRow label="Regulations Tracked" value={stats.regs.toLocaleString()} color="#60A5FA"/>
        <StatRow label="Amendment Alerts" value={stats.amends} color={stats.amends>10?"#F59E0B":"#94A3B8"} dot={stats.amends>0?"#F59E0B":undefined}/>
        <StatRow label="Crawler Activity" value="3 active" color="#10B981" dot="#10B981"/>
        <div className="pt-1 border-t" style={{borderColor:"rgba(255,255,255,0.06)"}}>
          <StatRow label="OCR Queue" value={`${stats.queue} docs`} color="#64748B"/>
        </div>
      </div>
    </motion.div>

    {/* Top Right */}
    <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} transition={{delay:0.35,duration:0.5}}
      className="absolute top-20 right-4 w-56 z-40" style={PANEL_STYLE}>
      <PanelTitle>Intelligence Core</PanelTitle>
      <div className="p-3 space-y-2">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs" style={{color:"#64748B"}}>AI Confidence</span>
            <span className="text-xs font-medium" style={{color:"#10B981",fontFamily:"JetBrains Mono, monospace"}}>{stats.aiConf.toFixed(1)}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
            <div className="h-full rounded-full transition-all duration-700" style={{width:`${stats.aiConf}%`,background:"linear-gradient(90deg,#10B98180,#10B981)"}}/>
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs" style={{color:"#64748B"}}>RAG Health</span>
            <span className="text-xs font-medium" style={{color:"#10B981",fontFamily:"JetBrains Mono, monospace"}}>{stats.ragH.toFixed(1)}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
            <div className="h-full rounded-full transition-all duration-700" style={{width:`${stats.ragH}%`,background:"linear-gradient(90deg,#3B82F680,#3B82F6)"}}/>
          </div>
        </div>
        <StatRow label="Semantic Diffs" value={stats.diffs} color="#8B5CF6" dot="#8B5CF6"/>
        <StatRow label="Memory Growth" value={`${stats.memGb} GB`} color="#22D3EE"/>
      </div>
    </motion.div>

    {/* Bottom Left */}
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.4,duration:0.5}}
      className="absolute bottom-4 left-4 w-60 z-40" style={PANEL_STYLE}>
      <PanelTitle>Live Ingestion Feed</PanelTitle>
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
        <div className="pt-1.5 border-t flex items-center gap-1.5" style={{borderColor:"rgba(255,255,255,0.06)"}}>
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
        <StatRow label="Active Simulations" value="2 running" color="#22D3EE" dot="#22D3EE"/>
        <StatRow label="Regulatory Conflicts" value={stats.conflicts} color={stats.conflicts>2?"#EF4444":"#F59E0B"} dot={stats.conflicts>0?"#EF4444":undefined}/>
        <StatRow label="Precedent Matches" value={stats.precedents} color="#8B5CF6"/>
        <div className="pt-2 border-t space-y-1.5" style={{borderColor:"rgba(255,255,255,0.06)"}}>
          {[{country:"PH Philippines",score:87,c:"#3B82F6"},{country:"SG Singapore",score:94,c:"#10B981"},{country:"VN Vietnam",score:71,c:"#EF4444"}].map(r=>(
            <div key={r.country}>
              <div className="flex justify-between mb-0.5">
                <span className="text-xs" style={{color:"#64748B"}}>{r.country}</span>
                <span className="text-xs" style={{color:r.c,fontFamily:"JetBrains Mono, monospace"}}>{r.score}%</span>
              </div>
              <div className="h-0.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.05)"}}>
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
      style={{background:"rgba(9,15,24,0.97)",backdropFilter:"blur(24px)",borderColor:"rgba(255,255,255,0.08)",boxShadow:side==="right"?"-8px 0 40px rgba(0,0,0,0.6)":"8px 0 40px rgba(0,0,0,0.6)"}}>

      <div className="sticky top-0 z-10 flex items-start justify-between p-4 border-b"
        style={{borderColor:"rgba(255,255,255,0.07)",background:"rgba(9,15,24,0.99)"}}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {node.flag&&<span className="text-xl">{node.flag}</span>}
            <span className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded"
              style={{background:h2r(node.glowColor,0.14),color:node.glowColor,fontFamily:"IBM Plex Sans, sans-serif"}}>{node.type}</span>
            {node.alerting&&<span className="text-xs px-1.5 py-0.5 rounded animate-pulse" style={{background:"rgba(239,68,68,0.14)",color:"#EF4444"}}>ALERT</span>}
          </div>
          <h3 className="font-semibold text-sm leading-snug" style={{color:"#F5F7FA",fontFamily:"Inter, sans-serif"}}>{node.label}</h3>
          {cd&&!isC&&<p className="text-xs mt-0.5" style={{color:"#64748B"}}>{cd.flag} {cd.name}</p>}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md ml-2 transition-colors"
          style={{color:"#64748B"}} onMouseEnter={e=>(e.currentTarget.style.color="#F5F7FA")} onMouseLeave={e=>(e.currentTarget.style.color="#64748B")}>
          <X size={15}/>
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <p className="text-xs leading-relaxed" style={{color:"#94A3B8"}}>{details.description}</p>

        <div className="grid grid-cols-2 gap-2">
          {[{l:"Category",v:details.category},{l:"Status",v:details.status,c:details.status==="Active"?"#10B981":details.status==="Proposed"?"#F59E0B":"#EF4444"},{l:"Enacted",v:details.enacted},{l:"Coverage",v:details.coverage}]
            .filter(m=>m.v&&m.v!=="N/A").map(m=>(
            <div key={m.l} className="rounded-lg p-2.5" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
              <div className="text-xs mb-0.5" style={{color:"#64748B"}}>{m.l}</div>
              <div className="text-xs font-medium truncate" style={{color:(m as any).c||"#F5F7FA",fontFamily:"JetBrains Mono, monospace"}}>{m.v}</div>
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
                <div key={r.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)"}}>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:node.glowColor}}/>
                  <span className="text-xs flex-1 truncate" style={{color:"#94A3B8"}}>{r.label}</span>
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
          <div className="h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.06)"}}>
            <motion.div initial={{width:0}} animate={{width:`${conf*100}%`}} transition={{duration:0.9,delay:0.2}}
              className="h-full rounded-full" style={{background:`linear-gradient(90deg,${confC}70,${confC})`}}/>
          </div>
        </div>

        {!isC&&(
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>AI Reasoning Trace</p>
            <div className="rounded-lg p-3 space-y-2.5" style={{background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.18)"}}>
              {["Extracted from official government PDF portal","Semantic classification via RDTII taxonomy","Cross-referenced with regional precedent database","Compliance vector encoded to persistent memory","Citation graph updated — 3 new edges added"].map((s,i)=>(
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{background:"rgba(139,92,246,0.25)",border:"1px solid rgba(139,92,246,0.4)"}}>
                    <span style={{color:"#8B5CF6",fontSize:"8px",fontWeight:700}}>{i+1}</span>
                  </div>
                  <span className="text-xs leading-snug" style={{color:"#94A3B8"}}>{s}</span>
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
                  <div className="text-xs font-medium" style={{color:"#F5F7FA",fontFamily:"JetBrains Mono, monospace"}}>{parseInt(details.enacted)+i+1}</div>
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
                  style={{background:"rgba(139,92,246,0.07)",border:"1px solid rgba(139,92,246,0.16)"}}>
                  <span className="text-base">{d.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate" style={{color:"#94A3B8"}}>{rel.label}</p>
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
          <h1 className="text-xl font-semibold" style={{color:"#F5F7FA",fontFamily:"Inter, sans-serif"}}>Country Comparison — Cross-Border Transfer</h1>
          <span className="text-xs px-2 py-0.5 rounded" style={{background:"rgba(139,92,246,0.14)",color:"#8B5CF6",border:"1px solid rgba(139,92,246,0.3)"}}>ESCAP Analyst Mode</span>
        </div>
        <p className="text-sm" style={{color:"#64748B"}}>
          Type one question, generate a comparison dashboard in seconds, and export a cited brief.
        </p>
      </div>

      <div className="rounded-xl p-4 mb-5" style={{background:"rgba(13,23,34,0.7)",border:"1px solid rgba(255,255,255,0.08)"}}>
        <div className="flex items-center gap-3">
          <input value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&runQuery()}
            className="flex-1 rounded-lg px-4 py-3 text-sm outline-none"
            placeholder="Ask: Compare cross-border transfer rules across ASEAN..."
            style={{background:"rgba(17,28,41,0.9)",border:"1px solid rgba(255,255,255,0.1)",color:"#F5F7FA"}}/>
          <button onClick={runQuery} disabled={running}
            className="px-4 py-3 rounded-lg text-sm font-medium transition-all"
            style={{background:running?"rgba(59,130,246,0.15)":"rgba(59,130,246,0.9)",border:"1px solid rgba(59,130,246,0.5)",color:running?"#60A5FA":"#fff"}}>
            {running?"Querying…":"Run"}
          </button>
          <button
            onClick={()=>downloadTextFile("asean-cross-border-transfer-brief.md", buildBriefMarkdown(query, selected))}
            disabled={!ready}
            className="px-4 py-3 rounded-lg text-sm font-medium transition-all"
            style={{background:ready?"rgba(16,185,129,0.14)":"rgba(255,255,255,0.06)",border:`1px solid ${ready?"rgba(16,185,129,0.35)":"rgba(255,255,255,0.1)"}`,color:ready?"#6EE7B7":"#64748B"}}>
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
                style={{background:on?"rgba(139,92,246,0.18)":"rgba(255,255,255,0.06)",border:`1px solid ${on?"rgba(139,92,246,0.32)":"rgba(255,255,255,0.1)"}`,color:on?"#C4B5FD":"#94A3B8"}}>
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
        <div className="rounded-xl p-6 text-sm" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",color:"#64748B"}}>
          Run a query to generate the ASEAN comparison dashboard.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-6 gap-2 mb-5">
            {["Low","Medium","High"].map((f,i)=>(
              <div key={f} className="col-span-2 rounded-xl p-3" style={{background:"rgba(13,23,34,0.6)",border:"1px solid rgba(255,255,255,0.08)"}}>
                <div className="text-xs" style={{color:"#64748B"}}>Friction</div>
                <div className="text-lg font-bold" style={{color:f==="Low"?"#10B981":f==="Medium"?"#F59E0B":"#EF4444",fontFamily:"JetBrains Mono, monospace"}}>{f}</div>
                <div className="text-xs mt-1" style={{color:"#94A3B8"}}>
                  {rows.filter(r=>r.friction===f).length} jurisdictions
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden" style={{background:"rgba(13,23,34,0.6)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{borderColor:"rgba(255,255,255,0.06)"}}>
              <div>
                <p className="text-sm font-medium" style={{color:"#F5F7FA"}}>ASEAN cross-border transfer comparison</p>
                <p className="text-xs" style={{color:"#64748B",fontFamily:"JetBrains Mono, monospace"}}>{query}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded" style={{background:"rgba(34,211,238,0.12)",color:"#22D3EE",border:"1px solid rgba(34,211,238,0.25)"}}>
                {rows.length} selected
              </span>
            </div>

            <div className="grid grid-cols-6 gap-0">
              {rows.map(r=>{
                const fc=frictionColor(r.friction);
                return (
                  <div key={r.key} className="col-span-3 border-r last:border-r-0" style={{borderColor:"rgba(255,255,255,0.06)"}}>
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{r.flag}</span>
                          <span className="text-sm font-semibold" style={{color:"#F5F7FA"}}>{r.name}</span>
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
                            <div key={i} className="text-xs px-2.5 py-2 rounded-lg" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",color:"#94A3B8"}}>
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>Citations</p>
                        <div className="mt-2 space-y-1.5">
                          {r.citations.map((c,i)=>(
                            <div key={i} className="text-xs px-2.5 py-2 rounded-lg" style={{background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.15)",color:"#C4B5FD"}}>
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

          <div className="rounded-xl p-4 mt-5" style={{background:"rgba(139,92,246,0.06)",border:"1px solid rgba(139,92,246,0.2)"}}>
            <div className="flex items-center gap-2 mb-3">
              <Brain size={14} style={{color:"#8B5CF6"}}/>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{color:"#8B5CF6",fontFamily:"IBM Plex Sans, sans-serif"}}>Automated analyst brief</span>
            </div>
            <p className="text-sm leading-relaxed" style={{color:"#94A3B8"}}>
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
        <FlaskConical size={18} style={{color:"#22D3EE"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#F5F7FA"}}>Compliance Simulation Sandbox</h1>
      </div>
      <div className="rounded-xl p-4" style={{background:"rgba(13,23,34,0.7)",border:"1px solid rgba(255,255,255,0.08)"}}>
        <p className="text-sm" style={{color:"#64748B"}}>
          Simulation view placeholder.
        </p>
      </div>
    </div>
  );
}

// ==================== SME ASSISTANT ====================

type ChatMsg = { role: "ai" | "user"; text: string };

const INIT_MSGS: ChatMsg[] = [
  {role:"ai",text:"Hello! I'm AILA's SME Assistant. I can help you understand regulatory requirements for your business operating in Southeast Asia. What would you like to know?"},
];

const SME_ASSISTANT_FIXED_RESPONSE = `Yes — you can store users’ health data on AWS Singapore, but only under strict compliance conditions under Philippine data privacy law.

Philippine Data Privacy Act (R.A. 10173) classifies health data as sensitive personal information, which means cross-border storage is allowed only if you implement strong safeguards, including explicit user consent, legitimate purpose, and proportional data processing.

Because AWS Singapore involves cross-border data transfer, you must also comply with the Data Privacy Act’s transfer requirements, which generally require that the receiving jurisdiction provides adequate protection or that you implement enforceable contractual and technical safeguards.

Practically, this means:

You are allowed to proceed IF you implement:

Explicit, informed consent from users for offshore storage and processing
A Data Processing Agreement (DPA) with AWS covering breach notification and security obligations
Encryption of health data both at rest and in transit
Strong access controls and audit logging for all sensitive records

You should be cautious because:

Health data is considered high-risk and subject to stricter scrutiny by the National Privacy Commission (NPC)
Cross-border processing increases regulatory exposure, especially if data is used for analytics or AI training
Non-compliance can trigger mandatory reporting requirements and penalties

Best-practice approach (what most compliant startups do):

Use AWS Singapore for scalable compute, but keep a fallback or mirrored storage layer in the Philippines for sensitive datasets
Separate identifiable health data from analytical datasets (data minimization principle)
Run a Privacy Impact Assessment before deployment

Net result: this is not prohibited, but it is high-risk and compliance-heavy, and you should treat consent + encryption + contractual safeguards as mandatory, not optional.

Sources: Philippine Data Privacy Act (R.A. 10173), NPC circulars on data sharing and cross-border transfers.`;

function SMEAssistant() {
  const [msgs,setMsgs]=useState<ChatMsg[]>(INIT_MSGS);
  const [input,setInput]=useState("");
  const end=useRef<HTMLDivElement>(null);
  useEffect(()=>{ end.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  const send=()=>{
    if (!input.trim()) return;
    const q=input.trim();
    setInput("");

    setMsgs((m: ChatMsg[])=>{
      const next=[...m,{role:"user",text:q} as ChatMsg];
      return [...next,{role:"ai",text:"Typing…"} as ChatMsg];
    });

    const delayMs=2200; // 2–3s
    setTimeout(()=>{
      setMsgs((m: ChatMsg[])=>{
        if (m.length===0) return [{role:"ai",text:SME_ASSISTANT_FIXED_RESPONSE}];
        const last=m[m.length-1];
        if (last?.role==="ai" && last.text==="Typing…") {
          return [...m.slice(0,-1),{role:"ai",text:SME_ASSISTANT_FIXED_RESPONSE}];
        }
        return [...m,{role:"ai",text:SME_ASSISTANT_FIXED_RESPONSE}];
      });
    },delayMs);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col h-full" style={{height:"calc(100vh - 80px)"}}>
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare size={18} style={{color:"#3B82F6"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#F5F7FA"}}>SME Assistant</h1>
        <div className="ml-auto flex items-center gap-2 text-xs px-2.5 py-1 rounded-full"
          style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)",color:"#10B981"}}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>Compliance Score: 87%
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {["What data can I collect?","Cross-border transfer rules","Fintech licensing in SG","AI regulation requirements"].map(q=>(
          <button key={q} onClick={()=>setInput(q)}
            className="text-xs px-3 py-1.5 rounded-full transition-colors"
            style={{background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",color:"#60A5FA"}}>
            {q}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2" style={{minHeight:0}}>
        {msgs.map((m: ChatMsg,i: number)=>(
          <div key={i} className={`flex gap-3 ${m.role==="user"?"justify-end":""}`}>
            {m.role==="ai"&&(
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{background:"rgba(59,130,246,0.2)",border:"1px solid rgba(59,130,246,0.35)"}}>
                <Brain size={13} style={{color:"#60A5FA"}}/>
              </div>
            )}
            <div className={`max-w-lg rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${m.role==="user"?"rounded-tr-sm":"rounded-tl-sm"}`}
              style={{background:m.role==="user"?"rgba(59,130,246,0.14)":"rgba(17,28,41,0.9)",border:`1px solid ${m.role==="user"?"rgba(59,130,246,0.25)":"rgba(255,255,255,0.06)"}`,color:"#E2E8F0"}}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={end}/>
      </div>

      <div className="mt-4 flex gap-2">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Ask about regulatory requirements, compliance, or specific laws..."
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          style={{background:"rgba(17,28,41,0.9)",border:"1px solid rgba(255,255,255,0.1)",color:"#F5F7FA",fontFamily:"Inter, sans-serif"}}/>
        <button onClick={send}
          className="px-4 py-3 rounded-xl flex items-center justify-center transition-all"
          style={{background:"rgba(59,130,246,0.85)",border:"1px solid rgba(59,130,246,0.5)"}}>
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
        <Globe size={18} style={{color:"#22D3EE"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#F5F7FA"}}>Jurisdiction Overview</h1>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(COUNTRY_DATA).map(([key,data])=>{
          const score=Math.floor(75+Math.random()*22);
          const amends=data.regulations.reduce((a,r)=>a+r.amendments,0);
          return (
            <div key={key} className="rounded-xl p-4 transition-all"
              style={{background:"rgba(13,23,34,0.7)",border:`1px solid rgba(255,255,255,0.08)`,cursor:"pointer"}}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{data.flag}</span>
                <div>
                  <h3 className="font-semibold text-sm" style={{color:"#F5F7FA"}}>{data.name}</h3>
                  <p className="text-xs" style={{color:"#64748B"}}>{data.regulations.length} regulations tracked</p>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-lg font-bold" style={{color:data.color,fontFamily:"JetBrains Mono, monospace"}}>{score}%</div>
                  <div className="text-xs" style={{color:"#64748B"}}>compliance</div>
                </div>
              </div>
              <div className="h-1 rounded-full overflow-hidden mb-3" style={{background:"rgba(255,255,255,0.06)"}}>
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
          <h1 className="text-xl font-semibold" style={{color:"#F5F7FA"}}>Regulatory Memory Layer</h1>
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
            style={{background:"rgba(13,23,34,0.6)",border:"1px solid rgba(255,255,255,0.07)",cursor:"pointer"}}>
            <div className="flex items-center gap-2 w-8">
              <div className="w-2 h-2 rounded-full shrink-0" style={{background:e.c}}/>
            </div>
            <span className="text-xl">{e.flag}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{color:"#F5F7FA"}}>{e.label}</p>
              <p className="text-xs" style={{color:"#64748B"}}>{e.cat} · Ingested {e.date}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{background:"rgba(255,255,255,0.04)",color:"#64748B",fontFamily:"JetBrains Mono, monospace"}}>{e.size}</span>
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
        <Code2 size={18} style={{color:"#22D3EE"}}/>
        <h1 className="text-xl font-semibold" style={{color:"#F5F7FA"}}>API Reference</h1>
        <span className="text-xs px-2 py-0.5 rounded" style={{background:"rgba(34,211,238,0.1)",color:"#22D3EE",border:"1px solid rgba(34,211,238,0.25)"}}>v1.4.2</span>
      </div>

      <div className="rounded-xl mb-4 p-4" style={{background:"rgba(13,23,34,0.7)",border:"1px solid rgba(255,255,255,0.08)"}}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>Authentication</p>
        <div className="rounded-lg px-3 py-2" style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.06)"}}>
          <code className="text-xs" style={{color:"#22D3EE",fontFamily:"JetBrains Mono, monospace"}}>
            Authorization: Bearer {"<YOUR_AILA_API_KEY>"}
          </code>
        </div>
      </div>

      <div className="space-y-2">
        {endpoints.map((e,i)=>(
          <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{background:"rgba(13,23,34,0.6)",border:"1px solid rgba(255,255,255,0.07)"}}>
            <span className="text-xs font-bold w-12 shrink-0 mt-0.5" style={{color:mc[e.method]||"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>{e.method}</span>
            <code className="text-xs shrink-0 w-52" style={{color:"#94A3B8",fontFamily:"JetBrains Mono, monospace"}}>{e.path}</code>
            <span className="text-xs" style={{color:"#64748B"}}>{e.desc}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl p-4" style={{background:"rgba(13,23,34,0.7)",border:"1px solid rgba(255,255,255,0.08)"}}>
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
        <h1 className="text-xl font-semibold" style={{color:"#F5F7FA"}}>System Configuration</h1>
      </div>
      <div className="space-y-4">
        {[
          {title:"AI Engine",items:[
            {l:"Model",v:<select value={vals.aiModel} onChange={e=>setVals(v=>({...v,aiModel:e.target.value}))} className="rounded px-2 py-1 text-xs outline-none" style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#94A3B8"}}><option value="claude-sonnet-4-6">Claude Sonnet 4.6</option><option value="claude-opus-4-7">Claude Opus 4.7</option></select>},
            {l:"Semantic Diff Engine",v:<button onClick={()=>toggle("semanticDiff")} className="w-9 h-5 rounded-full transition-colors relative" style={{background:vals.semanticDiff?"#3B82F6":"rgba(255,255,255,0.1)"}}><span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{background:"#fff",left:vals.semanticDiff?"calc(100% - 18px)":"2px"}}/></button>},
          ]},
          {title:"Crawler Settings",items:[
            {l:"Crawl Interval",v:<select value={vals.crawlInterval} onChange={e=>setVals(v=>({...v,crawlInterval:e.target.value}))} className="rounded px-2 py-1 text-xs outline-none" style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#94A3B8"}}><option value="1h">Every 1 hour</option><option value="6h">Every 6 hours</option><option value="24h">Daily</option></select>},
            {l:"Auto Memory Growth",v:<button onClick={()=>toggle("memoryAuto")} className="w-9 h-5 rounded-full transition-colors relative" style={{background:vals.memoryAuto?"#3B82F6":"rgba(255,255,255,0.1)"}}><span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{background:"#fff",left:vals.memoryAuto?"calc(100% - 18px)":"2px"}}/></button>},
          ]},
          {title:"Notifications",items:[
            {l:"Amendment Alerts",v:<button onClick={()=>toggle("notifications")} className="w-9 h-5 rounded-full transition-colors relative" style={{background:vals.notifications?"#3B82F6":"rgba(255,255,255,0.1)"}}><span className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{background:"#fff",left:vals.notifications?"calc(100% - 18px)":"2px"}}/></button>},
          ]},
        ].map(section=>(
          <div key={section.title} className="rounded-xl overflow-hidden" style={{background:"rgba(13,23,34,0.7)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div className="px-4 py-2.5 border-b" style={{borderColor:"rgba(255,255,255,0.06)"}}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{color:"#64748B",fontFamily:"IBM Plex Sans, sans-serif"}}>{section.title}</p>
            </div>
            {section.items.map(item=>(
              <div key={item.l} className="flex items-center justify-between px-4 py-3 border-b last:border-0"
                style={{borderColor:"rgba(255,255,255,0.04)"}}>
                <span className="text-sm" style={{color:"#94A3B8"}}>{item.l}</span>
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
  const isDash=view==="dashboard"||view==="graph";

  const [compareMode,setCompareMode]=useState(false);
  const [compareLeft,setCompareLeft]=useState<GNode|null>(null);
  const [compareRight,setCompareRight]=useState<GNode|null>(null);

  const onNav=(v:ViewId)=>{
    setView(v);
    if (v==="dashboard"||v==="graph") setSelNode(null);
    // Leaving the graph/dashboard ends compare mode.
    if (v!=="dashboard" && v!=="graph") {
      setCompareMode(false);
      setCompareLeft(null);
      setCompareRight(null);
    }
  };

  const onGraphSelect=(n:GNode|null)=>{
    if (!isDash) return;

    if (!compareMode) {
      setSelNode(n);
      return;
    }

    // Compare mode behavior:
    // 1) First selection pins left.
    // 2) Next selections go to right (replacing previous right).
    // 3) If user closes (unselects) left, comparisons stop; user must toggle compare mode again to start a new comparison.
    if (!n) return;

    if (!compareLeft) {
      setCompareLeft(n);
      setCompareRight(null);
      setSelNode(null);
      return;
    }

    // If clicking the left node again, treat as unselect (stop comparing).
    if (compareLeft.id===n.id) return;

    setCompareRight(n);
    setSelNode(null);
  };

  const stopCompare=()=>{
    setCompareMode(false);
    setCompareLeft(null);
    setCompareRight(null);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden" style={{background:"#071018",fontFamily:"Inter, sans-serif"}}>
      <RegulatoryGraph onSelect={onGraphSelect} selId={selNode?.id||null} dimmed={!isDash}/>

      <FloatingNav cur={view} onNav={onNav}/>

      {isDash&&(
        <div className="absolute top-[84px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
          <button
            onClick={()=>{
              // Turning on compare mode starts a fresh comparison.
              if (!compareMode) {
                setCompareMode(true);
                setCompareLeft(null);
                setCompareRight(null);
                setSelNode(null);
              } else {
                stopCompare();
              }
            }}
            className="px-3 py-2 rounded-full text-xs font-medium transition-colors"
            style={{
              background: compareMode ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${compareMode ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.1)"}`,
              color: compareMode ? "#C4B5FD" : "#94A3B8",
              backdropFilter: "blur(16px)",
            }}>
            {compareMode ? "Exit compare" : "Compare nodes"}
          </button>
          {compareMode&&(
            <div className="text-[11px]" style={{color:"#64748B"}}>
              Select a node to pin left, then select other nodes to compare on the right.
            </div>
          )}
        </div>
      )}

      {isDash&&<IntelPanels/>}

      <AnimatePresence>
        {isDash && compareMode && compareLeft && (
          <IntelligenceDrawer key={`cmp-left-${compareLeft.id}`} node={compareLeft} side="left"
            onClose={()=>{
              // Closing left ends comparisons; user must re-enable compare mode to start again.
              stopCompare();
            }}/>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDash && compareMode && compareRight && (
          <IntelligenceDrawer key={`cmp-right-${compareRight.id}`} node={compareRight} side="right"
            onClose={()=>setCompareRight(null)}/>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDash && !compareMode && selNode &&(
          <IntelligenceDrawer key={selNode.id} node={selNode} onClose={()=>setSelNode(null)}/>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isDash&&(
          <motion.div key={view}
            initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}}
            transition={{duration:0.28,ease:"easeOut"}}
            className="absolute inset-0 z-40 overflow-auto"
            style={{background:"rgba(7,16,24,0.96)",paddingTop:"72px"}}>
            {view==="diff"&&<DiffEngine/>}
            {view==="simulation"&&<SimulationSandbox/>}
            {view==="memory"&&<MemoryLayer/>}
            {view==="countries"&&<CountriesView/>}
            {view==="sme"&&<SMEAssistant/>}
            {view==="api"&&<APIView/>}
            {view==="settings"&&<SettingsView/>}
          </motion.div>
        )}
      </AnimatePresence>

      {isDash && !compareMode && !selNode &&(
        <div className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 pointer-events-none select-none text-center"
          style={{opacity:0.12}}>
          <p className="text-xs tracking-widest uppercase" style={{color:"#F5F7FA",fontFamily:"IBM Plex Sans, sans-serif"}}>
            Click any node to inspect · Drag to rearrange · Scroll to zoom
          </p>
        </div>
      )}
    </div>
  );
}
