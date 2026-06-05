import { ApiError, requestJson, withLatency } from "./api";
import type { UploadInput, UploadRecord } from "../types/aila";
import { seedUploads } from "../lib/seedData";

export async function submitUpload(input: UploadInput): Promise<UploadRecord> {
  // TODO POST /upload
  // Expected payload:
  // {
  //   fileName: string,
  //   jurisdiction: string,
  //   documentType: string,
  //   sourceLabel?: string,
  //   notes?: string
  // }
  if (!import.meta.env.VITE_AILA_API_BASE_URL) {
    return withLatency(() => ({
      id: `upload-${Date.now()}`,
      fileName: input.fileName,
      jurisdiction: input.jurisdiction,
      documentType: input.documentType,
      status: "uploaded" as const,
      uploadedAt: new Date().toISOString(),
      sourceLabel: input.sourceLabel,
      notes: input.notes,
    }));
  }

  return requestJson<UploadRecord>("/upload", {
    method: "POST",
    body: JSON.stringify(input),
  }).catch((error) => {
    if (error instanceof ApiError) throw error;
    throw error;
  });
}

export async function listUploads(): Promise<UploadRecord[]> {
  // TODO GET /upload or GET /status
  if (!import.meta.env.VITE_AILA_API_BASE_URL) {
    return withLatency(() => seedUploads);
  }

  return requestJson<UploadRecord[]>("/status");
}
