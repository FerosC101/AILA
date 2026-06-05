import type { AnalysisResult, DashboardMetrics, NotificationItem, UploadRecord } from "../types/aila";

export const seedUploads: UploadRecord[] = [
  {
    id: "upload-001",
    fileName: "Philippines Data Privacy Act update.pdf",
    jurisdiction: "Philippines",
    documentType: "Regulation update",
    status: "ready",
    uploadedAt: "2026-05-29T09:15:00.000Z",
    sourceLabel: "Government portal",
    notes: "Amendment review for cross-border processing rules.",
  },
  {
    id: "upload-002",
    fileName: "Singapore PDPA advisory note.docx",
    jurisdiction: "Singapore",
    documentType: "Advisory",
    status: "analyzing",
    uploadedAt: "2026-06-01T08:40:00.000Z",
    sourceLabel: "Internal intake",
  },
  {
    id: "upload-003",
    fileName: "Vietnam cybersecurity decree scan.pdf",
    jurisdiction: "Vietnam",
    documentType: "Scanned legal source",
    status: "uploaded",
    uploadedAt: "2026-06-01T07:25:00.000Z",
    sourceLabel: "Official gazette",
  },
];

export const seedResults: AnalysisResult[] = [
  {
    id: "result-001",
    uploadId: "upload-001",
    title: "Cross-border transfer obligations identified",
    jurisdiction: "Philippines",
    status: "ready",
    confidence: 96,
    updatedAt: "2026-05-29T09:31:00.000Z",
    summary:
      "AILA identified the current consent, retention, and breach-notification duties for health-related records and mapped the relevant transfer controls.",
    risks: ["Sensitive data transfer requires explicit processing rationale", "Consent language should be narrowed for offshore storage"],
    actions: ["Review contract terms with the hosting provider", "Confirm the retention schedule with legal counsel"],
  },
  {
    id: "result-002",
    uploadId: "upload-002",
    title: "Policy advisory normalised for analysis",
    jurisdiction: "Singapore",
    status: "analyzing",
    confidence: 88,
    updatedAt: "2026-06-01T08:44:00.000Z",
    summary:
      "The advisory is being converted into structured obligations and control points for internal compliance review.",
    risks: ["Pending extraction of clause-level obligations"],
    actions: ["Validate source text before sharing externally"],
  },
];

export const seedNotifications: NotificationItem[] = [
  {
    id: "notification-001",
    title: "New upload ready for review",
    message: "Singapore PDPA advisory note has finished parsing and is ready for legal review.",
    severity: "success",
    createdAt: "2026-06-01T08:46:00.000Z",
  },
  {
    id: "notification-002",
    title: "Processing queue is above target",
    message: "Two documents are currently processing. Review the queue to keep turnaround under target.",
    severity: "warning",
    createdAt: "2026-06-01T08:50:00.000Z",
  },
];

export const seedMetrics: DashboardMetrics = {
  queued: 1,
  processing: 1,
  completedToday: 14,
  alerts: 2,
  avgTurnaroundMinutes: 18,
  accuracy: 96,
};

export const focusAreas = [
  "Cross-border transfers",
  "Consent and notices",
  "Retention obligations",
  "Vendor controls",
  "Breach response",
];

export const audienceOptions = ["Legal review", "Operations", "Compliance", "Leadership"];
