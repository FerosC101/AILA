import { requestJson, withLatency } from "./api";
import type { DashboardMetrics } from "../types/aila";
import { seedMetrics } from "../lib/seedData";

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  // TODO GET /status or GET /metrics
  if (!import.meta.env.VITE_AILA_API_BASE_URL) {
    return withLatency(() => seedMetrics);
  }

  return requestJson<DashboardMetrics>("/status");
}
