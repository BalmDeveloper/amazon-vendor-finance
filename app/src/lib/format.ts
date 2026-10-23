import type { Recommendation } from "./types";

export const usd = (n: number | null | undefined, compact = true) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: compact ? "compact" : "standard",
        maximumFractionDigits: compact ? 1 : 0,
      }).format(n);

/** CONFIDENCE is 'high' | 'medium' | 'low' in OPS; tolerate a 0–1 score too. */
export function confidenceLevel(c: Recommendation["confidence"]): "high" | "medium" | "low" | null {
  if (c == null) return null;
  if (typeof c === "number") return c >= 0.75 ? "high" : c >= 0.5 ? "medium" : "low";
  return c;
}

export const humanize = (s: string | null | undefined) =>
  (s ?? "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const isOverdue = (due?: string | null) => !!due && new Date(due) < new Date(new Date().toDateString());

export const isOpenRec = (r: Recommendation) => (r.status ?? "new") === "new";
