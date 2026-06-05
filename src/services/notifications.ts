import { requestJson, withLatency } from "./api";
import type { NotificationItem } from "../types/aila";
import { seedNotifications } from "../lib/seedData";

export async function getNotifications(): Promise<NotificationItem[]> {
  // TODO GET /alerts
  if (!import.meta.env.VITE_AILA_API_BASE_URL) {
    return withLatency(() => seedNotifications);
  }

  return requestJson<NotificationItem[]>("/alerts");
}
