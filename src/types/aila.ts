export type WorkspaceView = "dashboard" | "results" | "settings";

export type DocumentStatus = "queued" | "uploaded" | "analyzing" | "ready" | "failed";
export type NotificationSeverity = "info" | "warning" | "success" | "error";

export interface UploadInput {
  fileName: string;
  jurisdiction: string;
  documentType: string;
  sourceLabel?: string;
  notes?: string;
}

export interface UploadRecord {
  id: string;
  fileName: string;
  jurisdiction: string;
  documentType: string;
  status: DocumentStatus;
  uploadedAt: string;
  sourceLabel?: string;
  notes?: string;
}

export interface AnalysisRequest {
  uploadId: string;
  focusAreas: string[];
  audience: string;
}

export interface AnalysisResult {
  id: string;
  uploadId: string;
  title: string;
  jurisdiction: string;
  status: DocumentStatus;
  confidence: number;
  updatedAt: string;
  summary: string;
  risks: string[];
  actions: string[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  createdAt: string;
}

export interface DashboardMetrics {
  queued: number;
  processing: number;
  completedToday: number;
  alerts: number;
  avgTurnaroundMinutes: number;
  accuracy: number;
}
