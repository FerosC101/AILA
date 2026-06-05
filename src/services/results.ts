import { requestJson, withLatency } from "./api";
import type { AnalysisResult } from "../types/aila";
import { seedResults } from "../lib/seedData";

export async function fetchResultById(resultId: string): Promise<AnalysisResult | null> {
  // TODO GET /results/:id
  if (!import.meta.env.VITE_AILA_API_BASE_URL) {
    return withLatency(() => seedResults.find((item) => item.id === resultId) ?? null);
  }

  return requestJson<AnalysisResult>(`/results/${resultId}`);
}
