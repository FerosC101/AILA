// In-memory activity feed — a ring buffer of real engine events (scrape / extract /
// validate / diff / upload / query). Replaces the frontend's hardcoded LIVE_EVENTS.

export type ActivityType = "scrape" | "extract" | "validate" | "diff" | "verify" | "ingest" | "analysis" | "alert" | "query";

export interface ActivityEvent {
  type: ActivityType;
  text: string;
  at: number;       // epoch ms
}

const MAX = 60;
const log: ActivityEvent[] = [];

/** Append an event to the activity feed. */
export function logActivity(type: ActivityType, text: string): void {
  log.unshift({ type, text: text.slice(0, 160), at: Date.now() });
  if (log.length > MAX) log.length = MAX;
}

/** Most-recent events, newest first. */
export function recentActivity(limit = 30): ActivityEvent[] {
  return log.slice(0, limit);
}
