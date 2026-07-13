import React, { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

// Country / body centroids (lat,lng). Global bodies placed at their HQ cities.
const CENTROIDS: Record<string, { lat: number; lng: number; flag: string }> = {
  Singapore:   { lat: 1.29,  lng: 103.85, flag: "🇸🇬" },
  Malaysia:    { lat: 3.14,  lng: 101.69, flag: "🇲🇾" },
  Thailand:    { lat: 13.75, lng: 100.5,  flag: "🇹🇭" },
  Philippines: { lat: 14.6,  lng: 120.98, flag: "🇵🇭" },
  Indonesia:   { lat: -6.2,  lng: 106.85, flag: "🇮🇩" },
  Vietnam:     { lat: 21.03, lng: 105.85, flag: "🇻🇳" },
  Australia:   { lat: -35.28,lng: 149.13, flag: "🇦🇺" },
  ASEAN:       { lat: -6.2,  lng: 106.85, flag: "🌏" },
  WTO:         { lat: 46.22, lng: 6.14,   flag: "🌐" },
  OECD:        { lat: 48.85, lng: 2.35,   flag: "🌐" },
  UNCTAD:      { lat: 46.22, lng: 6.14,   flag: "🌐" },
  APEC:        { lat: 1.29,  lng: 103.85, flag: "🌐" },
  CPTPP:       { lat: -41.29,lng: 174.78, flag: "🌐" },
  EU:          { lat: 50.85, lng: 4.35,   flag: "🇪🇺" },
  USA:         { lat: 38.9,  lng: -77.04, flag: "🇺🇸" },
};
// world-countries polygons (globe.gl canonical dataset) — for the hex country map
const COUNTRIES_URL = "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson";

type ApiNode = {
  id: string; type: string; label: string; country: string; region: string;
  url?: string; instrument?: string; pillars?: string[]; policies?: string[]; coverage?: string; timeframe?: string;
};
type CountryPoint = { id: string; country: string; label: string; lat: number; lng: number; count: number; region: string; flag: string };

interface Props { onSelect: (n: any) => void; dimmed: boolean; }

export default function GlobeView({ onSelect, dimmed }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [nodes, setNodes] = useState<ApiNode[]>([]);
  const [points, setPoints] = useState<CountryPoint[]>([]);
  const [arcs, setArcs] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [selected, setSelected] = useState<CountryPoint | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // country map (hex polygons) — graceful fallback to plain globe if offline
  useEffect(() => {
    fetch(COUNTRIES_URL).then((r) => r.json())
      .then((geo) => setCountries((geo.features ?? []).filter((f: any) => f.properties?.ISO_A2 !== "AQ")))
      .catch(() => setCountries([]));
  }, []);

  // real /graph data → markers + arcs
  useEffect(() => {
    const base = (import.meta as any).env?.VITE_AILA_API_BASE_URL?.trim();
    if (!base) { setState("error"); return; }
    fetch(`${base}/graph`).then((r) => r.json()).then((g: { nodes: ApiNode[] }) => {
      const all = g.nodes ?? [];
      setNodes(all);
      const regs = all.filter((n) => n.type === "regulation");
      const pts = all.filter((n) => n.type === "country").map((c) => {
        const geo = CENTROIDS[c.country]; if (!geo) return null;
        return { id: c.id, country: c.country, label: c.label, lat: geo.lat, lng: geo.lng, region: c.region, flag: geo.flag, count: regs.filter((r) => r.country === c.country).length };
      }).filter(Boolean) as CountryPoint[];
      setPoints(pts); setState(pts.length ? "ready" : "empty");

      const byRegion = new Map<string, CountryPoint[]>();
      for (const p of pts) { if (!byRegion.has(p.region)) byRegion.set(p.region, []); byRegion.get(p.region)!.push(p); }
      const a: any[] = [];
      for (const grp of byRegion.values())
        for (let i = 0; i < grp.length; i++) for (let j = i + 1; j < grp.length; j++)
          a.push({ startLat: grp[i].lat, startLng: grp[i].lng, endLat: grp[j].lat, endLng: grp[j].lng });
      setArcs(a);
    }).catch(() => setState("error"));
  }, []);

  useEffect(() => {
    const g = globeRef.current; if (!g || state !== "ready") return;
    g.controls().autoRotate = true; g.controls().autoRotateSpeed = 0.5; g.controls().enableZoom = true;
    g.pointOfView({ lat: 8, lng: 110, altitude: 2.3 }, 0);
  }, [state]);

  const globeMaterial = useMemo(
    () => new THREE.MeshPhongMaterial({ color: "#12283f", emissive: "#0a1626", shininess: 4, transparent: true, opacity: 0.98 }),
    [],
  );
  const maxCount = Math.max(1, ...points.map((p) => p.count));

  const flyTo = (p: CountryPoint) => {
    setSelected(p);
    const g = globeRef.current;
    if (g) { g.controls().autoRotate = false; g.pointOfView({ lat: p.lat, lng: p.lng, altitude: 1.5 }, 1000); }
  };
  const openReg = (r: ApiNode) => onSelect({
    id: r.id, type: "regulation", label: r.instrument || r.label, url: r.url,
    color: "#1E3A5F", glowColor: "#1E3A5F",
    details: {
      category: r.coverage || "Regulation", enacted: r.timeframe || "N/A", status: "Active",
      clauses: r.policies?.length ?? 0, amendments: 0, coverage: r.country, confidence: 0.9,
      description: `${r.instrument || r.label}\n\nPillars: ${(r.pillars ?? []).join(", ") || "—"}\nPolicy focus: ${(r.policies ?? []).join("; ") || "—"}`,
    },
  });

  const selectedRegs = selected ? nodes.filter((n) => n.type === "regulation" && n.country === selected.country) : [];

  return (
    <div ref={wrap} className="absolute inset-0" style={{ background: "#ffffff", opacity: dimmed ? 0.25 : 1, transition: "opacity 0.3s" }}>
      {state === "ready" && (
        <Globe
          ref={globeRef}
          width={size.w} height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={globeMaterial}
          showAtmosphere atmosphereColor="#93C5FD" atmosphereAltitude={0.16}
          // country map — hex-dotted continents
          hexPolygonsData={countries}
          hexPolygonResolution={3}
          hexPolygonMargin={0.35}
          hexPolygonAltitude={0.005}
          hexPolygonColor={() => "rgba(148,163,184,0.55)"}
          // jurisdiction markers (flat glowing dots)
          pointsData={points}
          pointLat="lat" pointLng="lng"
          pointColor={(d: any) => (selected?.id === d.id ? "#F8FAFC" : "#38BDF8")}
          pointAltitude={0.01}
          pointRadius={(d: any) => 0.5 + (d.count / maxCount) * 0.7}
          pointLabel={(d: any) => `<div style="font:600 12px Inter,sans-serif;color:#0F172A;background:#fff;border:1px solid #E5E9F0;border-radius:8px;padding:6px 10px;box-shadow:0 6px 20px rgba(15,23,42,0.15)">${d.flag} ${d.label} · ${d.count} sources</div>`}
          onPointClick={(d: any) => flyTo(d)}
          // pulse rings under markers
          ringsData={points}
          ringLat="lat" ringLng="lng"
          ringColor={() => (t: number) => `rgba(56,189,248,${1 - t})`}
          ringMaxRadius={2.2} ringPropagationSpeed={1.3} ringRepeatPeriod={1800}
          // regional cross-border arcs
          arcsData={arcs}
          arcColor={() => ["rgba(56,189,248,0.1)", "rgba(56,189,248,0.55)"]}
          arcAltitude={0.22} arcStroke={0.35}
          arcDashLength={0.5} arcDashGap={0.5} arcDashAnimateTime={2800}
        />
      )}

      {/* country → regulations side panel */}
      {selected && (
        <div className="absolute top-0 right-0 bottom-0 z-40 flex flex-col" style={{ width: "320px", background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", borderLeft: "1px solid #E5E9F0", boxShadow: "-4px 0 24px rgba(15,23,42,0.08)" }}>
          <div className="flex items-center gap-2 p-4 border-b" style={{ borderColor: "#E5E9F0" }}>
            <span className="text-2xl">{selected.flag}</span>
            <div className="flex-1">
              <h3 className="font-semibold text-sm" style={{ color: "#0F172A" }}>{selected.label}</h3>
              <p className="text-xs" style={{ color: "#64748B" }}>{selectedRegs.length} tracked sources · {selected.region}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs px-2 py-1 rounded" style={{ color: "#64748B", border: "1px solid #E5E9F0", background: "#fff", cursor: "pointer" }}>✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {selectedRegs.map((r) => (
              <button key={r.id} onClick={() => openReg(r)} className="w-full text-left px-3 py-2 rounded-lg transition-colors"
                style={{ background: "#fff", border: "1px solid #E5E9F0", cursor: "pointer" }}>
                <p className="text-xs font-medium" style={{ color: "#1E293B" }}>{r.instrument || r.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{(r.pillars ?? []).join(" · ") || r.region}</p>
              </button>
            ))}
            {selectedRegs.length === 0 && <p className="text-xs text-center py-6" style={{ color: "#94A3B8" }}>No tracked sources.</p>}
          </div>
        </div>
      )}

      {state !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs tracking-widest uppercase" style={{ color: "#94A3B8", fontFamily: "IBM Plex Sans, sans-serif" }}>
            {state === "loading" ? "Loading globe…" : state === "empty" ? "No active jurisdictions" : "Backend unavailable"}
          </p>
        </div>
      )}
    </div>
  );
}
