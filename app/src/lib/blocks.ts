import type { ActionItem, ChartSpec, DashboardSpec } from "./types";

// Skills instruct Claude to emit ```chart```, ```dashboard``` and ```action_items```
// fenced JSON blocks. We pull them out of the text so the UI can render them natively.
const FENCE = /```(chart|dashboard|action_items)\s*\n([\s\S]*?)```/g;

const validWidget = (w: ChartSpec) =>
  Boolean(w?.title) && (w.type === "html" ? typeof w.html === "string" : Array.isArray(w.data));

export function extractBlocks(text: string): {
  text: string;
  charts: ChartSpec[];
  dashboards: DashboardSpec[];
  actionItems: Omit<ActionItem, "id" | "chat_id" | "status">[];
} {
  const charts: ChartSpec[] = [];
  const dashboards: DashboardSpec[] = [];
  const actionItems: Omit<ActionItem, "id" | "chat_id" | "status">[] = [];

  const clean = text.replace(FENCE, (_m, kind: string, body: string) => {
    try {
      const parsed = JSON.parse(body);
      if (kind === "chart" && validWidget(parsed)) {
        charts.push({ ...parsed, data: parsed.data ?? [] });
      } else if (kind === "dashboard" && parsed?.name && Array.isArray(parsed.widgets)) {
        const widgets = (parsed.widgets as ChartSpec[])
          .filter(validWidget)
          .map((w) => ({ ...w, data: w.data ?? [] }));
        if (widgets.length) dashboards.push({ ...parsed, widgets });
      } else if (kind === "action_items") {
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const it of list) if (it?.title) actionItems.push(it);
      }
      return "";
    } catch {
      return _m; // leave malformed blocks visible rather than silently dropping
    }
  });

  return { text: clean.replace(/\n{3,}/g, "\n\n").trim(), charts, dashboards, actionItems };
}
