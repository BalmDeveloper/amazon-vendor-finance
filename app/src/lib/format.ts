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

export const CONFIDENCE_PCT: Record<Recommendation["confidence"], number> = { high: 85, medium: 60, low: 35 };

export const humanize = (s: string | null | undefined) =>
  (s ?? "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const isOverdue = (due?: string | null) => !!due && new Date(due) < new Date(new Date().toDateString());
