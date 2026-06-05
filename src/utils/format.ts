export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}
