export type GraphNodeType = "country" | "document" | "issue";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  x: number;
  y: number;
  color: string;
  sublabel: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export const graphNodes: GraphNode[] = [
  { id: "ph", label: "Philippines", type: "country", x: 18, y: 20, color: "#3B82F6", sublabel: "Primary jurisdiction" },
  { id: "sg", label: "Singapore", type: "country", x: 58, y: 18, color: "#10B981", sublabel: "Reference jurisdiction" },
  { id: "vn", label: "Vietnam", type: "country", x: 38, y: 52, color: "#EF4444", sublabel: "Review queue" },
  { id: "doc-1", label: "Privacy Act update", type: "document", x: 23, y: 36, color: "#60A5FA", sublabel: "Ready" },
  { id: "doc-2", label: "Advisory note", type: "document", x: 56, y: 34, color: "#34D399", sublabel: "Analyzing" },
  { id: "issue-1", label: "Cross-border transfer", type: "issue", x: 40, y: 66, color: "#F59E0B", sublabel: "Action required" },
];

export const graphEdges: GraphEdge[] = [
  { from: "ph", to: "doc-1", label: "source" },
  { from: "sg", to: "doc-2", label: "source" },
  { from: "vn", to: "issue-1", label: "impact" },
  { from: "doc-1", to: "issue-1", label: "analysis" },
  { from: "doc-2", to: "issue-1", label: "comparison" },
  { from: "ph", to: "sg", label: "reference" },
];
