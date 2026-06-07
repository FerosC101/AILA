import { loadPolicies } from "./sources.js";
import type { RegulationPolicy } from "./types.js";

export type GraphNodeType = "country" | "pillar" | "regulation";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  country: string;
  region: string;
  // pillar-only
  pillar?: string;
  // regulation-only
  url?: string;
  instrument?: string;
  pillars?: string[];
  policies?: string[];
  coverage?: string;
  timeframe?: string;
  /** how many policy-measure rows collapsed into this node */
  weight?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "belongs";
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    countries: number;
    pillars: number;
    regulations: number;
    policies: number;
    byCountry: Record<string, number>;
    byPillar: Record<string, number>;
  };
}

function slug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}

const uniq = (xs: (string | undefined)[]) =>
  [...new Set(xs.filter((x): x is string => !!x))];

/**
 * Build a three-tier graph: country hub → pillar (per country) → regulation (URL).
 * A URL that touches multiple pillars links to each; a URL with no pillar (e.g.
 * curated sources) links straight to its country hub. Policy-measure rows that
 * share a (country, url) collapse into one regulation node.
 */
export function buildGraph(activeUrls?: Set<string>): GraphPayload {
  const policies = loadPolicies();

  const countries = new Map<string, GraphNode>();
  const pillars = new Map<string, GraphNode>();
  const regs = new Map<string, GraphNode & { _rows: RegulationPolicy[] }>();
  const edges = new Map<string, GraphEdge>();

  const addEdge = (source: string, target: string) => {
    const id = `${source}->${target}`;
    if (!edges.has(id)) edges.set(id, { id, source, target, type: "belongs" });
  };

  for (const p of policies) {
    // active-only mode: drop policy rows whose URL isn't reachable
    if (activeUrls && !activeUrls.has(p.url)) continue;

    const countryId = `country:${slug(p.jurisdiction)}`;
    if (!countries.has(countryId)) {
      countries.set(countryId, {
        id: countryId, type: "country", label: p.jurisdiction,
        country: p.jurisdiction, region: p.region,
      });
    }

    const regId = `reg:${slug(p.jurisdiction)}:${slug(p.url)}`;
    const existing = regs.get(regId);
    if (existing) existing._rows.push(p);
    else
      regs.set(regId, {
        id: regId, type: "regulation", label: p.instrument, instrument: p.instrument,
        country: p.jurisdiction, region: p.region, url: p.url,
        coverage: p.coverage, timeframe: p.timeframe, _rows: [p],
      });
  }

  // finalize regulation aggregates + wire pillar layer
  const regNodes: GraphNode[] = [...regs.values()].map((r) => {
    const { _rows, ...node } = r;
    const rowPillars = uniq(_rows.map((x) => x.pillar));
    const countryId = `country:${slug(node.country)}`;

    if (rowPillars.length === 0) {
      addEdge(countryId, node.id); // no pillar → hang off the country hub
    } else {
      for (const pl of rowPillars) {
        const pillarId = `pillar:${slug(node.country)}:${slug(pl)}`;
        if (!pillars.has(pillarId)) {
          pillars.set(pillarId, {
            id: pillarId, type: "pillar", label: pl, pillar: pl,
            country: node.country, region: node.region,
          });
          addEdge(countryId, pillarId);
        }
        addEdge(pillarId, node.id);
      }
    }

    return {
      ...node,
      pillars: rowPillars,
      policies: uniq(_rows.map((x) => x.policyFocus)),
      weight: _rows.length,
    };
  });

  // prune country hubs that ended up with no children (e.g. all their URLs dead)
  const edgeSources = new Set([...edges.values()].map((e) => e.source));
  for (const id of [...countries.keys()]) if (!edgeSources.has(id)) countries.delete(id);

  const byCountry: Record<string, number> = {};
  for (const r of regNodes) byCountry[r.country] = (byCountry[r.country] ?? 0) + 1;
  const byPillar: Record<string, number> = {};
  for (const r of regNodes) for (const pl of r.pillars ?? []) byPillar[pl] = (byPillar[pl] ?? 0) + 1;

  return {
    nodes: [...countries.values(), ...pillars.values(), ...regNodes],
    edges: [...edges.values()],
    stats: {
      countries: countries.size,
      pillars: pillars.size,
      regulations: regNodes.length,
      policies: policies.length,
      byCountry,
      byPillar,
    },
  };
}
