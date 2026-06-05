import { requestJson, withLatency } from "./api";
import type { AnalysisRequest, AnalysisResult } from "../types/aila";
import { seedResults } from "../lib/seedData";

export async function startAnalysis(input: AnalysisRequest): Promise<AnalysisResult> {
  // TODO POST /analyze
  // Expected payload:
  // {
  //   uploadId: string,
  //   focusAreas: string[],
  //   audience: string
  // }
  if (!import.meta.env.VITE_AILA_API_BASE_URL) {
    const source = seedResults.find((item) => item.uploadId === input.uploadId) ?? seedResults[0];
    return withLatency(() => ({
      ...source,
      id: `result-${Date.now()}`,
      uploadId: input.uploadId,
      status: "ready" as const,
      title: `${input.audience} summary generated`,
      updatedAt: new Date().toISOString(),
      confidence: Math.min(99, source.confidence + 2),
    }), 700);
  }

  return requestJson<AnalysisResult>("/analyze", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getAnalysisResults(): Promise<AnalysisResult[]> {
  // TODO GET /results
  if (!import.meta.env.VITE_AILA_API_BASE_URL) {
    return withLatency(() => seedResults);
  }

  return requestJson<AnalysisResult[]>("/results");
}
